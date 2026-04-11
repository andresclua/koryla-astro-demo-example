/**
 * Koryla A/B testing — Netlify Edge Function (self-contained)
 *
 * Core split engine inlined — no external dependencies needed.
 * Set KORYLA_API_KEY and KORYLA_API_URL in Netlify environment variables.
 */

// ── Core engine (inlined) ─────────────────────────────────────────────────

interface Variant {
  id: string; name: string; traffic_weight: number
  target_url: string; is_control: boolean
}

interface Experiment {
  id: string; name: string; base_url: string; conversion_url?: string
  variants: Variant[]; destinations: unknown[]
}

interface SplitResult {
  experimentId: string; variantId: string
  targetUrl: string; cookieName: string; isNewAssignment: boolean
}

const COOKIE_PREFIX = 'ky_'
const CACHE_TTL = 60_000

function createSplitEngine(options: { apiKey: string; apiUrl: string }) {
  const { apiKey, apiUrl } = options
  let cachedExperiments: Experiment[] = []
  let cachedAt = 0

  async function getConfig(): Promise<Experiment[]> {
    if (Date.now() - cachedAt < CACHE_TTL) return cachedExperiments
    try {
      const res = await fetch(`${apiUrl}/api/worker/config`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      })
      if (!res.ok) return cachedExperiments
      cachedExperiments = await res.json() as Experiment[]
      cachedAt = Date.now()
    } catch { /* network down — return stale cache */ }
    return cachedExperiments
  }

  function assignVariant(variants: Pick<Variant, 'id' | 'traffic_weight'>[]): string {
    const total = variants.reduce((s, v) => s + v.traffic_weight, 0)
    let rand = Math.random() * total
    for (const v of variants) { rand -= v.traffic_weight; if (rand <= 0) return v.id }
    return variants[variants.length - 1].id
  }

  function parseCookies(header: string): Record<string, string> {
    if (!header) return {}
    return Object.fromEntries(
      header.split(';').map(c => c.trim().split('=').map(s => s.trim())).filter(([k]) => k)
    )
  }

  async function process(urlString: string, cookieHeader: string): Promise<SplitResult | null> {
    const experiments = await getConfig()
    if (!experiments.length) return null
    let url: URL
    try { url = new URL(urlString) } catch { return null }

    // Sort by most specific (longest) base_url path first so /pricing
    // matches before / when both experiments are active
    const sorted = [...experiments].sort((a, b) => {
      try {
        return new URL(b.base_url).pathname.length - new URL(a.base_url).pathname.length
      } catch { return 0 }
    })
    const experiment = sorted.find(e => {
      try {
        const basePath = new URL(e.base_url).pathname.replace(/\/$/, '') || '/'
        const reqPath = url.pathname.replace(/\/$/, '') || '/'
        return reqPath === basePath
      } catch { return false }
    })
    if (!experiment?.variants.length) return null

    const cookieName = `${COOKIE_PREFIX}${experiment.id}`
    const cookies = parseCookies(cookieHeader)
    let variantId = cookies[cookieName]
    let isNewAssignment = false

    if (!variantId || !experiment.variants.find(v => v.id === variantId)) {
      variantId = assignVariant(experiment.variants)
      isNewAssignment = true
    }

    const variant = experiment.variants.find(v => v.id === variantId)!
    const targetUrl = new URL(urlString)
    try { targetUrl.pathname = new URL(variant.target_url).pathname } catch { return null }

    return { experimentId: experiment.id, variantId, targetUrl: targetUrl.toString(), cookieName, isNewAssignment }
  }

  return { process, getActiveExperiments: getConfig }
}

// ── Netlify adapter ───────────────────────────────────────────────────────

const API_KEY = Deno.env.get('KORYLA_API_KEY') ?? ''
const API_URL = Deno.env.get('KORYLA_API_URL') ?? 'https://app.koryla.com'

const engine = createSplitEngine({ apiKey: API_KEY, apiUrl: API_URL })

function getSessionId(cookies: Record<string, string>): string {
  if (cookies['ky_session']) return cookies['ky_session']
  // Generate a new session id — crypto.randomUUID() is available in Deno/edge
  return crypto.randomUUID()
}

async function fireEvent(payload: {
  experiment_id: string
  variant_id: string
  session_id: string
  event_type: 'impression' | 'conversion'
  metadata?: Record<string, unknown>
}) {
  try {
    await fetch(`${API_URL}/api/worker/event`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${API_KEY}`,
      },
      body: JSON.stringify(payload),
    })
  } catch { /* ignore network errors */ }
}

interface NetlifyContext {
  next: () => Promise<Response>
  rewrite: (url: string | URL) => Promise<Response>
}

export default async function handler(request: Request, context: NetlifyContext): Promise<Response> {
  const cookieHeader = request.headers.get('cookie') ?? ''

  // Parse cookies to get/create session id
  const cookies = Object.fromEntries(
    cookieHeader.split(';').map(c => c.trim().split('=').map(s => s.trim())).filter(([k]) => k)
  )
  const sessionId = getSessionId(cookies)
  const isNewSession = !cookies['ky_session']

  // Check conversion URLs FIRST — before any experiment routing
  // This prevents conversion pages from being accidentally rewritten
  const reqUrl = new URL(request.url)
  const experiments = await engine.getActiveExperiments()
  for (const exp of experiments) {
    if (!exp.conversion_url) continue
    try {
      const convPath = new URL(exp.conversion_url).pathname.replace(/\/$/, '') || '/'
      const reqPath = reqUrl.pathname.replace(/\/$/, '') || '/'
      if (reqPath === convPath) {
        const variantCookieKey = `${COOKIE_PREFIX}${exp.id}`
        const variantId = cookies[variantCookieKey] ?? null
        if (variantId) {
          await fireEvent({ experiment_id: exp.id, variant_id: variantId, session_id: sessionId, event_type: 'conversion' })
        }
        return context.next()
      }
    } catch { /* ignore */ }
  }

  const result = await engine.process(request.url, cookieHeader)

  if (!result) return context.next()

  // Skip rewrite if target path is the same as request path (avoids redirect loop on control)
  const requestPath = new URL(request.url).pathname
  const targetPath = new URL(result.targetUrl).pathname
  const isSamePath = requestPath === targetPath || requestPath === targetPath + '/' || requestPath + '/' === targetPath

  // Fire impression before serving
  await fireEvent({
    experiment_id: result.experimentId,
    variant_id: result.variantId,
    session_id: sessionId,
    event_type: 'impression',
  })

  const response = isSamePath ? await context.next() : await context.rewrite(result.targetUrl)

  const mutable = new Response(response.body, response)

  if (result.isNewAssignment) {
    mutable.headers.append(
      'Set-Cookie',
      `${result.cookieName}=${result.variantId}; Path=/; Max-Age=${60 * 60 * 24 * 30}; SameSite=Lax`
    )
  }

  // Persist session id cookie if new
  if (isNewSession) {
    mutable.headers.append(
      'Set-Cookie',
      `ky_session=${sessionId}; Path=/; Max-Age=${60 * 60 * 24 * 365}; SameSite=Lax`
    )
  }

  return mutable
}
