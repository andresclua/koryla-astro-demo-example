# How Koryla Works — Technical Reference

## Architecture Overview

Koryla is a server-side A/B testing system with two execution layers. Both layers share the same experiment configuration API and event pipeline. Events are forwarded from Koryla to GA4 via the Measurement Protocol — server-side, never through the browser.

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
      │
      ▼
┌─────────────────────────────────────────┐
│  ANALYTICS PIPELINE                     │
│  Koryla API → GA4 Measurement Protocol  │
│  Server-side. Never reaches browser.    │
└─────────────────────────────────────────┘
```

Zero client-side JavaScript is involved in variant selection, rendering, or analytics.

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
2. Fetch experiment config from Koryla API (in-memory cache, 60s TTL)
3. Match request path against `base_url` of active experiments (sorted by path specificity, longest first)
4. If no match → `context.next()`, pass through unchanged
5. If match → determine variant:
   - Check for UTM rule match in query params (per-request, no sticky cookie)
   - Else read existing `ky_<experiment-id>` cookie
   - Else assign randomly by `traffic_weight`, set `isNewAssignment = true`
6. Fire `impression` event to Koryla API (`await` — blocks until sent)
7. Serve response:
   - Control variant → `context.next()` (same path)
   - Other variant → `context.rewrite(targetUrl)` (transparent URL rewrite)
8. Append `Set-Cookie` headers on the mutable response if `isNewAssignment`

### Conversion detection

Before experiment routing, the edge function loops through **all** experiments and checks whether the requested path matches any `conversion_url`. For each match where a variant cookie exists, a `conversion` event is fired. Multiple experiments can share the same conversion URL — all are checked.

---

## SDK Layer

### Component interface

```astro
<Experiment id="<experiment-uuid>">
  <Variant slot="control">...</Variant>
  <Variant slot="b">...</Variant>
</Experiment>
```

### Render flow

1. `getVariant(Astro.request, id, { apiKey, apiUrl })` — fetches config (60s cache), matches by experiment ID
2. Variant assignment: UTM rule → existing cookie → random weighted assignment
3. If `isNewAssignment`: `Astro.cookies.set(cookieName, variantId, { maxAge: 30d, sameSite: 'lax', path: '/' })`
4. Fire `impression` event (non-blocking fetch)
5. `Astro.slots.render(active)` — renders only the active slot; inactive variants are never included in the HTML

### Dynamic slot rendering

Astro's compiler rejects `<slot name={variable} />`. The solution is `Astro.slots.render(variantName)`, which accepts a runtime string and returns rendered HTML injected via `<Fragment set:html={html} />`.

---

## Variant Assignment Logic

Both layers use the same algorithm:

```typescript
// 1. UTM rule match — per-request, never sets a sticky cookie
const ruleMatch = findRuleMatch(variants, url.searchParams)
if (ruleMatch) return { variantId: ruleMatch.id, isNewAssignment: false }

// 2. Existing sticky cookie
const stored = variants.find(v => v.id === cookieVariantId)
if (stored) return { variantId: stored.id, isNewAssignment: false }

// 3. Random weighted assignment
return { variantId: assignVariant(variants), isNewAssignment: true }
```

`isNewAssignment: false` on UTM matches is intentional — UTM overrides are transient and must not overwrite the sticky assignment.

---

## Analytics Pipeline

All events are sent from the Koryla API to GA4 via the Measurement Protocol. The `api_secret` is stored in Koryla — it never reaches the browser, cannot be scraped, and cannot be blocked.

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

### GA4 setup

In Koryla dashboard → **Settings → Analytics destinations → Google Analytics 4**:
- `measurement_id`: your GA4 property ID (`G-XXXXXXXXXX`)
- `api_secret`: GA4 → Admin → Data Streams → Measurement Protocol API secrets

Once configured, all experiment events forward automatically. No code changes required.

### Event metadata

| Field | Source | Layers |
|---|---|---|
| `utm_source`, `utm_medium`, `utm_campaign` | URL query params | Edge + SDK |
| `referrer` | `Referer` request header | Edge + SDK |
| `page_url` | Request pathname | Edge + SDK |
| `device_type` | User-Agent (`mobile\|tablet\|desktop`) | Edge + SDK |
| `country` | `context.geo.country` | Edge only (Netlify-provided) |

---

## Session Tracking

Both layers read and write a `ky_session` UUID cookie (365-day expiry). This ID is attached to every event, enabling impression-to-conversion correlation in GA4 Explore.

---

## Config Cache

Both layers cache `/api/worker/config` in-memory for 60 seconds. Each Netlify function instance maintains its own cache. Dashboard changes propagate within 60 seconds — no redeployment needed.

---

## Cookie Reference

| Cookie | Value | Expiry | Purpose |
|---|---|---|---|
| `ky_<experiment-id>` | variant UUID | 30 days | Sticky assignment per experiment |
| `ky_session` | UUID v4 | 365 days | Session ID for GA4 event correlation |

Both cookies: `Path=/; SameSite=Lax`. No `Domain` attribute (scoped to current host).
