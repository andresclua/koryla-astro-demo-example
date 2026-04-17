# A/B Testing in Astro With Zero Client JavaScript

*Status: draft*

---

Most A/B testing setups in Astro follow the same pattern: add a third-party script, load it client-side, let it handle variant assignment in the browser. You get flicker. You get ad-block exclusions. You get inaccurate data.

This is a walkthrough of a different approach — full A/B testing with no client JavaScript, using Koryla's edge function and `<Experiment>` component.

---

## The Architecture

Two layers handle different types of tests:

**Edge layer** — a Netlify edge function that intercepts requests before Astro runs. Best for testing full-page layouts. Transparently rewrites the URL so the browser always sees the same address.

**SDK layer** — an Astro component that renders only the active variant during SSR. Best for testing headlines, CTAs, or any contained element.

Both layers can run simultaneously on the same page.

---

## Layer 1: The Edge Function

The edge function lives in `netlify/edge-functions/koryla.ts`. Netlify runs it in Deno before the request reaches Astro.

```typescript
export default async function handler(request: Request, context: NetlifyContext) {
  const result = await engine.process(request.url, cookieHeader)

  if (!result) return context.next()

  // Fire impression before serving (awaited — not fire-and-forget)
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

`context.rewrite()` serves `/pricing-b` while the browser sees `/pricing`. No redirect. No history manipulation. The browser never knows.

Configure it in `netlify.toml`:

```toml
[[edge_functions]]
  function = "koryla"
  path = "/*"
  excludedPath = "/assets/*"
```

---

## Layer 2: The `<Experiment>` Component

For component-level tests, wrap variants in `<Experiment>`:

```astro
<Experiment id="bb1e7469-062c-4426-98ad-9b5ca8869f1b">
  <Variant slot="control">
    <a href="/thank-you">Start testing free →</a>
  </Variant>
  <Variant slot="b">
    <a href="/thank-you">A/B test in 5 min →</a>
  </Variant>
</Experiment>
```

Inside `Experiment.astro`, the component calls `getVariant()` in the frontmatter:

```astro
---
const result = await getVariant(Astro.request, id, { apiKey, apiUrl })
const active = result?.variant.name ?? 'control'

// Set sticky cookie if new assignment
if (result?.isNewAssignment) {
  Astro.cookies.set(result.cookieName, result.variantId, {
    maxAge: 60 * 60 * 24 * 30,
    sameSite: 'lax',
    path: '/',
  })
}

// Fire impression (non-blocking)
fetch(`${apiUrl}/api/worker/event`, { ... }).catch(() => {})

// Render only the active slot
const html = Astro.slots.has(active)
  ? await Astro.slots.render(active)
  : await Astro.slots.render('control')
---
<Fragment set:html={html} />
```

One detail worth noting: Astro's compiler rejects `<slot name={variable} />` at build time. The workaround is `Astro.slots.render(variantName)` — a runtime call that accepts a dynamic string.

The inactive variant is never rendered. It is not in the HTML response. It never reaches the browser.

---

## Variant Assignment Logic

Both layers use the same priority order:

1. **UTM rule match** — `?utm_text=variation-1` forces a specific variant. Per-request only. Does not set a sticky cookie.
2. **Existing cookie** — `ky_<experiment-id>` persists the assignment for 30 days.
3. **Random weighted assignment** — based on `traffic_weight` configured per variant.

---

## Conversion Tracking

The conversion page (`/thank-you`) fires conversion events for every experiment whose `conversion_url` matches the current page:

```typescript
for (const exp of experiments) {
  const convPath = new URL(exp.conversion_url).pathname
  if (convPath !== thisPath) continue

  const variantId = Astro.cookies.get(`ky_${exp.id}`)?.value
  if (!variantId) continue

  fetch(`${apiUrl}/api/worker/event`, {
    method: 'POST',
    body: JSON.stringify({ experiment_id: exp.id, variant_id: variantId, event_type: 'conversion' }),
  }).catch(() => {})
}
```

Multiple experiments can share the same conversion URL. Each fires independently.

---

## Analytics

Events reach GA4 via the Measurement Protocol — server-side, never through `gtag.js`. Configure in Koryla dashboard → **Settings → Analytics destinations**.

In GA4 Explore: `experiment_assigned → experiment_converted`, filtered by `variant_name`. Accurate data on every visitor, including those with ad blockers.

---

## Requirements

- Astro `output: 'server'` — required for `Astro.request.headers` at render time
- `@astrojs/netlify` adapter
- `KORYLA_API_KEY` and `KORYLA_API_URL` environment variables

---

*→ Live demo: [astro-demo.koryla.com](https://astro-demo.koryla.com)*
*→ Full source: [github.com/andresclua/koryla-astro-demo-example](https://github.com/andresclua/koryla-astro-demo-example)*
*→ Setup guide: [astro-integration-guide.md](../astro-integration-guide.md)*
