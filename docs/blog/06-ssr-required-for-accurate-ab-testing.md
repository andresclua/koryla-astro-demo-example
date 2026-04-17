# SSR Is Now a Requirement for Accurate A/B Testing

*Status: draft*

---

Static sites are fast. They're cheap to host, easy to cache, and straightforward to deploy. But there is one thing a static site cannot do: make a decision before serving the HTML.

That limitation matters more than it used to.

---

## What SSR Enables

Server-side rendering runs code on each request. That sounds like a cost — and in the early days of SSR, it was. Extra compute, slower time-to-first-byte, more complex infrastructure.

But that per-request execution is exactly what makes accurate A/B testing possible.

With SSR, you can:
- Read the request's cookie header and determine variant assignment before rendering
- Set a `Set-Cookie` header on the response to persist the assignment
- Render only the active variant — never send the inactive one to the browser
- Fire analytics events from the server, bypassing ad blockers

None of these are possible in a fully static context. When the HTML is pre-built at deploy time, there is no request to read, no cookie to check, and no server-side logic to execute.

---

## What Static Sites Are Left With

A static site doing A/B testing has two options:

**Option 1: Client-side testing tools** (VWO, Google Optimize, custom scripts)

The script loads in the browser, reads a cookie or fingerprint, and swaps content. This introduces flicker, is blocked by ad blockers, and cannot send analytics events server-side. You get the full set of problems this approach is known for.

**Option 2: Deploy-time variants** (build two versions, split at the CDN level)

Some teams build both variants at deploy time and use CDN routing to split traffic. This works for major architectural changes but is operationally complex — you need separate build artifacts, the CDN configuration is non-trivial, and you cannot change traffic weights without a redeployment.

Neither option gives you the clean, accurate, no-flicker result that per-request server-side logic provides.

---

## The Ecosystem Has Shifted

The performance argument against SSR was valid in 2018. It's much weaker now.

Astro, Next.js, Nuxt, SvelteKit, and Remix are all production-grade SSR frameworks with strong ecosystems and excellent performance characteristics. Edge runtimes (Deno, Cloudflare Workers, Netlify Edge Functions) add another layer — server-side logic that runs in the same datacenter as the CDN, with response times comparable to static serving.

The gap between static and SSR performance has narrowed to the point where most teams cannot measure the difference in real-world conditions. What remains is the gap in capability.

---

## The Thin SSR Layer Option

You don't need to rebuild your entire site in SSR to run server-side A/B tests. A common pattern is to keep the site static but add a thin edge function layer.

The edge function intercepts requests, makes the variant decision, and rewrites the URL to serve one of two pre-built static variants. The HTML itself is static. The routing decision is dynamic.

This gives you most of the benefits of server-side testing without changing your build pipeline:

- Variant assignment happens before the browser renders anything
- No client JavaScript involved in the decision
- Sticky cookies set on the response

The limitation: you still need two pre-built variants per test, and analytics events still need to be sent somehow (either from the edge function, or client-side with the same ad-block caveats).

---

## When to Switch

The calculus changes at a certain traffic level and test frequency.

If you run fewer than two tests per month and your audience has low ad-block rates, the operational overhead of setting up SSR for testing may not be worth it. Client-side tools with their known limitations might be acceptable.

If you run tests regularly, care about conversion accuracy, or have a technically sophisticated audience with high ad-block rates — the architectural shift is worth making.

The break-even point is lower than most teams expect, because the cost of acting on bad experiment data compounds. Every test where you ship the wrong variant because of a skewed sample costs you something real.

---

## The Practical Path

If you're on Astro: switch `output: 'static'` to `output: 'server'`, add the `@astrojs/netlify` adapter, and deploy. The rest of your site continues to work. You gain per-request logic.

If you're on Next.js: middleware already runs before rendering. No configuration change needed.

If you're on a CMS like WordPress: a Cloudflare Worker or Netlify edge function in front of your origin provides the same capability without touching the CMS.

The platform is less important than the principle: variant assignment happens before the HTML is generated, and analytics events leave from the server.

---

*→ See the Astro implementation: [astro-demo.koryla.com](https://astro-demo.koryla.com)*
*→ Source code: [github.com/andresclua/koryla-astro-demo-example](https://github.com/andresclua/koryla-astro-demo-example)*
