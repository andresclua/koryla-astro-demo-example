# Koryla — Content Plan

Audience: frontend/fullstack devs and product managers working on Astro, Next.js, or Nuxt with real traffic and some form of A/B testing (or wanting it).

Angle across all content: **your experiment data is less accurate than you think, and the fix is architectural, not a settings change.**

---

## Article 1 — The Flicker Problem Nobody Talks About

**Hook:** Every A/B testing tutorial skips the part where the user sees the wrong version first.

**Body:**
- What flicker actually is and why it happens (JS executes after paint)
- Why it's not just a UX problem — it skews conversion rates
- The categories of users most affected (slow connections, low-end devices)
- Why "anti-flicker snippets" are a band-aid that creates new problems (blocking render)
- The only real fix: make the decision before the HTML is generated

**Conclusion:** Links to Koryla demo, frames server-side testing as the architectural solution.

**Instagram post:**
> Your A/B test is showing users the wrong version first.
>
> It happens in milliseconds — fast enough that most people don't notice, slow enough that it skews your conversion data.
>
> It's called flicker. And almost every A/B testing tool has it.
>
> The fix isn't faster JavaScript. It's moving the decision to the server.
>
> [link in bio → how we built it with zero client JS]

---

## Article 2 — Your Ad-Block Users Are Missing From Your A/B Tests

**Hook:** You're making product decisions based on data that excludes your most valuable users.

**Body:**
- Ad blocker usage stats by audience type (devs, privacy-conscious users: 30-50%)
- How browser-based A/B tools get blocked (script domains, patterns)
- What "excluded from experiment" actually means for your data
- The specific bias: high-intent users with ad blockers converting differently than average
- Case: two variants look equal in the test, but variant B actually wins among the excluded group

**Conclusion:** Server-side assignment bypasses all of this. No browser script = nothing to block.

**Instagram post:**
> If your audience is developers or privacy-conscious users, up to 40% of them might be missing from your A/B tests.
>
> Not because they opted out. Because their ad blocker silently blocked your testing script.
>
> You shipped the "winning" variant. It was winning among the wrong people.
>
> Server-side testing doesn't have this problem. There's no script to block.

---

## Article 3 — Why We Stopped Using GA4 Client-Side for Experiment Events

**Hook:** The GA4 tag is blocked by the same users whose behavior you most want to measure.

**Body:**
- How GA4's gtag.js gets blocked by uBlock Origin, Brave, Firefox Enhanced Tracking Protection
- What the Measurement Protocol is and how it's different (server-to-server, not browser-to-GA4)
- The specific problem: impression fires from gtag but conversion doesn't (or vice versa) → broken funnel
- How Koryla forwards events via Measurement Protocol: `api_secret` never reaches browser
- What "experiment_assigned" and "experiment_converted" look like in GA4 Explore

**Conclusion:** Same GA4 property, same reports, better data. No migration required.

**Instagram post:**
> Your GA4 experiment data has a hole in it.
>
> When a user's browser blocks the GA4 script, the impression fires but the conversion doesn't. Or neither does. The funnel looks broken. The data is wrong.
>
> GA4's Measurement Protocol sends events server-side. No browser involved. No blocking possible.
>
> We use it for every experiment event in Koryla. The api_secret never reaches the browser.

---

## Article 4 — A/B Testing With Astro and Zero JavaScript

**Hook:** A full working A/B test in Astro — no client JS, no flicker, real GA4 data.

**Body:**
- The two-layer architecture (edge function + `<Experiment>` component)
- Code walkthrough: `<Experiment>` component, `Astro.slots.render()`, `getVariant()`
- How the edge function does a transparent URL rewrite with `context.rewrite()`
- How events reach GA4 via the Measurement Protocol
- What the Supabase event log looks like (real data from the demo)

**Conclusion:** Full demo at astro-demo.koryla.com, repo on GitHub.

**Instagram post:**
> A/B test in Astro. No JavaScript in the browser. No flicker. Real GA4 data.
>
> The variant decision happens at the Netlify edge, before Astro even runs.
>
> ```astro
> <Experiment id="your-uuid">
>   <Variant slot="control">Start testing free →</Variant>
>   <Variant slot="b">A/B test in 5 min →</Variant>
> </Experiment>
> ```
>
> Only the active slot is rendered. The other never reaches the browser.
>
> [link in bio → full walkthrough + live demo]

---

## Article 5 — The Difference Between Edge Testing and Component Testing

**Hook:** Not all A/B tests are the same. Which one you need depends on what you're testing.

**Body:**
- Edge testing: full page swap, transparent URL rewrite, best for layout and structural changes
- Component testing: single element swap, server-rendered, best for copy and CTA
- When to combine both (edge routes the page, SDK tests elements within it)
- The tradeoffs: edge testing needs separate page files, SDK testing needs SSR
- Decision flowchart: what type of test does your change require?

**Conclusion:** Both modes in Koryla, one API key, one GA4 property.

**Instagram post:**
> Two types of A/B test. Most tools only give you one.
>
> **Edge test** — two completely different pages, one URL. The network decides which one to serve before the browser sees anything.
>
> **Component test** — same page, different element. Only the active variant is in the HTML.
>
> The right choice depends on how big your change is.
>
> If you're changing the entire pricing layout → edge.
> If you're changing the CTA copy → component.

---

## Article 6 — Why SSR Is Now a Requirement for Accurate A/B Testing

**Hook:** Static sites can't do server-side A/B testing. Here's what that actually costs you.

**Body:**
- What SSR enables that static doesn't: per-request decisions, cookie reading at render time, server-side event firing
- The growth of SSR frameworks (Astro, Next.js, Nuxt, SvelteKit) — the ecosystem shift
- The cost of browser-based testing on static sites: flicker, ad-block exclusion, no server-side events
- Options for static sites: edge functions as a thin SSR layer (CDN-level decision, Astro static + edge function)
- When the upgrade to SSR is worth it (traffic > ~5k/month, conversion rates matter, ad-block audience)

**Conclusion:** SSR isn't just for dynamic content anymore. It's what makes experiment data trustworthy.

**Instagram post:**
> If your site is fully static, your A/B test data is probably wrong.
>
> Not because static is bad. Because variant assignment in the browser means:
> → ad blockers exclude your users
> → there's always flicker
> → events can't be sent server-side
>
> The shift to SSR (Astro, Next.js, Nuxt) isn't just about dynamic content.
> It's what makes experiment data accurate.

---

## Article 7 — UTM Parameters for A/B Testing: The Right Way to Force a Variant

**Hook:** You can use UTM params to force a specific variant — but most tools get the stickiness wrong.

**Body:**
- What UTM overrides are for: QA, email campaigns, demos, side-by-side comparisons
- The common mistake: UTM override sets a sticky cookie → user returns without UTM → still sees variant → pollutes your data
- The correct behavior: UTM overrides are per-request. No sticky cookie. Remove the UTM, revert to normal assignment.
- How to configure UTM rules in Koryla dashboard
- Example: email campaign where everyone in segment B sees the same variant, without contaminating organic traffic

**Conclusion:** Small architectural decision, big impact on data integrity.

**Instagram post:**
> `?utm_text=variation-1`
>
> You can use UTM params to force a specific A/B variant. Useful for email campaigns, QA, and demos.
>
> But most tools get this wrong: the UTM sets a sticky cookie. Remove the param, the user still sees the variant. Your organic traffic data is now contaminated.
>
> The correct behavior: UTM override is per-request only. No sticky cookie. Remove the param → normal assignment resumes.
>
> It's a small detail. It matters a lot when you're segmenting results.
