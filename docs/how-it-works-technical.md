# How Koryla Works — Technical Reference

## Architecture Overview

Koryla is a server-side A/B testing system with two execution layers. Both layers share the same experiment configuration API and event pipeline, but run at different points in the request lifecycle.

```
Browser request
      │
      ▼
┌─────────────────────────────────────────┐
│  EDGE LAYER (Netlify Edge Function)     │
│  Runtime: Deno                          │
│  Executes: before Astro SSR             │
│  Use case: full-page variant routing    │
└─────────────────────────────────────────┘
      │  context.next() or context.rewrite()
      ▼
┌─────────────────────────────────────────┐
│  SDK LAYER (Astro SSR frontmatter)      │
│  Runtime: Node.js                       │
│  Executes: during component render      │
│  Use case: component-level variants     │
└─────────────────────────────────────────┘
      │
      ▼
  HTML delivered to browser
```

Zero client-side JavaScript involved in variant selection or rendering at either layer.

---

## Edge Layer

### Execution context

Netlify Edge Function running in Deno, configured to intercept all requests via `netlify.toml`:

```toml
[[edge_functions]]
  function = "koryla"
  path = "/*"
  excludedPath = "/assets/*"
```

### Request flow

1. Read `cookie` header from incoming request
2. Fetch experiment config from Koryla API (cached in-memory for 60 seconds)
3. Match request path against `base_url` of active experiments (sorted by path specificity, longest first)
4. If no match → `context.next()`, pass through unchanged
5. If match → determine variant:
   - Check for UTM rule match in query params (per-request, no sticky cookie)
   - Else read existing `ky_<experiment-id>` cookie
   - Else assign randomly by `traffic_weight`, set `isNewAssignment = true`
6. Fire `impression` event to Koryla API (`await` — not fire-and-forget)
7. Serve response:
   - Control variant → `context.next()` (same path)
   - Other variant → `context.rewrite(targetUrl)` (transparent URL rewrite)
8. Append `Set-Cookie` headers on the mutable response if `isNewAssignment`

### URL rewrite

`context.rewrite()` serves a different Astro page while the browser sees the original URL. No redirect. No `history.pushState`. The variant page is rendered server-side and delivered as if it were the requested URL.

### Conversion detection

On every request, before experiment routing, the edge function checks whether the requested path matches any experiment's `conversion_url`. If it does, it reads the variant cookie and fires a `conversion` event for every matching experiment. Multiple experiments can share the same conversion URL.

---

## SDK Layer

### Execution context

Astro component (`Experiment.astro`) running inside the SSR render pipeline. Accesses `Astro.request`, `Astro.cookies`, and `Astro.slots`.

### Component interface

```astro
<Experiment id="<experiment-uuid>">
  <Variant slot="control">...</Variant>
  <Variant slot="b">...</Variant>
</Experiment>
```

### Render flow

1. `getVariant(Astro.request, id, { apiKey, apiUrl })` — reads config (60s cache), matches experiment by ID
2. Variant assignment: UTM rule → existing cookie → random assignment
3. If `isNewAssignment`: `Astro.cookies.set(cookieName, variantId, { maxAge: 30d, sameSite: 'lax', path: '/' })`
4. Fire `impression` event (non-blocking fetch, `.catch(() => {})`)
5. `Astro.slots.render(active)` — renders only the active named slot; the inactive variant is never included in the HTML response

### Dynamic slot rendering

Astro's compiler rejects `<slot name={variable} />`. The workaround is `Astro.slots.render(variantName)`, which accepts a dynamic string and returns rendered HTML injected via `<Fragment set:html={html} />`.

---

## Variant Assignment Logic

Both layers use the same algorithm:

```typescript
// 1. UTM rule match (per-request, no sticky cookie)
const ruleMatch = findRuleMatch(variants, url.searchParams)
if (ruleMatch) return { variantId: ruleMatch.id, isNewAssignment: false }

// 2. Existing cookie
const stored = variants.find(v => v.id === cookieVariantId)
if (stored) return { variantId: stored.id, isNewAssignment: false }

// 3. Random weighted assignment
const variantId = assignVariant(variants) // weighted by traffic_weight
return { variantId, isNewAssignment: true }
```

`isNewAssignment: false` on UTM matches is intentional — UTM overrides are transient and must not overwrite the sticky cookie.

---

## Session Tracking

Both layers create and persist a `ky_session` UUID cookie (365-day expiry). This session ID is attached to every impression and conversion event, enabling funnel analysis across layers.

---

## Analytics Pipeline

```
Edge/SDK layer
      │
      ▼  POST /api/worker/event
Koryla API  { experiment_id, variant_id, session_id, event_type, metadata }
      │
      ├─→ Stored in Koryla database
      └─→ GA4 Measurement Protocol (server-side)
            impression → event_name: "experiment_assigned"
            conversion → event_name: "experiment_converted"
```

### Event metadata (enrichment)

Both layers attach request-derived metadata:

| Field | Source |
|---|---|
| `utm_source`, `utm_medium`, `utm_campaign` | URL query params |
| `referrer` | `Referer` request header |
| `page_url` | Request pathname |
| `device_type` | User-Agent string (`mobile \| tablet \| desktop`) |
| `country` | `context.geo.country` (edge layer only — Netlify-provided) |

### Why server-side

- `api_secret` never reaches the browser — cannot be scraped
- Events bypass ad blockers and privacy extensions
- Accurate data regardless of client JS execution

---

## Config Cache

Both layers cache the experiment config response from `/api/worker/config` in-memory for 60 seconds. Each Netlify edge function instance and SSR function instance maintains its own cache. Dashboard changes propagate within 60 seconds with no redeployment.

---

## Cookie Reference

| Cookie | Value | Expiry | Purpose |
|---|---|---|---|
| `ky_<experiment-id>` | variant UUID | 30 days | Sticky assignment per experiment |
| `ky_session` | UUID v4 | 365 days | Session ID for event correlation |

Both cookies use `Path=/; SameSite=Lax`. No `Domain` attribute (scoped to current host).
