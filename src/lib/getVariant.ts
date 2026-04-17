const COOKIE_PREFIX = 'ky_'
const CACHE_TTL = 60_000

interface Rule { param: string; value: string }
interface Variant { id: string; name: string; traffic_weight: number; target_url: string; is_control: boolean; rules?: Rule[] }
interface Experiment { id: string; name: string; base_url: string; conversion_url?: string; variants: Variant[] }
export interface VariantResult {
  experiment: Experiment
  variant: Variant
  variantId: string
  isNewAssignment: boolean
  cookieName: string
}

const cache: { experiments: Experiment[]; cachedAt: number } = { experiments: [], cachedAt: 0 }

async function fetchConfig(apiKey: string, apiUrl: string): Promise<Experiment[]> {
  if (Date.now() - cache.cachedAt < CACHE_TTL) return cache.experiments
  try {
    const res = await fetch(`${apiUrl}/api/worker/config`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    })
    if (res.ok) {
      cache.experiments = await res.json() as Experiment[]
      cache.cachedAt = Date.now()
    }
  } catch { /* network down — return stale cache */ }
  return cache.experiments
}

function parseCookies(header: string): Record<string, string> {
  if (!header) return {}
  return Object.fromEntries(
    header.split(';').map(c => c.trim().split('=').map(s => s.trim())).filter(([k]) => k)
  )
}

function assignVariant(variants: Pick<Variant, 'id' | 'traffic_weight'>[]): string {
  const total = variants.reduce((s, v) => s + v.traffic_weight, 0)
  let rand = Math.random() * total
  for (const v of variants) { rand -= v.traffic_weight; if (rand <= 0) return v.id }
  return variants[variants.length - 1].id
}

function findRuleMatch(variants: Variant[], searchParams: URLSearchParams): Variant | null {
  for (const v of variants) {
    if (!v.rules?.length) continue
    for (const rule of v.rules) {
      if (searchParams.get(rule.param) === rule.value) return v
    }
  }
  return null
}

export async function getVariant(
  request: Request,
  experimentId: string,
  options: { apiKey: string; apiUrl: string },
): Promise<VariantResult | null> {
  const experiments = await fetchConfig(options.apiKey, options.apiUrl)
  const experiment = experiments.find(e => e.id === experimentId)
  if (!experiment || !experiment.variants.length) return null

  const url = new URL(request.url)
  const cookies = parseCookies(request.headers.get('cookie') ?? '')
  const cookieName = `${COOKIE_PREFIX}${experimentId}`
  const cookieVariantId = cookies[cookieName]
  let variantId: string
  let isNewAssignment = false

  // UTM/query param rules take priority — but don't set a sticky cookie
  // so removing the param reverts to the normal random/cookie assignment
  const ruleMatch = findRuleMatch(experiment.variants, url.searchParams)
  if (ruleMatch) {
    variantId = ruleMatch.id
    isNewAssignment = false
  } else {
    const stored = cookieVariantId ? experiment.variants.find(v => v.id === cookieVariantId) : null
    if (stored) {
      variantId = stored.id
    } else {
      variantId = assignVariant(experiment.variants)
      isNewAssignment = true
    }
  }

  const variant = experiment.variants.find(v => v.id === variantId)!
  return { experiment, variant, variantId, isNewAssignment, cookieName }
}
