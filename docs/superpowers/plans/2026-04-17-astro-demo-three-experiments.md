# Astro Demo — 3 Experiments Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Añadir 3 páginas demo a `astro-demo.koryla.com` (SDK puro, Edge puro, Edge+SDK combinado), crear los experimentos en Supabase, y generar documentación `.md` explicada para principiantes.

**Architecture:** La capa Edge (Netlify edge function en Deno) intercepta requests antes de Astro y hace URL rewrite transparente para experimentos de tipo `edge`. La capa SDK (`Experiment.astro` en el frontmatter de Astro SSR) asigna variantes a nivel de componente para experimentos de tipo `component`. El SDK lee la URL del request para reglas UTM; la cookie sticky asegura la misma variante en visitas posteriores.

**Tech Stack:** Astro 4, Netlify Edge Functions (Deno), Supabase (REST API con service key), TypeScript

---

## File Map

| Archivo | Acción | Responsabilidad |
|---------|--------|-----------------|
| `src/lib/getVariant.ts` | Modificar | Añadir `findRuleMatch()` + soporte UTM/query params |
| `src/components/Experiment.astro` | Crear | Fetch variante, set cookie, render slot activo |
| `src/components/Variant.astro` | Crear | Wrapper semántico sin lógica |
| `src/pages/demo-sdk.astro` | Crear | Demo 1: SDK puro con UTM |
| `src/pages/demo-edge.astro` | Crear | Demo 2: Edge control |
| `src/pages/demo-edge-b.astro` | Crear | Demo 2: Edge variante B |
| `src/pages/demo-combined.astro` | Crear | Demo 3: Combined control |
| `src/pages/demo-combined-b.astro` | Crear | Demo 3: Combined variante B |
| `src/pages/index.astro` | Modificar | Añadir links a los 3 nuevos demos |
| `netlify/edge-functions/koryla.ts` | Modificar | Añadir rule matching para demo-combined |
| `docs/sdk-experiment.md` | Crear | Doc SDK para principiantes |
| `docs/edge-experiment.md` | Crear | Doc Edge para principiantes |
| `docs/combined-experiment.md` | Crear | Doc Combined para principiantes |

---

## Task 1: Supabase — Crear los 3 experimentos

**Files:** ninguno en el repo (operaciones REST contra Supabase)

- [ ] **Step 1: Cambiar workspace a plan `growth`** (free permite solo 3 experimentos; ya hay 2)

```bash
curl -s -X PATCH \
  "https://<SUPABASE_PROJECT>.supabase.co/rest/v1/workspaces?id=eq.4eda79d1-85e8-4d0a-bcaf-e4a5996f8a28" \
  -H "apikey: <SUPABASE_API_KEY>" \
  -H "Authorization: Bearer <SUPABASE_API_KEY>" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=representation" \
  -d '{"plan":"growth"}'
```

Expected: `[{"id":"4eda79d1-...","plan":"growth",...}]`

- [ ] **Step 2: Crear experimento 1 — SDK puro** y guardar el UUID devuelto como `SDK_EXP_ID`

```bash
NOW=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
curl -s -X POST \
  "https://<SUPABASE_PROJECT>.supabase.co/rest/v1/experiments" \
  -H "apikey: <SUPABASE_API_KEY>" \
  -H "Authorization: Bearer <SUPABASE_API_KEY>" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=representation" \
  -d "{\"workspace_id\":\"4eda79d1-85e8-4d0a-bcaf-e4a5996f8a28\",\"name\":\"Demo SDK — UTM Text\",\"type\":\"component\",\"status\":\"active\",\"base_url\":\"https://astro-demo.koryla.com/demo-sdk\",\"conversion_url\":\"https://astro-demo.koryla.com/thank-you\",\"started_at\":\"$NOW\"}"
```

Expected: `[{"id":"<uuid>","name":"Demo SDK — UTM Text",...}]`  
→ **Anotar el `id` como `SDK_EXP_ID`**

- [ ] **Step 3: Crear variantes para experimento SDK**

```bash
# Reemplazar <SDK_EXP_ID> con el UUID del step anterior
curl -s -X POST \
  "https://<SUPABASE_PROJECT>.supabase.co/rest/v1/variants" \
  -H "apikey: <SUPABASE_API_KEY>" \
  -H "Authorization: Bearer <SUPABASE_API_KEY>" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=representation" \
  -d "[
    {\"experiment_id\":\"<SDK_EXP_ID>\",\"name\":\"control\",\"is_control\":true,\"traffic_weight\":100,\"target_url\":\"\",\"rules\":[]},
    {\"experiment_id\":\"<SDK_EXP_ID>\",\"name\":\"b\",\"is_control\":false,\"traffic_weight\":0,\"target_url\":\"\",\"rules\":[{\"param\":\"utm_text\",\"value\":\"variation-1\"}]}
  ]"
```

Expected: array de 2 variantes con sus UUIDs

- [ ] **Step 4: Crear experimento 2 — Edge puro** y guardar UUID como `EDGE_EXP_ID`

```bash
NOW=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
curl -s -X POST \
  "https://<SUPABASE_PROJECT>.supabase.co/rest/v1/experiments" \
  -H "apikey: <SUPABASE_API_KEY>" \
  -H "Authorization: Bearer <SUPABASE_API_KEY>" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=representation" \
  -d "{\"workspace_id\":\"4eda79d1-85e8-4d0a-bcaf-e4a5996f8a28\",\"name\":\"Demo Edge — Layout\",\"type\":\"edge\",\"status\":\"active\",\"base_url\":\"https://astro-demo.koryla.com/demo-edge\",\"conversion_url\":\"https://astro-demo.koryla.com/thank-you\",\"started_at\":\"$NOW\"}"
```

