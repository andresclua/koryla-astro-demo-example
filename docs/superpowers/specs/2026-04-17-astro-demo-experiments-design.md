# Design: Koryla Astro Demo — 3 Experiments + Supabase Setup

**Date:** 2026-04-17  
**Workspace:** Koryla Demo (Astro) — `slug: koryla-demo`, `id: 4eda79d1-85e8-4d0a-bcaf-e4a5996f8a28`

---

## Objetivo

Construir 3 páginas demo en `astro-demo.koryla.com` que demuestren los tres modos de A/B testing de Koryla, con documentación `.md` explicada para principiantes. Cada página vive en su propia URL, tiene su propio experimento en Supabase, y genera su propio archivo `.md` de documentación.

---

## La frontera más importante: Edge vs SDK

```
REQUEST del navegador
       │
       ▼
┌──────────────────────────────────────┐
│  CAPA EDGE (netlify edge function)   │  ← Corre en Deno, antes de Astro
│  • Lee cookies                       │
│  • Consulta API Koryla (caché 60s)   │
│  • Reescribe URL → context.rewrite() │
│  • Set-Cookie en la respuesta        │
│  • Zero JS en el cliente             │
└──────────────────────────────────────┘
       │  (la petición ya tiene la URL correcta)
       ▼
┌──────────────────────────────────────┐
│  CAPA SDK (Astro SSR — frontmatter)  │  ← Corre en Node/Deno, en Astro
│  • Experiment.astro llama getVariant │
│  • Lee cookies del request           │
│  • Asigna variante si no hay cookie  │
│  • Pone Set-Cookie en Astro.cookies  │
│  • Renderiza solo el slot activo     │
└──────────────────────────────────────┘
       │
       ▼
    HTML al navegador (sin JS de A/B)
```

**Cuándo usar cada uno:**
- **Edge solo**: cambias layout completo, dos páginas separadas, zero flicker garantizado
- **SDK solo**: cambias un componente/texto, misma URL, trigger por UTM/query param
- **Edge + SDK**: el edge decide la página, el SDK hace ajuste fino dentro de esa página

---

## Experimento 1: `/demo-sdk` — SDK puro con UTM param

### Qué demuestra
Cambio de texto de CTA según `?utm_text=variation-1`. Sin edge function involucrada. Todo sucede en el frontmatter de Astro SSR.

### Supabase
```json
{
  "name": "Demo SDK — UTM Text",
  "type": "component",
  "status": "active",
  "base_url": "https://astro-demo.koryla.com/demo-sdk",
  "conversion_url": "https://astro-demo.koryla.com/thank-you",
  "variants": [
    { "name": "control", "is_control": true, "traffic_weight": 100, "target_url": "", "rules": [] },
    { "name": "b", "is_control": false, "traffic_weight": 0, "target_url": "", "rules": [{"param": "utm_text", "value": "variation-1"}] }
  ]
}
```

### Archivos Astro
- `src/components/Experiment.astro` ← componente nuevo (shared con demos 1 y 3)
- `src/components/Variant.astro` ← thin wrapper para semántica
- `src/pages/demo-sdk.astro` ← página demo

### Patrón de código
```astro
---
import Experiment from '../components/Experiment.astro'
import Variant from '../components/Variant.astro'
---
<Experiment id="<experiment-uuid>">
  <Variant slot="control">Start testing free →</Variant>
  <Variant slot="b">A/B test in 5 min →</Variant>
</Experiment>
```

### Doc generada
`docs/sdk-experiment.md`

---

## Experimento 2: `/demo-edge` — Edge puro

### Qué demuestra
URL rewrite transparente a dos páginas separadas. El navegador siempre ve `/demo-edge` pero recibe control o variante B. Sin componentes SDK.

### Supabase
```json
{
  "name": "Demo Edge — Layout",
  "type": "edge",
  "status": "active",
  "base_url": "https://astro-demo.koryla.com/demo-edge",
  "conversion_url": "https://astro-demo.koryla.com/thank-you",
  "variants": [
    { "name": "control", "is_control": true, "traffic_weight": 50, "target_url": "https://astro-demo.koryla.com/demo-edge" },
    { "name": "b", "is_control": false, "traffic_weight": 50, "target_url": "https://astro-demo.koryla.com/demo-edge-b" }
  ]
}
```

