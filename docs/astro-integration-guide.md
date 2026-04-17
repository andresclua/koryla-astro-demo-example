# A/B Testing in Astro with Koryla — Complete Guide

## The Core Idea

Most A/B testing tools work in the browser. They load JavaScript, wait for the page to paint, then swap out content. This causes a visible flash — the user sees the control for a split second before the variant appears. It's called the "flicker problem," and it's been the accepted tradeoff for years.

Koryla works differently. It runs **before any HTML reaches the browser**, at the network edge. By the time the browser receives the first byte, the variant decision has already been made server-side. There's no JavaScript swapping content. There's no flash. The user just sees the right version, immediately.

This document walks through exactly how to set that up in an Astro project deployed to Netlify.

---

## The Two Layers

Koryla offers two complementary approaches. Understanding when to use each one is the most important decision you'll make.

```
REQUEST from browser
       │
       ▼
┌──────────────────────────────────────────────┐
│  EDGE LAYER (Netlify Edge Function — Deno)   │
│  Runs before Astro. Intercepts every request.│
│  • Reads variant cookie                      │
│  • Queries Koryla API (60s cache)            │
│  • Rewrites URL transparently                │
│  • Sets cookie on response                   │
│  • Zero client JavaScript                    │
└──────────────────────────────────────────────┘
       │  (request already has the correct URL)
       ▼
┌──────────────────────────────────────────────┐
│  SDK LAYER (Astro SSR — server frontmatter)  │
│  Runs inside Astro, per component.           │
│  • <Experiment> calls getVariant()           │
│  • Reads cookie + UTM query params           │
│  • Renders only the active <slot>            │
│  • Sets cookie via Astro.cookies             │
│  • Zero client JavaScript                    │
└──────────────────────────────────────────────┘
       │
       ▼
    HTML delivered to browser
```

**Use Edge when** you're testing two completely different layouts or pages — the change is big enough to warrant a separate Astro file.

**Use SDK when** you're testing a component, a headline, or a CTA — the change is contained within the same page.

**Combine both** when the edge decides which page to serve, and the SDK makes fine-grained adjustments within that page.

---

## Experiment 1: SDK — Same URL, Different Component

The simplest case. No URL rewrite. The edge function is not involved. Everything happens in the Astro server during render.

### How it works

1. A visitor lands on `/demo-sdk`
2. The Astro server runs `getVariant()` in the frontmatter
3. `getVariant()` checks for a UTM query param rule first (`?utm_text=variation-1`)
4. If no UTM match, it reads the `ky_<experiment-id>` cookie
5. If no cookie, it assigns randomly based on traffic weights and sets a cookie
6. `<Experiment>` renders only the slot matching the active variant — the other never reaches the browser

```astro
---
import Experiment from '../components/Experiment.astro'
import Variant from '../components/Variant.astro'
---

<Experiment id="your-experiment-uuid">

  <!-- Shown by default -->
  <Variant slot="control">
    <a href="/thank-you" class="btn">Start testing free →</a>
  </Variant>

  <!-- Shown only when ?utm_text=variation-1 is in the URL -->
  <Variant slot="b">
    <a href="/thank-you" class="btn">A/B test in 5 min →</a>
  </Variant>

</Experiment>
```

### What `Experiment.astro` does under the hood

```astro
---
import { getVariant } from '../lib/getVariant'

const { id } = Astro.props
const result = await getVariant(Astro.request, id, {
  apiKey: import.meta.env.KORYLA_API_KEY,
  apiUrl: import.meta.env.KORYLA_API_URL,
})

const active = result?.variant.name ?? 'control'

// Set sticky cookie only on random assignment — not on UTM match
if (result?.isNewAssignment) {
  Astro.cookies.set(result.cookieName, result.variantId, {
    maxAge: 60 * 60 * 24 * 30, // 30 days
    sameSite: 'lax',
    path: '/',
  })
}

// Fire impression event to Koryla API (→ forwarded to GA4)
fetch(`${apiUrl}/api/worker/event`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${apiKey}` },
  body: JSON.stringify({
    experiment_id: result.experiment.id,
    variant_id: result.variantId,
    session_id: sessionId,
    event_type: 'impression',
  }),
}).catch(() => {})

