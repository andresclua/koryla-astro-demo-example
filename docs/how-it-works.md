# How Koryla Works

Most A/B testing tools run in the browser. They load JavaScript, wait for the page to render, then swap content. The user sees a flash — control for a split second, then the variant. This is the "flicker problem," and it's been the accepted tradeoff for years.

Koryla eliminates it entirely.

---

## The Core Idea

Koryla makes the variant decision **before any HTML reaches the browser** — at the network edge or on the server during SSR. By the time the first byte arrives, the right version is already chosen. No JavaScript. No swap. No flash.

```
Browser request
      │
      ▼
  Koryla decides variant          ← happens here, before HTML
      │
      ▼
  Browser receives correct HTML   ← done
```

---

## Two Layers

Koryla offers two complementary approaches that can be used independently or together.

### Edge Layer — Full Page Swaps

Runs as a Netlify Edge Function (Deno), before Astro processes the request.

- Intercepts every request
- Reads or assigns a variant cookie
- Transparently rewrites the URL to the correct page variant
- The browser always sees the same URL — no redirect, no JavaScript

**Best for:** Testing two completely different layouts or pages.

```
GET /pricing
      │
      ▼
  Edge function: assigned to variant B
      │
      ▼
  Rewrites to /pricing-b (transparent — browser sees /pricing)
      │
      ▼
  Astro renders /pricing-b
```

### SDK Layer — Component-Level Swaps

Runs inside Astro SSR, per component, during server render.

- `<Experiment>` calls `getVariant()` in the page frontmatter
- Reads the variant cookie or assigns randomly
- Renders only the active slot — the other variant never reaches the browser

**Best for:** Testing a headline, a CTA, or any contained component.

```astro
<Experiment id="your-experiment-uuid">
  <Variant slot="control">
    <a href="/thank-you">Start testing free →</a>
  </Variant>
  <Variant slot="b">
    <a href="/thank-you">A/B test in 5 min →</a>
  </Variant>
</Experiment>
```

### Combined — Both at Once

The edge decides which page to serve. Inside that page, the SDK makes independent fine-grained decisions. Two separate experiments, two separate traffic splits, tracked independently.

---

## Sticky Sessions

A `ky_<experiment-id>` cookie persists the variant assignment for 30 days. The same visitor always sees the same variant across visits.

**UTM overrides** are intentionally per-request — they don't overwrite the sticky cookie. Remove the UTM param and the visitor reverts to their assigned variant. Useful for email campaigns and QA.

---

## Analytics Pipeline

Every impression and conversion flows server-side through Koryla to GA4 — never through the browser.

```
User visits page
      │
      ▼
Astro server fires impression
  POST /api/worker/event { event_type: "impression" }
      │
      ▼
Koryla API
      ├─→ Stored in Koryla database (visible in dashboard)
      └─→ Forwarded to GA4 Measurement Protocol
            event_name: "experiment_assigned"

User clicks CTA → conversion page
      │
      ▼
Astro server fires conversion
  POST /api/worker/event { event_type: "conversion" }
      │
      ├─→ Stored in Koryla database
      └─→ Forwarded to GA4
            event_name: "experiment_converted"
```

Because `api_secret` never reaches the browser, events are never blocked by ad blockers or privacy extensions. Data is accurate.

---

## Key Properties

| Property | Detail |
|---|---|
| No client JavaScript | Variant decision is server-side. Zero A/B logic in the browser. |
| No flicker | HTML arrives already correct. Nothing to swap. |
| Sticky sessions | 30-day cookie. Same visitor, same variant. |
| UTM override | Per-request only. Doesn't overwrite sticky cookie. |
| Config cache | Edge function caches experiment config for 60 seconds. Dashboard changes propagate in under a minute — no redeployment. |
| Ad-block resistant | All events sent server-side via Measurement Protocol. |
| Two independent layers | Edge and SDK experiments can run simultaneously on the same page. |

---

## What You Need

- **Astro** in SSR mode (`output: 'server'`) with the Netlify adapter
- **Netlify** with edge functions enabled
- **Koryla API key** set as an environment variable
- **GA4** property with a Measurement Protocol API secret (optional, for analytics forwarding)

Full setup: see [`astro-integration-guide.md`](./astro-integration-guide.md)