### Archivos Astro
- `src/pages/demo-edge.astro` ← control (layout A)
- `src/pages/demo-edge-b.astro` ← variante B (layout B, nunca se ve la URL)
- Edge function `netlify/edge-functions/koryla.ts` ← agregar `/demo-edge` a los paths

### Doc generada
`docs/edge-experiment.md`

---

## Experimento 3: `/demo-combined` — Edge + SDK

### Qué demuestra
Query param `?variant=b` fuerza el edge rewrite (vía UTM rule en dashboard). Dentro de la página, un `<Experiment>` SDK hace ajuste fino de un componente secundario.

### Supabase
```json
{
  "name": "Demo Combined — Edge + SDK",
  "type": "edge",
  "status": "active",
  "base_url": "https://astro-demo.koryla.com/demo-combined",
  "conversion_url": "https://astro-demo.koryla.com/thank-you",
  "variants": [
    { "name": "control", "is_control": true, "traffic_weight": 50, "target_url": "https://astro-demo.koryla.com/demo-combined" },
    { "name": "b", "is_control": false, "traffic_weight": 50, "target_url": "https://astro-demo.koryla.com/demo-combined-b", "rules": [{"param": "variant", "value": "b"}] }
  ]
}
```

### Archivos Astro
- `src/pages/demo-combined.astro` ← control
- `src/pages/demo-combined-b.astro` ← variante B (rewrite desde edge)
- `<Experiment>` dentro de ambas páginas para componente de detalle

### Doc generada
`docs/combined-experiment.md`

---

## Componentes nuevos

### `src/components/Experiment.astro`
Fetches variant via `getVariant()` en el frontmatter. Renderiza solo el slot con nombre igual al variant activo.

```astro
---
const { id } = Astro.props
const result = await getVariant(Astro.request, id, {
  apiKey: import.meta.env.KORYLA_API_KEY,
  apiUrl: import.meta.env.KORYLA_API_URL,
})
// getVariant devuelve variantId (UUID) — necesitamos el nombre para el slot.
// VariantResult se extiende para incluir variantName (e.g. "control", "b").
const active = result?.variantName ?? 'control'
if (result?.isNewAssignment) {
  Astro.cookies.set(result.cookieName, result.variantId, { maxAge: 2592000, sameSite: 'lax', path: '/' })
}
---
<slot name={active} />
```

**Nota de implementación:** `src/lib/getVariant.ts` debe extenderse para devolver también `variantName` (el campo `name` de la variante asignada, no su UUID). El UUID va en la cookie; el nombre va en el slot.

### `src/components/Variant.astro`
Thin wrapper semántico. El `slot="control"` se pone en el uso (no en el componente).

```astro
---
// solo para semántica — no lógica aquí
---
<slot />
```

**Uso:**
```astro
<Experiment id="uuid">
  <Variant slot="control">Control content</Variant>
  <Variant slot="b">Variant B content</Variant>
</Experiment>
```

---

## Supabase — Setup

**Workspace:** `4eda79d1-85e8-4d0a-bcaf-e4a5996f8a28` (Koryla Demo Astro)  
**Plan actual:** `free` → cambiar a `growth` para permitir >3 experimentos  
**Experimentos existentes:** Pricing Page Layout + Homepage Hero Test (mantener, no tocar)  
**Nuevos:** insertar vía REST API con service key (bypasses API plan check)

Orden de operaciones:
1. `PATCH workspaces` → `plan = 'growth'`
2. `POST experiments` × 3 con `started_at = now()`
3. `POST variants` × 6 (2 por experimento) con `rules` donde aplique

---

## Estructura final de archivos

```
koryla-astro-demo-example/
├── netlify/edge-functions/
│   └── koryla.ts                    ← actualizar paths con /demo-edge y /demo-combined
├── src/
│   ├── components/
│   │   ├── Experiment.astro         ← NUEVO
│   │   └── Variant.astro            ← NUEVO
│   └── pages/
│       ├── demo-sdk.astro           ← NUEVO (SDK puro)
│       ├── demo-edge.astro          ← NUEVO (Edge control)
│       ├── demo-edge-b.astro        ← NUEVO (Edge variante)
│       ├── demo-combined.astro      ← NUEVO (Combined control)
│       └── demo-combined-b.astro    ← NUEVO (Combined variante)
└── docs/
    ├── sdk-experiment.md            ← NUEVO (doc para principiantes)
    ├── edge-experiment.md           ← NUEVO
    └── combined-experiment.md       ← NUEVO
```
