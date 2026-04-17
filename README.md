# Koryla Astro Demo

Live reference implementation of Koryla A/B testing on Astro + Netlify.

**Live demo:** [astro-demo.koryla.com](https://astro-demo.koryla.com)

---

## What This Demos

Three experiment types, each with its own page:

| Page | Type | What it tests |
|---|---|---|
| `/demo-sdk` | SDK | Component-level CTA copy — no page reload, no JS |
| `/demo-edge` | Edge | Full page layout swap via transparent URL rewrite |
| `/demo-combined` | Combined | Edge routes the page, SDK tests a component within it |

All variants are server-rendered. Zero client JavaScript for A/B logic. Impressions and conversions flow server-side to GA4 via the Measurement Protocol.

---

## How It Works

Koryla has two layers that can be used independently or together:

**Edge layer** — Netlify edge function (Deno) intercepts requests before Astro runs. Assigns variant, rewrites URL transparently, fires impression. No JS in browser.

**SDK layer** — `<Experiment>` component in Astro SSR frontmatter. Renders only the active slot — the inactive variant never reaches the browser.

Both layers set sticky cookies, support UTM overrides (per-request, no stickiness), and forward events to GA4 server-side.

→ [Full architecture guide](docs/astro-integration-guide.md)

---

## Documentation

### How It Works
| File | Audience |
|---|---|
| [how-it-works.md](docs/how-it-works.md) | Quick overview |
| [how-it-works-technical.md](docs/how-it-works-technical.md) | Engineers — full architecture, cookie reference, analytics pipeline |
| [how-it-works-sales.md](docs/how-it-works-sales.md) | Sales / product — value prop, GA4 integration angle |
| [how-it-works-blog.md](docs/how-it-works-blog.md) | Blog / content — narrative explanation for publication |

### Experiment Guides
| File | Content |
|---|---|
| [astro-integration-guide.md](docs/astro-integration-guide.md) | Complete step-by-step setup guide |
| [sdk-experiment.md](docs/sdk-experiment.md) | SDK experiment walkthrough |
| [edge-experiment.md](docs/edge-experiment.md) | Edge experiment walkthrough |
| [combined-experiment.md](docs/combined-experiment.md) | Combined experiment walkthrough |

---

## Setup

```bash
npm install
cp .env.example .env
# Set KORYLA_API_KEY and KORYLA_API_URL
npm run dev
```

### Environment variables

```
KORYLA_API_KEY=sk_live_...
KORYLA_API_URL=https://app.koryla.com
```

### Netlify (production)

```
Netlify → Site configuration → Environment variables
  KORYLA_API_KEY = sk_live_...
  KORYLA_API_URL = https://app.koryla.com
```

### Requirements

- Astro in SSR mode (`output: 'server'`) — required for `Astro.request.headers` at request time
- `@astrojs/netlify` adapter
- Netlify with edge functions enabled

---

## Key Files

```
src/
  components/
    Experiment.astro       ← SDK layer: variant assignment, impression tracking
    Variant.astro          ← Named slot wrapper
  pages/
    demo-sdk.astro         ← SDK experiment demo
    demo-edge.astro        ← Edge experiment (control)
    demo-edge-b.astro      ← Edge experiment (variant B)
    demo-combined.astro    ← Combined experiment (control)
    demo-combined-b.astro  ← Combined experiment (variant B)
    thank-you.astro        ← Conversion page — fires conversion events
  lib/
    getVariant.ts          ← Config fetch, variant assignment logic

netlify/
  edge-functions/
    koryla.ts              ← Edge layer: request interception, URL rewrite, event firing
```

---

## Analytics

Events flow: Astro/Edge → Koryla API → GA4 Measurement Protocol.

- `experiment_assigned` — fired on every impression
- `experiment_converted` — fired when a user reaches the conversion URL

Configure GA4 forwarding in Koryla dashboard → **Settings → Analytics destinations → Google Analytics 4**.

The `api_secret` never reaches the browser. Events are ad-block resistant.

---

## Porting to Other Platforms

This repo is the Astro reference implementation. The same architecture applies to:

- **Next.js** — middleware runs before rendering (equivalent to edge layer), React Server Components for SDK layer
- **WordPress** — PHP hook runs before template render, edge function on Cloudflare or Netlify
- **Nuxt** — server middleware + `useAsyncData` for SDK layer

The core logic (`getVariant`, `assignVariant`, event firing) is platform-agnostic. The adapter layer changes per platform.

See [koryla.com/docs](https://koryla.com/docs) for platform-specific guides.