→ **Anotar el `id` como `EDGE_EXP_ID`**

- [ ] **Step 5: Crear variantes para experimento Edge**

```bash
curl -s -X POST \
  "https://<SUPABASE_PROJECT>.supabase.co/rest/v1/variants" \
  -H "apikey: <SUPABASE_API_KEY>" \
  -H "Authorization: Bearer <SUPABASE_API_KEY>" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=representation" \
  -d "[
    {\"experiment_id\":\"<EDGE_EXP_ID>\",\"name\":\"control\",\"is_control\":true,\"traffic_weight\":50,\"target_url\":\"https://astro-demo.koryla.com/demo-edge\",\"rules\":[]},
    {\"experiment_id\":\"<EDGE_EXP_ID>\",\"name\":\"b\",\"is_control\":false,\"traffic_weight\":50,\"target_url\":\"https://astro-demo.koryla.com/demo-edge-b\",\"rules\":[]}
  ]"
```

- [ ] **Step 6: Crear experimento 3 — Combined** y guardar UUID como `COMBINED_EXP_ID`

```bash
NOW=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
curl -s -X POST \
  "https://<SUPABASE_PROJECT>.supabase.co/rest/v1/experiments" \
  -H "apikey: <SUPABASE_API_KEY>" \
  -H "Authorization: Bearer <SUPABASE_API_KEY>" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=representation" \
  -d "{\"workspace_id\":\"4eda79d1-85e8-4d0a-bcaf-e4a5996f8a28\",\"name\":\"Demo Combined — Edge + SDK\",\"type\":\"edge\",\"status\":\"active\",\"base_url\":\"https://astro-demo.koryla.com/demo-combined\",\"conversion_url\":\"https://astro-demo.koryla.com/thank-you\",\"started_at\":\"$NOW\"}"
```

→ **Anotar el `id` como `COMBINED_EXP_ID`**

- [ ] **Step 7: Crear variantes para experimento Combined**

```bash
curl -s -X POST \
  "https://<SUPABASE_PROJECT>.supabase.co/rest/v1/variants" \
  -H "apikey: <SUPABASE_API_KEY>" \
  -H "Authorization: Bearer <SUPABASE_API_KEY>" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=representation" \
  -d "[
    {\"experiment_id\":\"<COMBINED_EXP_ID>\",\"name\":\"control\",\"is_control\":true,\"traffic_weight\":50,\"target_url\":\"https://astro-demo.koryla.com/demo-combined\",\"rules\":[]},
    {\"experiment_id\":\"<COMBINED_EXP_ID>\",\"name\":\"b\",\"is_control\":false,\"traffic_weight\":50,\"target_url\":\"https://astro-demo.koryla.com/demo-combined-b\",\"rules\":[{\"param\":\"variant\",\"value\":\"b\"}]}
  ]"
```

- [ ] **Step 8: Verificar los 5 experimentos en Supabase**

```bash
curl -s "https://<SUPABASE_PROJECT>.supabase.co/rest/v1/experiments?workspace_id=eq.4eda79d1-85e8-4d0a-bcaf-e4a5996f8a28&select=id,name,type,status" \
  -H "apikey: <SUPABASE_API_KEY>" \
  -H "Authorization: Bearer <SUPABASE_API_KEY>"
```

