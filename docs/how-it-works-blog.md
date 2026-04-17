# We Moved Our A/B Tests to the Edge. Here's What Changed.

Every A/B testing tool we evaluated worked the same way. JavaScript loads, the page renders, then the tool swaps the content. The "flicker problem" — that brief moment where the user sees the wrong version — was treated as an unavoidable cost of doing business.

We decided it wasn't.

---

## The Flicker Problem Is an Architecture Problem

The root cause of flicker is simple: browser-based testing tools make the variant decision *after* the page has already been rendered. The decision happens in JavaScript, which means the HTML has already arrived in the browser, the user has already seen it, and now something needs to change.

No matter how fast the JavaScript runs, there will always be a gap between "page rendered" and "correct variant shown." On fast connections, it's a millisecond. On slow connections, it's enough for the user to notice.

The only real fix is to move the decision earlier — before the HTML is generated at all.

---

## Moving the Decision to the Edge

With Koryla, the variant decision happens at the **network edge**, before the request even reaches the application server.

When a visitor lands on `/pricing`, a Netlify edge function intercepts the request, reads their variant cookie (or assigns one), and transparently rewrites the URL to `/pricing-b` if they're in the variant group. The browser receives a 200 response with the correct HTML. It never sees `/pricing-b` in the address bar. There is no redirect. There is no JavaScript swap. There is no flicker.

```
Visitor requests /pricing
        │
        ▼
  Edge function runs (Deno, before Astro)
  → Reads cookie: variant = B
  → Rewrites request to /pricing-b
        │
        ▼
  Astro renders /pricing-b
        │
        ▼
  Browser receives correct HTML for variant B
  (URL still shows /pricing)
```

The entire variant decision takes place before the first byte of HTML is generated.

---

## For Component-Level Tests: The SDK Layer

Not every test requires a separate page. For testing a headline, a CTA, or a hero section, Koryla's SDK layer runs inside the Astro server during render. The `<Experiment>` component renders only the active slot — the other variant is never included in the HTML response.

```astro
<Experiment id="your-experiment-uuid">
  <Variant slot="control">
    <a href="/signup">Start testing free →</a>
  </Variant>
  <Variant slot="b">
    <a href="/signup">A/B test in 5 minutes →</a>
  </Variant>
</Experiment>
```

No JavaScript. The variant the visitor sees is baked directly into the HTML that lands in their browser.

---

## The Ad Blocker Problem

There's a second issue with browser-based testing that gets less attention: ad blockers.

Most popular A/B testing tools inject a JavaScript snippet that ad blockers and privacy extensions recognize and block. When that happens, the visitor either sees no variant (you lose the data point) or the tool falls back to a default (you get inaccurate data).

With Koryla, variant assignment happens server-side. There is nothing in the browser to block. Ad blockers and privacy extensions are irrelevant. You get accurate data on every visitor, including the privacy-conscious ones.

The same applies to analytics. Koryla forwards experiment events — impressions and conversions — to GA4 via the Measurement Protocol, server-side. The GA4 Measurement Protocol API secret never reaches the browser. No browser extension can intercept it.

---

## What Accurate Data Actually Looks Like

After switching, we noticed something immediately: our conversion rates looked different.

Not necessarily better or worse — different. The previous numbers had been skewed by the visitors who were silently excluded because their ad blocker blocked the testing script. Those visitors tended to be more technical, more privacy-aware, and in our case, higher-intent. They were systematically excluded from our experiments.

With server-side testing, everyone is included. The data reflects your actual audience.

---

## The Setup

Koryla runs as a Netlify edge function alongside an Astro SSR project. The edge function intercepts all requests, matches them against active experiments from the Koryla API (cached 60 seconds), and handles routing transparently. For SDK experiments, a single `<Experiment>` component wraps the variants.

Setup is a Netlify environment variable, a `netlify.toml` entry, and `output: 'server'` in your Astro config. The edge function is self-contained — no external SDK to install, no CDN to load.

Changes to experiments — traffic weights, new UTM rules, pausing a test — propagate in under a minute without redeployment.

---

## What We Learned

Moving A/B testing server-side is not a minor optimization. It changes the architecture of the experiment in a fundamental way.

The flicker problem disappears because there is no longer a moment where the browser has the wrong content. The ad blocker problem disappears because there is no client-side script to block. The performance cost disappears because there is no JavaScript payload added to the page.

The tradeoff is that you need an SSR setup. Static sites cannot do this — the server needs to run code on each request to make the variant decision. But if you are already on an SSR framework like Astro, the integration is straightforward.

The question we kept coming back to: if you can make the decision before the HTML is generated, why would you make it after?
