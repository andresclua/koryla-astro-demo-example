/**
 * Inline implementation of @koryla/astro getVariant() helper.
 *
 * In a real project you'd install the package:
 *   npm install @koryla/astro
 *   import { getVariant } from '@koryla/astro'
 *
 * This file mirrors exactly what @koryla/astro does internally,
 * so the astro-demo works as a self-contained standalone repo.
 */

const COOKIE_PREFIX = 'ky_'
const CACHE_TTL = 60_000

interface Variant { id: string; name: string; traffic_weight: number; target_url: string; is_control: boolean }
interface Experiment { id: string; name: string; base_url: string; conversion_url?: string; variants: Variant[] }
export interface VariantResult {
  experiment: Experiment
  variant: Variant
  variantId: string
  isNewAssignment: boolean
  cookieName: string
}

// Module-level cache (persists across requests during server lifetime)
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

export async function getVariant(
  request: Request,
  experimentId: string,
  options: { apiKey: string; apiUrl: string },
): Promise<VariantResult | null> {
  const experiments = await fetchConfig(options.apiKey, options.apiUrl)
  const experiment = experiments.find(e => e.id === experimentId)
  if (!experiment || !experiment.variants.length) return null

  const cookies = parseCookies(request.headers.get('cookie') ?? '')
  const cookieName = `${COOKIE_PREFIX}${experimentId}`
  let variantId = cookies[cookieName]
  let isNewAssignment = false

  const stored = variantId ? experiment.variants.find(v => v.id === variantId) : null
  if (!stored) {
    variantId = assignVariant(experiment.variants)
    isNewAssignment = true
  }

  const variant = experiment.variants.find(v => v.id === variantId)!
  return { experiment, variant, variantId, isNewAssignment, cookieName }
}