Expected: 5 experimentos — Pricing Page Layout, Homepage Hero Test, Demo SDK, Demo Edge, Demo Combined

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "chore: add 3 demo experiments to Supabase (SDK, Edge, Combined)"
```

---

## Task 2: Añadir rule matching a `getVariant.ts`

El `getVariant.ts` actual no chequea reglas UTM/query params — solo hace asignación aleatoria. Necesitamos añadir `findRuleMatch()` para que `?utm_text=variation-1` fuerce la variante B.

**Files:**
- Modify: `src/lib/getVariant.ts`

- [ ] **Step 1: Añadir interfaz `Rule` y función `findRuleMatch`**

Reemplazar el contenido completo de `src/lib/getVariant.ts`:

```typescript
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

  // UTM/query param rules take priority over cookie
  const ruleMatch = findRuleMatch(experiment.variants, url.searchParams)
  if (ruleMatch) {
    variantId = ruleMatch.id
    isNewAssignment = variantId !== cookieVariantId
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
```

- [ ] **Step 2: Verificar que el tipo compila sin errores**

```bash
cd /Users/andres/Documents/Personal/dev/personal/splitr/koryla-astro-demo-example
npx tsc --noEmit
```

Expected: sin errores

- [ ] **Step 3: Commit**

```bash
git add src/lib/getVariant.ts
git commit -m "feat: add UTM/query param rule matching to getVariant"
```

---

## Task 3: Crear `Experiment.astro` y `Variant.astro`

**Files:**
- Create: `src/components/Experiment.astro`
- Create: `src/components/Variant.astro`

- [ ] **Step 1: Crear `src/components/Experiment.astro`**

```astro
---
import { getVariant } from '../lib/getVariant'

interface Props {
  id: string
}

const { id } = Astro.props

const result = await getVariant(Astro.request, id, {
  apiKey: import.meta.env.KORYLA_API_KEY ?? '',
  apiUrl: import.meta.env.KORYLA_API_URL ?? 'https://koryla.com',
})

const active = result?.variant.name ?? 'control'

if (result?.isNewAssignment) {
  Astro.cookies.set(result.cookieName, result.variantId, {
    maxAge: 60 * 60 * 24 * 30,
    sameSite: 'lax',
    path: '/',
  })
}
---
<slot name={active} />
```

- [ ] **Step 2: Crear `src/components/Variant.astro`**

```astro
---
interface Props {
  name?: string  // solo documentación — el slot se define con slot="name" en el uso
}
---
<slot />
```

- [ ] **Step 3: Commit**

```bash
git add src/components/Experiment.astro src/components/Variant.astro
git commit -m "feat: add Experiment and Variant Astro components"
```

---

## Task 4: Página Demo SDK (`demo-sdk.astro`)

Demuestra SDK puro: misma URL, el CTA cambia según `?utm_text=variation-1`.  
Usa el componente `<Experiment>` creado en Task 3.

**Files:**
- Create: `src/pages/demo-sdk.astro`

- [ ] **Step 1: Crear `src/pages/demo-sdk.astro`**

Reemplazar `<SDK_EXP_ID>` con el UUID obtenido en Task 1 Step 2.

```astro
---
import Layout from '../layouts/Layout.astro'
import Experiment from '../components/Experiment.astro'
import Variant from '../components/Variant.astro'

const GH = 'https://github.com/andresclua/koryla-astro-demo-example/blob/main'
---
<Layout title="Demo SDK" variant="SDK — /demo-sdk">
  <main style="max-width:900px;margin:0 auto;padding:80px 40px;text-align:center">

    <!-- Explicación del experimento -->
    <div style="display:inline-block;background:#e0e7ff;color:#3730a3;font-size:12px;font-weight:700;padding:4px 12px;border-radius:999px;margin-bottom:16px;letter-spacing:.3px">
      SDK EXPERIMENT
    </div>
    <h1 style="font-size:clamp(36px,5vw,60px);font-weight:800;line-height:1.1;letter-spacing:-2px;margin-bottom:16px;color:#0F2235">
      Component-level A/B test
    </h1>
    <p style="font-size:17px;color:#6b7280;max-width:560px;margin:0 auto 48px;line-height:1.6">
      Same URL, different CTA text. No URL rewrite needed — the variant is assigned in the Astro frontmatter using <code style="background:#f3f4f6;padding:2px 6px;border-radius:4px">&lt;Experiment&gt;</code>.
    </p>

    <!-- El experimento real -->
    <Experiment id="<SDK_EXP_ID>">
      <Variant slot="control">
        <a href="/thank-you" style="display:inline-block;background:#C96A3F;color:#fff;padding:16px 40px;border-radius:14px;font-weight:700;font-size:17px;text-decoration:none">
          Start testing free →
        </a>
        <p style="font-size:12px;color:#9ca3af;margin-top:12px">control · default variant</p>
      </Variant>
      <Variant slot="b">
        <a href="/thank-you" style="display:inline-block;background:#0F2235;color:#fff;padding:16px 40px;border-radius:14px;font-weight:700;font-size:17px;text-decoration:none">
          A/B test in 5 min →
        </a>
        <p style="font-size:12px;color:#9ca3af;margin-top:12px">variant b · triggered by <code>?utm_text=variation-1</code></p>
      </Variant>
    </Experiment>

    <!-- Instrucción de prueba -->
    <div style="margin-top:48px;background:#f8faff;border:1px solid #c7d2fe;border-radius:16px;padding:28px;text-align:left">
      <p style="font-size:13px;font-weight:700;color:#3730a3;margin-bottom:12px">🧪 HOW TO TEST</p>
      <p style="font-size:14px;color:#4b5563;margin-bottom:8px">1. Open this page without UTM → see control CTA (terracotta)</p>
      <p style="font-size:14px;color:#4b5563;margin-bottom:16px">2. Add <code style="background:#e0e7ff;padding:2px 6px;border-radius:4px">?utm_text=variation-1</code> to the URL → see variant B CTA (navy)</p>
      <a href="{GH}/src/pages/demo-sdk.astro" target="_blank" style="display:inline-flex;align-items:center;gap:6px;background:#3730a3;color:#fff;padding:10px 18px;border-radius:8px;font-size:13px;font-weight:600;text-decoration:none">
        View demo-sdk.astro on GitHub →
      </a>
    </div>

    <!-- Diagram edge vs SDK -->
    <div style="margin-top:32px;background:#0F2235;border-radius:16px;padding:28px;text-align:left;color:#e2e8f0;font-size:13px;font-family:monospace;line-height:2">
      <span style="color:#94a3b8">// What runs where</span><br/>
      <span style="color:#f59e0b">Edge function</span> → NOT involved (no URL rewrite for SDK experiments)<br/>
      <span style="color:#6366f1">Astro frontmatter</span> → getVariant() reads cookie + UTM param → assigns variant<br/>
      <span style="color:#6366f1">Astro frontmatter</span> → sets <code>ky_&lt;id&gt;</code> cookie (sticky 30 days)<br/>
      <span style="color:#6366f1">&lt;Experiment&gt;</span> → renders only the active <code>&lt;slot&gt;</code>
    </div>
  </main>
</Layout>
```

- [ ] **Step 2: Verificar compilación**

```bash
cd /Users/andres/Documents/Personal/dev/personal/splitr/koryla-astro-demo-example
npx astro check
```

Expected: sin errores de tipo

- [ ] **Step 3: Commit**

```bash
git add src/pages/demo-sdk.astro
git commit -m "feat: add demo-sdk page (SDK puro con UTM rules)"
```

---

## Task 5: Páginas Demo Edge (`demo-edge.astro` + `demo-edge-b.astro`)

Demuestra Edge puro: dos páginas separadas, el edge function reescribe la URL.

**Files:**
- Create: `src/pages/demo-edge.astro`
- Create: `src/pages/demo-edge-b.astro`

- [ ] **Step 1: Crear `src/pages/demo-edge.astro`** (control — layout centrado)

```astro
---
import Layout from '../layouts/Layout.astro'
const GH = 'https://github.com/andresclua/koryla-astro-demo-example/blob/main'
---
<Layout title="Demo Edge" variant="control — /demo-edge">
  <main style="max-width:900px;margin:0 auto;padding:80px 40px;text-align:center">

    <div style="display:inline-block;background:#FEF0E8;color:#C96A3F;font-size:12px;font-weight:700;padding:4px 12px;border-radius:999px;margin-bottom:16px">
      EDGE EXPERIMENT · CONTROL
    </div>

    <h1 style="font-size:clamp(36px,5vw,60px);font-weight:800;line-height:1.1;letter-spacing:-2px;margin-bottom:16px;color:#0F2235">
      You're seeing the<br/>control variant
    </h1>
    <p style="font-size:17px;color:#6b7280;max-width:560px;margin:0 auto 40px;line-height:1.6">
      The Netlify edge function assigned you to <strong>control</strong>. The browser always sees <code>/demo-edge</code> — no redirect happened.
    </p>

    <a href="/thank-you" style="display:inline-block;background:#C96A3F;color:#fff;padding:16px 40px;border-radius:14px;font-weight:700;font-size:17px;text-decoration:none">
      Get started free →
    </a>

    <!-- Diagrama -->
    <div style="margin-top:48px;background:#0F2235;border-radius:16px;padding:28px;text-align:left;color:#e2e8f0;font-size:13px;font-family:monospace;line-height:2">
      <span style="color:#94a3b8">// What the edge function did for YOU</span><br/>
      <span style="color:#f59e0b">Request</span>: GET /demo-edge<br/>
      <span style="color:#f59e0b">Edge</span>: cookie? no → random assignment → <span style="color:#86efac">control (50%)</span><br/>
      <span style="color:#f59e0b">Edge</span>: isSamePath → context.next() (no rewrite)<br/>
      <span style="color:#f59e0b">Edge</span>: Set-Cookie ky_&lt;id&gt;=&lt;control-uuid&gt;<br/>
      <span style="color:#f59e0b">Browser</span>: receives /demo-edge content ✓<br/>
      <br/>
      <span style="color:#94a3b8">// 50% of users get /demo-edge-b instead (rewritten, same browser URL)</span>
    </div>

    <div style="margin-top:24px">
      <a href="{GH}/src/pages/demo-edge.astro" target="_blank" style="display:inline-flex;align-items:center;gap:6px;background:#C96A3F;color:#fff;padding:10px 18px;border-radius:8px;font-size:13px;font-weight:600;text-decoration:none">
        View demo-edge.astro on GitHub →
      </a>
    </div>
  </main>
</Layout>
```

- [ ] **Step 2: Crear `src/pages/demo-edge-b.astro`** (variante B — layout 2 columnas)

```astro
---
import Layout from '../layouts/Layout.astro'
const GH = 'https://github.com/andresclua/koryla-astro-demo-example/blob/main'
---
<Layout title="Demo Edge" variant="variant-b — /demo-edge-b">
  <main style="max-width:1100px;margin:0 auto;padding:80px 40px">
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:64px;align-items:center">

      <div>
        <div style="display:inline-block;background:#FEF0E8;color:#C96A3F;font-size:12px;font-weight:700;padding:4px 12px;border-radius:999px;margin-bottom:16px">
          EDGE EXPERIMENT · VARIANT B
        </div>
        <h1 style="font-size:clamp(32px,4vw,52px);font-weight:800;line-height:1.1;letter-spacing:-1.5px;margin-bottom:16px;color:#0F2235">
          You're seeing<br/><span style="color:#C96A3F">Variant B</span>
        </h1>
        <p style="font-size:16px;color:#4b5563;line-height:1.65;margin-bottom:32px">
          The edge function rewrote your request from <code>/demo-edge</code> to <code>/demo-edge-b</code> — completely transparent to the browser.
        </p>
        <a href="/thank-you" style="display:inline-block;background:#0F2235;color:#fff;padding:14px 28px;border-radius:12px;font-weight:700;font-size:15px;text-decoration:none">
          Start your first test →
        </a>
      </div>

      <div style="background:#F5EDE0;border-radius:20px;padding:28px">
        <div style="font-size:13px;font-weight:700;color:#C96A3F;margin-bottom:16px">Edge function did this:</div>
        {[
          ['1.', 'Intercepted GET /demo-edge'],
          ['2.', 'No cookie found → 50/50 random → you got variant B'],
          ['3.', 'Rewrote URL to /demo-edge-b'],
          ['4.', 'Set-Cookie ky_<id>=<variant-b-uuid>'],
          ['5.', 'Your browser still shows /demo-edge ✓'],
        ].map(([n, t]) => (
          <div style="display:flex;gap:12px;margin-bottom:12px">
            <span style="color:#C96A3F;font-weight:700;min-width:20px">{n}</span>
            <span style="color:#4b5563;font-size:14px">{t}</span>
          </div>
        ))}
        <div style="margin-top:20px">
          <a href="{GH}/netlify/edge-functions/koryla.ts" target="_blank" style="display:inline-flex;align-items:center;gap:6px;background:#C96A3F;color:#fff;padding:10px 18px;border-radius:8px;font-size:12px;font-weight:600;text-decoration:none">
            View koryla.ts on GitHub →
          </a>
        </div>
      </div>
    </div>
  </main>
</Layout>
```

- [ ] **Step 3: Verificar compilación**

```bash
npx astro check
```

Expected: sin errores

- [ ] **Step 4: Commit**

```bash
git add src/pages/demo-edge.astro src/pages/demo-edge-b.astro
git commit -m "feat: add demo-edge pages (Edge puro — control + variante B)"
```

---

## Task 6: Páginas Demo Combined (`demo-combined.astro` + `demo-combined-b.astro`)

Demuestra Edge + SDK: el query param `?variant=b` fuerza el edge rewrite; dentro de la página, un `<Experiment>` SDK añade detalle fino.

**Files:**
- Create: `src/pages/demo-combined.astro`
- Create: `src/pages/demo-combined-b.astro`

- [ ] **Step 1: Crear `src/pages/demo-combined.astro`** (control)

Reemplazar `<SDK_EXP_ID>` con el UUID del experimento SDK (mismo componente reutilizado aquí para el badge).

```astro
---
import Layout from '../layouts/Layout.astro'
import Experiment from '../components/Experiment.astro'
import Variant from '../components/Variant.astro'
const GH = 'https://github.com/andresclua/koryla-astro-demo-example/blob/main'
---
<Layout title="Demo Combined" variant="control — /demo-combined">
  <main style="max-width:900px;margin:0 auto;padding:80px 40px;text-align:center">

    <div style="display:inline-block;background:#d1fae5;color:#065f46;font-size:12px;font-weight:700;padding:4px 12px;border-radius:999px;margin-bottom:16px">
      COMBINED: EDGE + SDK · CONTROL
    </div>

    <h1 style="font-size:clamp(36px,5vw,60px);font-weight:800;line-height:1.1;letter-spacing:-2px;margin-bottom:16px;color:#0F2235">
      Two layers of control
    </h1>
    <p style="font-size:17px;color:#6b7280;max-width:560px;margin:0 auto 40px;line-height:1.6">
      Edge handles the <strong>big split</strong> (which page). SDK handles the <strong>fine detail</strong> (which component). Add <code style="background:#f3f4f6;padding:2px 6px;border-radius:4px">?variant=b</code> to the URL to force variant B.
    </p>

    <!-- SDK experiment dentro del Combined -->
    <Experiment id="<SDK_EXP_ID>">
      <Variant slot="control">
        <a href="/thank-you" style="display:inline-block;background:#C96A3F;color:#fff;padding:16px 40px;border-radius:14px;font-weight:700;font-size:17px;text-decoration:none">
          Start testing free →
        </a>
      </Variant>
      <Variant slot="b">
        <a href="/thank-you" style="display:inline-block;background:#0F2235;color:#fff;padding:16px 40px;border-radius:14px;font-weight:700;font-size:17px;text-decoration:none">
          A/B test in 5 min →
        </a>
      </Variant>
    </Experiment>

    <div style="margin-top:48px;background:#0F2235;border-radius:16px;padding:28px;text-align:left;color:#e2e8f0;font-size:13px;font-family:monospace;line-height:2">
      <span style="color:#94a3b8">// Two layers for this request</span><br/>
      <span style="color:#f59e0b">Layer 1 — Edge</span>: /demo-combined → assigned control → context.next()<br/>
      <span style="color:#6366f1">Layer 2 — SDK</span>: &lt;Experiment&gt; → UTM check → assigned variant (cookie)<br/>
      <br/>
      <span style="color:#94a3b8">// Try: /demo-combined?variant=b → edge rewrites to /demo-combined-b</span>
    </div>

    <div style="margin-top:24px">
      <a href="{GH}/src/pages/demo-combined.astro" target="_blank" style="display:inline-flex;align-items:center;gap:6px;background:#059669;color:#fff;padding:10px 18px;border-radius:8px;font-size:13px;font-weight:600;text-decoration:none">
        View demo-combined.astro on GitHub →
      </a>
    </div>
  </main>
</Layout>
```

- [ ] **Step 2: Crear `src/pages/demo-combined-b.astro`** (variante B — layout 2 col)

```astro
---
import Layout from '../layouts/Layout.astro'
import Experiment from '../components/Experiment.astro'
import Variant from '../components/Variant.astro'
const GH = 'https://github.com/andresclua/koryla-astro-demo-example/blob/main'
---
<Layout title="Demo Combined" variant="variant-b — /demo-combined-b">
  <main style="max-width:1100px;margin:0 auto;padding:80px 40px">
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:64px;align-items:start">

      <div>
        <div style="display:inline-block;background:#d1fae5;color:#065f46;font-size:12px;font-weight:700;padding:4px 12px;border-radius:999px;margin-bottom:16px">
          COMBINED: EDGE + SDK · VARIANT B
        </div>
        <h1 style="font-size:clamp(30px,4vw,50px);font-weight:800;line-height:1.1;letter-spacing:-1.5px;margin-bottom:16px;color:#0F2235">
          Edge brought you here.<br/><span style="color:#059669">SDK handles the rest.</span>
        </h1>
        <p style="font-size:16px;color:#4b5563;line-height:1.65;margin-bottom:24px">
          The edge function rewrote <code>/demo-combined?variant=b</code> to this page. Now the SDK experiment below assigns the CTA independently.
        </p>

        <!-- SDK experiment dentro del Combined-B -->
        <Experiment id="<SDK_EXP_ID>">
          <Variant slot="control">
            <a href="/thank-you" style="display:inline-block;background:#C96A3F;color:#fff;padding:14px 28px;border-radius:12px;font-weight:700;font-size:15px;text-decoration:none">
              Start testing free →
            </a>
          </Variant>
          <Variant slot="b">
            <a href="/thank-you" style="display:inline-block;background:#0F2235;color:#fff;padding:14px 28px;border-radius:12px;font-weight:700;font-size:15px;text-decoration:none">
              A/B test in 5 min →
            </a>
          </Variant>
        </Experiment>
      </div>

      <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:20px;padding:28px">
        <div style="font-size:13px;font-weight:700;color:#059669;margin-bottom:16px">What happened (2 layers):</div>
        {[
          ['Edge Layer', '?variant=b matched rule → rewrote to /demo-combined-b'],
          ['Edge Layer', 'Set cookie ky_<edge-id>=<b-uuid>'],
          ['SDK Layer', '<Experiment> read cookie + UTM → assigned CTA variant'],
          ['SDK Layer', 'Rendered only the active <slot>'],
          ['Result', 'Browser sees /demo-combined, gets variant B content'],
        ].map(([label, desc]) => (
          <div style="margin-bottom:12px">
            <span style="font-size:11px;font-weight:700;color:#059669;text-transform:uppercase">{label}</span>
            <p style="font-size:13px;color:#4b5563;margin-top:2px">{desc}</p>
          </div>
        ))}
        <div style="margin-top:20px">
          <a href="{GH}/netlify/edge-functions/koryla.ts" target="_blank" style="display:inline-flex;align-items:center;gap:6px;background:#059669;color:#fff;padding:10px 18px;border-radius:8px;font-size:12px;font-weight:600;text-decoration:none">
            View koryla.ts on GitHub →
          </a>
        </div>
      </div>
    </div>
  </main>
</Layout>
```

- [ ] **Step 3: Verificar compilación**

```bash
npx astro check
```

Expected: sin errores

- [ ] **Step 4: Commit**

```bash
git add src/pages/demo-combined.astro src/pages/demo-combined-b.astro
git commit -m "feat: add demo-combined pages (Edge + SDK combinado)"
```

---

## Task 7: Actualizar la edge function con rule matching

La edge function actual no chequea reglas UTM. Para que `?variant=b` fuerce la variante B en el experimento combined, necesitamos añadir `findRuleMatch()`.

**Files:**
- Modify: `netlify/edge-functions/koryla.ts`

- [ ] **Step 1: Añadir interfaz `Rule` y `findRuleMatch` al engine**

En `netlify/edge-functions/koryla.ts`, localizar la interfaz `Variant` (línea ~7) y añadir `rules?`:

```typescript
interface Variant {
  id: string; name: string; traffic_weight: number
  target_url: string; is_control: boolean; rules?: { param: string; value: string }[]
}
```

- [ ] **Step 2: Añadir función `findRuleMatch` dentro de `createSplitEngine`**

Justo antes de la función `process`, añadir:

```typescript
function findRuleMatch(variants: Variant[], searchParams: URLSearchParams): Variant | null {
  for (const v of variants) {
    if (!v.rules?.length) continue
    for (const rule of v.rules) {
      if (searchParams.get(rule.param) === rule.value) return v
    }
  }
  return null
}
```

- [ ] **Step 3: Usar `findRuleMatch` en la función `process`**

Localizar este bloque en `process` (después de encontrar el experiment):

```typescript
// ANTES:
if (!variantId || !experiment.variants.find(v => v.id === variantId)) {
  variantId = assignVariant(experiment.variants)
  isNewAssignment = true
}
```

Reemplazar con:

```typescript
// DESPUÉS:
const ruleMatch = findRuleMatch(experiment.variants, url.searchParams)
if (ruleMatch && ruleMatch.id !== variantId) {
  variantId = ruleMatch.id
  isNewAssignment = true
} else if (!variantId || !experiment.variants.find(v => v.id === variantId)) {
  variantId = assignVariant(experiment.variants)
  isNewAssignment = true
}
```

- [ ] **Step 4: Verificar que compila TypeScript**

```bash
npx tsc --noEmit
```

Expected: sin errores

- [ ] **Step 5: Commit**

```bash
git add netlify/edge-functions/koryla.ts
git commit -m "feat: add UTM/query param rule matching to edge function"
```

---

## Task 8: Documentación `.md` (3 archivos para principiantes)

**Files:**
- Create: `docs/sdk-experiment.md`
- Create: `docs/edge-experiment.md`
- Create: `docs/combined-experiment.md`

- [ ] **Step 1: Crear `docs/sdk-experiment.md`**

```markdown
# Cómo funciona un experimento SDK en Koryla

> **En una frase:** Misma URL, contenido diferente según un parámetro UTM. Todo pasa en el servidor — el navegador nunca ve JS de A/B testing.

## Qué estamos haciendo

Tenemos una página (`/demo-sdk`) con un botón CTA. Queremos mostrar dos versiones:
- **Control** (sin UTM): "Start testing free →"
- **Variante B** (`?utm_text=variation-1`): "A/B test in 5 min →"

## Qué NO necesitamos

- ❌ Dos páginas separadas
- ❌ Cambios en el edge function
- ❌ JavaScript en el cliente
- ❌ Librería de A/B testing en el bundle

## Las dos capas del sistema

```
Tu navegador
     │
     ▼
┌─────────────────────────────────────┐
│  Edge function (netlify/koryla.ts)  │
│  ─ Ve la URL /demo-sdk              │
│  ─ Este experimento es tipo         │
│    "component" con target_url=""    │
│  ─ Devuelve null → NO hace nada     │
└─────────────────────────────────────┘
     │  (pasa a Astro sin tocar)
     ▼
┌─────────────────────────────────────┐
│  Astro SSR (src/pages/demo-sdk.astro) │
│  ─ <Experiment id="..."> se ejecuta │
│    en el FRONTMATTER (servidor)     │
│  ─ Lee ?utm_text=variation-1        │
│  ─ Si coincide → variante B         │
│  ─ Si no → control (peso 100%)      │
│  ─ Pone cookie sticky 30 días       │
│  ─ Renderiza solo el slot activo    │
└─────────────────────────────────────┘
     │
     ▼
HTML final al navegador (sin JS de A/B)
```

## El código en tu página Astro

```astro
---
import Experiment from '../components/Experiment.astro'
import Variant from '../components/Variant.astro'
---

<Experiment id="<tu-experiment-uuid>">
  <Variant slot="control">
    <button>Start testing free →</button>
  </Variant>
  <Variant slot="b">
    <button>A/B test in 5 min →</button>
  </Variant>
</Experiment>
```

**¿Por qué `slot="control"` y no `name="control"`?**  
En Astro, los hijos de un componente se pasan como *slots*, no como props. El atributo `slot="control"` le dice a Astro qué slot del `<Experiment>` debe llenar. Es la forma idiomática de Astro de hacer lo que en React harías con `<Variant name="control">`.

## Cómo funciona `Experiment.astro` internamente

```astro
---
// 1. Pide el config del experimento a la API de Koryla (caché 60s)
// 2. Lee las cookies del request
// 3. Si hay regla UTM que coincide → usa esa variante
// 4. Si no hay cookie → asigna aleatoriamente según traffic_weight
// 5. Pone la cookie para la próxima visita
const active = result?.variant.name ?? 'control'  // "control" o "b"
---
<slot name={active} />  <!-- Solo renderiza el slot activo -->
```

## Cómo configurar el experimento en el dashboard

| Campo | Valor |
|-------|-------|
| Type | SDK (component) |
| Base URL | https://tu-sitio.com/tu-pagina |
| Variant B — Rules | UTM param: `utm_text` = `variation-1` |
| Variant B — Weight | 0% (solo se activa por regla, no aleatoriamente) |
| Control — Weight | 100% (todo el tráfico sin UTM) |

## Probarlo localmente

```bash
# Control (texto por defecto)
open http://localhost:4321/demo-sdk

# Variante B (texto alternativo)
open "http://localhost:4321/demo-sdk?utm_text=variation-1"
```
```

- [ ] **Step 2: Crear `docs/edge-experiment.md`**

```markdown
# Cómo funciona un experimento Edge en Koryla

> **En una frase:** El servidor reescribe la URL antes de que Astro renderice — el navegador nunca sabe que existe una segunda página.

## Qué estamos haciendo

Tenemos dos páginas separadas:
- `src/pages/demo-edge.astro` → layout centrado (control)
- `src/pages/demo-edge-b.astro` → layout 2 columnas (variante B)

El navegador siempre ve `/demo-edge`. El edge function decide en silencio qué página sirve.

## Por qué "Edge"

"Edge" significa que el código corre en el borde de la red (CDN/Netlify), antes de llegar a tu servidor. En Netlify se llama "Edge Function" y corre en Deno (no Node.js).

## El flujo completo

```
GET /demo-edge
     │
     ▼
┌──────────────────────────────────────────┐
│  netlify/edge-functions/koryla.ts         │
│                                          │
│  1. Pide config de Koryla API (caché 60s)│
│  2. Encuentra experimento para /demo-edge│
│  3. ¿Cookie ky_<id>? → usa variante      │
│     guardada (sticky)                    │
│  4. ¿Sin cookie? → random 50/50          │
│                                          │
│  Si control:                             │
│    context.next() → sirve demo-edge.astro│
│                                          │
│  Si variante B:                          │
│    context.rewrite('/demo-edge-b')       │
│    → sirve demo-edge-b.astro             │
│    → navegador sigue viendo /demo-edge   │
│                                          │
│  5. Set-Cookie ky_<id>=<variant-uuid>    │
└──────────────────────────────────────────┘
     │
     ▼
HTML de control o variante B
(mismo URL, distinto contenido)
```

## Lo que NO toca el edge function

- ❌ No modifica HTML
- ❌ No inyecta JavaScript
- ❌ No hace redirect (302) — el navegador no se entera
- ❌ No afecta al ranking SEO

## Configurar en el dashboard

| Campo | Valor |
|-------|-------|
| Type | Edge |
| Base URL | https://tu-sitio.com/demo-edge |
| Control — Target URL | https://tu-sitio.com/demo-edge |
| Variant B — Target URL | https://tu-sitio.com/demo-edge-b |
| Traffic split | 50% / 50% |

## Probarlo

El 50% de las visitas ven la variante B. Para forzarla, borra la cookie `ky_<id>` y recarga varias veces hasta que te toque variante B. O usa el override en el dashboard de Koryla.
```

- [ ] **Step 3: Crear `docs/combined-experiment.md`**

```markdown
# Cómo funciona un experimento Edge + SDK combinado

> **En una frase:** Edge decide qué página sirves (layout grande); SDK decide qué componente renders dentro (detalle fino). Dos experimentos independientes, dos niveles de control.

## Cuándo usarlo

Cuando el test principal cambia la estructura de la página (layout, secciones), pero dentro de esa página quieres testear variantes más pequeñas (un botón, un headline, un banner).

## El flujo con `?variant=b`

```
GET /demo-combined?variant=b
     │
     ▼
┌──────────────────────────────────┐
│  Edge function (koryla.ts)       │
│  ─ Lee query param variant=b     │
│  ─ Coincide con rule del exp.    │
│  ─ context.rewrite('/demo-combined-b') │
│  ─ Set-Cookie ky_<edge-id>=<b>   │
└──────────────────────────────────┘
     │  (reescribe a demo-combined-b)
     ▼
┌──────────────────────────────────┐
│  Astro SSR (demo-combined-b.astro) │
│  ─ <Experiment id="sdk-id">      │
│    corre en el frontmatter       │
│  ─ Lee cookie del experimento SDK│
│  ─ Asigna variante CTA           │
│  ─ Renderiza el slot activo      │
└──────────────────────────────────┘
     │
     ▼
HTML final: layout variante B + CTA según SDK
```

## Dos experimentos, dos cookies

El sistema pone **dos cookies separadas**:
- `ky_<edge-exp-id>` → decide qué PÁGINA muestra el edge
- `ky_<sdk-exp-id>` → decide qué COMPONENTE muestra el SDK

Cada usuario puede estar en la combinación: control/control, control/b, b/control, o b/b. Esto te da una matriz 2×2 de datos.

## Configurar en el dashboard

**Experimento Edge (Combined):**
| Campo | Valor |
|-------|-------|
| Type | Edge |
| Base URL | /demo-combined |
| Variant B — Target URL | /demo-combined-b |
| Variant B — Rules | query param: `variant` = `b` |

**Experimento SDK (CTA):**
| Campo | Valor |
|-------|-------|
| Type | SDK |
| Base URL | /demo-combined (o cualquier página) |
| Variant B — Rules | UTM param: `utm_text` = `variation-1` |

## Cuándo NO usarlo

Si el test es simple (un texto, un color), usa solo SDK. Si cambias páginas completas sin detalle fino, usa solo Edge. El combinado añade complejidad — úsalo cuando necesites los dos niveles realmente.
```

- [ ] **Step 4: Commit**

```bash
git add docs/sdk-experiment.md docs/edge-experiment.md docs/combined-experiment.md
git commit -m "docs: add beginner-friendly documentation for 3 experiment types"
```

---

## Task 9: Actualizar el índice y la nav

**Files:**
- Modify: `src/pages/index.astro`
- Modify: `src/layouts/Layout.astro`

- [ ] **Step 1: Leer el índice actual**

```bash
cat /Users/andres/Documents/Personal/dev/personal/splitr/koryla-astro-demo-example/src/pages/index.astro
```

- [ ] **Step 2: Añadir las 3 nuevas demos al índice**

En `src/pages/index.astro`, añadir las 3 nuevas tarjetas de demo en la sección de experimentos. El diseño exacto depende del layout actual (leer primero en Step 1). La tarjeta debe incluir:
- Título del demo
- Tipo (SDK / Edge / Combined)
- URL destino
- Una línea de descripción

Ejemplo de una tarjeta:
```html
<a href="/demo-sdk" style="display:block;border:1px solid #c7d2fe;background:#f8faff;border-radius:14px;padding:20px;text-decoration:none">
  <div style="font-size:11px;font-weight:700;color:#6366f1;margin-bottom:6px">SDK</div>
  <div style="font-weight:700;color:#0F2235;margin-bottom:4px">Demo SDK — UTM Text</div>
  <div style="font-size:13px;color:#6b7280">Misma URL, CTA distinto según ?utm_text=</div>
</a>
<a href="/demo-edge" style="display:block;border:1px solid #fde8d8;background:#fff8f5;border-radius:14px;padding:20px;text-decoration:none">
  <div style="font-size:11px;font-weight:700;color:#C96A3F;margin-bottom:6px">EDGE</div>
  <div style="font-weight:700;color:#0F2235;margin-bottom:4px">Demo Edge — Layout</div>
  <div style="font-size:13px;color:#6b7280">URL rewrite transparente entre 2 páginas</div>
</a>
<a href="/demo-combined" style="display:block;border:1px solid #bbf7d0;background:#f0fdf4;border-radius:14px;padding:20px;text-decoration:none">
  <div style="font-size:11px;font-weight:700;color:#059669;margin-bottom:6px">EDGE + SDK</div>
  <div style="font-weight:700;color:#0F2235;margin-bottom:4px">Demo Combined</div>
  <div style="font-size:13px;color:#6b7280">Edge para layout, SDK para componente fino</div>
</a>
```

- [ ] **Step 3: Actualizar la nav en `Layout.astro`**

Añadir link a las demos en la barra de navegación (junto a los links de Pricing y Layout demo existentes):

```html
<a href="/demo-sdk" style="color:#6366f1;font-weight:600">SDK</a>
<a href="/demo-edge" style="color:#C96A3F;font-weight:600">Edge</a>
<a href="/demo-combined" style="color:#059669;font-weight:600">Combined</a>
```

- [ ] **Step 4: Commit**

```bash
git add src/pages/index.astro src/layouts/Layout.astro
git commit -m "feat: add 3 demo pages to index and nav"
```

---

## Task 10: Verificación final

- [ ] **Step 1: Build local**

```bash
cd /Users/andres/Documents/Personal/dev/personal/splitr/koryla-astro-demo-example
npm run build
```

Expected: sin errores de build

- [ ] **Step 2: Verificar experimentos en Supabase**

```bash
curl -s "https://<SUPABASE_PROJECT>.supabase.co/rest/v1/experiments?workspace_id=eq.4eda79d1-85e8-4d0a-bcaf-e4a5996f8a28&select=id,name,type,status&order=created_at" \
  -H "apikey: <SUPABASE_API_KEY>" \
  -H "Authorization: Bearer <SUPABASE_API_KEY>"
```

Expected: 5 experimentos activos (2 existentes + 3 nuevos)

- [ ] **Step 3: Commit final y push**

```bash
git add -A
git commit -m "chore: final verification — 3 demos complete"
git push
```