// Astro.slots.render() — the only way to use a dynamic slot name in Astro
const html = await Astro.slots.render(active)
---
<Fragment set:html={html} />
```

### UTM rules — how they work

UTM rules let you force a specific variant via a query parameter. This is useful for:
- Email campaigns where you want everyone in a segment to see the same variant
- QA testing a specific variant without changing traffic weights
- Demos where you want to show both variants side by side

When `?utm_text=variation-1` is present:
- The rule overrides the cookie
- The rule does **not** set a new sticky cookie
- Remove the UTM → visitor reverts to their cookie or random assignment

This is intentional: UTM-triggered assignments are per-request, not permanent.

### Koryla dashboard configuration

```
Experiment type: SDK (component)
Base URL: https://your-site.com/demo-sdk
Conversion URL: https://your-site.com/thank-you

Variants:
  control  traffic: 95%  rules: (none)
  b        traffic:  5%  rules: [{param: "utm_text", value: "variation-1"}]

UTM override: ON
```

---

## Experiment 2: Edge — Two Separate Pages, One URL

The edge function intercepts requests to `/demo-edge` and transparently rewrites 50% of them to `/demo-edge-b`. The browser always sees `/demo-edge`. No redirect. No JavaScript.

### How it works

1. A visitor requests `/demo-edge`
2. The Netlify Edge Function (`koryla.ts`) runs before Astro
3. It queries the Koryla API for active experiments (cached 60s)
4. It reads the `ky_<experiment-id>` cookie
5. If no cookie → assigns randomly → sets cookie on response
6. If assigned to control → `context.next()` (serves `/demo-edge` as-is)
7. If assigned to variant B → `context.rewrite('/demo-edge-b')` (transparent rewrite)
8. Fires impression event to Koryla API

The two pages can be completely different — different layouts, different components, different content. They just share a URL.

### The edge function (simplified)

```typescript
// netlify/edge-functions/koryla.ts
export default async function handler(request: Request, context: NetlifyContext) {
  const result = await engine.process(request.url, cookieHeader)

  if (!result) return context.next()

  // Fire impression before serving
  await fireEvent({ experiment_id, variant_id, session_id, event_type: 'impression' })

  // Same path = control, serve as-is. Different path = rewrite transparently.
  const response = isSamePath
    ? await context.next()
    : await context.rewrite(result.targetUrl)

  // Set variant cookie on response
  if (result.isNewAssignment) {
    mutable.headers.append('Set-Cookie', `${result.cookieName}=${result.variantId}; ...`)
  }

  return mutable
}
```

### Netlify configuration

```toml
# netlify.toml
[[edge_functions]]
  function = "koryla"
  path = "/*"
  excludedPath = "/assets/*"
```

### Koryla dashboard configuration

```
Experiment type: Edge
Base URL: https://your-site.com/demo-edge
Conversion URL: https://your-site.com/thank-you

Variants:
  control  traffic: 50%  target_url: https://your-site.com/demo-edge
  b        traffic: 50%  target_url: https://your-site.com/demo-edge-b
```

---

## Experiment 3: Combined — Edge for Layout, SDK for Detail

The most powerful pattern. The edge decides which page to serve. Inside that page, the SDK makes independent fine-grained decisions.

### How it works

1. Visitor requests `/demo-combined?variant=b`
2. Edge function matches the UTM rule `variant=b` → rewrites to `/demo-combined-b`
3. Astro renders `/demo-combined-b`
4. Inside the page, `<Experiment>` runs the SDK experiment for the CTA
5. Both layers fire their own impression events independently

This means you can test the page layout (edge) and the CTA copy (SDK) with separate traffic splits, and track them separately in the dashboard.

```astro
<!-- demo-combined-b.astro — reached only via edge rewrite -->
---
import Experiment from '../components/Experiment.astro'
import Variant from '../components/Variant.astro'
---

<h1>Edge brought you here. SDK handles the rest.</h1>

<!-- Second, independent A/B test running inside this page -->
<Experiment id="your-sdk-experiment-uuid">
  <Variant slot="control">
    <a href="/thank-you">Start testing free →</a>
  </Variant>
  <Variant slot="b">
    <a href="/thank-you">A/B test in 5 min →</a>
  </Variant>
</Experiment>
```

---

## Analytics — How Data Flows

Every impression and conversion goes through Koryla, which forwards events to Google Analytics 4 server-side using the Measurement Protocol.

```
User visits /demo-sdk
       │
       ▼
Experiment.astro fires impression
  POST /api/worker/event { event_type: "impression", variant_id, session_id }
       │
       ▼
Koryla API receives event
       │
       ├─→ Stored in Koryla database (visible in Koryla dashboard)
       │
       └─→ Forwarded to GA4 Measurement Protocol
             event_name: "experiment_assigned"
             (visible in GA4 → Explore → Event name)

User clicks CTA → /thank-you
       │
       ▼
thank-you.astro fires conversion
  POST /api/worker/event { event_type: "conversion", variant_id, session_id }
       │
       ▼
Koryla API receives event
       │
       ├─→ Stored in Koryla database
       │
       └─→ Forwarded to GA4
             event_name: "experiment_converted"
```

Because everything happens server-side, the events are never blocked by ad blockers. The `api_secret` never reaches the browser. GA4 receives clean, accurate data.

### GA4 setup in Koryla dashboard

Go to **Settings → Analytics destinations → + Add → Google Analytics 4** and enter:
- `measurement_id`: your GA4 property ID (e.g. `G-XXXXXXXXXX`)
- `api_secret`: from GA4 → Admin → Data Streams → your stream → Measurement Protocol API secrets

Once configured, every experiment event is forwarded automatically. No code changes needed.

---

## Full Setup Checklist

### 1. Create the experiment in Koryla dashboard
- Set `base_url` and `conversion_url`
- Add variants with traffic weights
- Add UTM rules if needed
- Copy the experiment UUID

### 2. Add the Koryla API key to Netlify
```
Netlify → Site configuration → Environment variables
  KORYLA_API_KEY = sk_live_...
  KORYLA_API_URL = https://app.koryla.com
```

### 3. Add the edge function (for edge/combined experiments)
```
netlify/edge-functions/koryla.ts  ← copy from this repo
```

### 4. Configure `netlify.toml`
```toml
[[edge_functions]]
  function = "koryla"
  path = "/*"
  excludedPath = "/assets/*"
```

### 5. Switch Astro to SSR mode
```javascript
// astro.config.mjs
import netlify from '@astrojs/netlify'

export default defineConfig({
  output: 'server',
  adapter: netlify(),
})
```
SSR is required so `Astro.request.headers` is available at request time (needed to read cookies).

### 6. Use `<Experiment>` in your pages (SDK experiments)
```astro
<Experiment id="your-uuid">
  <Variant slot="control">...</Variant>
  <Variant slot="b">...</Variant>
</Experiment>
```

### 7. Add conversion tracking to your conversion page
The edge function handles conversions for edge experiments automatically. For SDK experiments, `thank-you.astro` fires the conversion by reading the `ky_<id>` cookie.

### 8. Connect GA4 in Koryla Settings → Analytics destinations

---

## Key Properties of This Architecture

**No client JavaScript for A/B logic.** The variant decision happens server-side. The browser receives the final HTML directly. Ad blockers, privacy extensions, and slow connections don't affect experiment accuracy.

**No flicker.** Because the rewrite happens at the network layer before HTML is sent, there's no moment where the wrong variant is visible.

**Sticky sessions.** A `ky_<experiment-id>` cookie persists the variant assignment for 30 days. The same visitor always sees the same variant.

**UTM override without stickiness.** UTM rule matches apply per-request and don't overwrite the sticky cookie. Remove the UTM param and the visitor reverts to their assigned variant.

**60-second config cache.** The edge function caches experiment config for 60 seconds. Changes in the dashboard propagate within one minute with zero redeployment.

**Two independent layers.** Edge experiments and SDK experiments can run simultaneously on the same page, each with their own traffic split, tracked separately.

**Full analytics pipeline.** Impressions and conversions flow from the Astro server → Koryla API → GA4 Measurement Protocol, all server-side.
