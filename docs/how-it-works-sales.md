# Why Koryla — The Case for Server-Side A/B Testing

## The Problem Every A/B Testing Tool Has

Every major A/B testing platform works the same way. JavaScript loads in the browser, the page renders, then the tool swaps content to show the variant. It happens fast — but not fast enough. For a fraction of a second, the user sees the original version before the variant appears.

This is called the **flicker problem**. It has been the accepted tradeoff for years.

It is not just an aesthetic issue. Flicker means the user momentarily sees content that was not meant for them. It undermines trust in the data. It degrades the user experience. And it only gets worse on slow connections and low-end devices — exactly the users you most need accurate data on.

There is a second problem: browser-based testing tools depend on JavaScript running successfully. Ad blockers, tracking prevention, and privacy extensions can intercept or block these scripts. When they do, that visitor is excluded from your experiment entirely, or recorded inaccurately.

---

## How Koryla Is Different

Koryla makes the variant decision **before any HTML is sent to the browser** — at the network edge, before the page even begins to render.

By the time the first byte arrives, the correct version is already chosen. There is no JavaScript involved in the decision. There is no content swap. There is no flicker.

The user simply sees the right version, immediately.

---

## What This Means in Practice

**Accurate data on every visitor.**
Variant assignment happens at the server. It cannot be blocked. Ad blockers, privacy extensions, and disabled JavaScript have no effect on experiment accuracy. You measure what actually happens.

**No performance cost.**
Traditional A/B tools add JavaScript that must load, parse, and execute before the page stabilizes. Koryla adds no client-side overhead. Your Core Web Vitals are unchanged. Your Lighthouse scores stay clean.

**No flicker, ever.**
The HTML delivered to the browser is already the correct variant. There is no moment where the wrong version is visible, because there is no swap — the right version is what was rendered.

**Sticky sessions that work.**
Visitors see the same variant on every return visit for 30 days. The assignment is stored in a cookie set by the server, not by JavaScript after the fact. It is reliable from the first visit.

**Real-time propagation, no redeployment.**
Change traffic weights, pause an experiment, or add a UTM rule in the dashboard. Changes propagate within 60 seconds — no code change, no redeployment required.

---

## Two Modes, One Platform

### Test entire pages

The Edge layer intercepts requests at the network level and transparently serves a different page to each variant. The URL stays the same. The browser never knows a rewrite happened. This is ideal for testing fundamentally different layouts, pricing structures, or landing pages.

### Test components

The SDK layer renders only the active variant during server-side rendering. The inactive variant is never included in the HTML. Wrapping any element in `<Experiment>` is enough to start a test — no configuration beyond the experiment ID.

Both modes run simultaneously. An edge experiment can control which page is served, while an SDK experiment independently tests the CTA copy within that page.

---

## Analytics That You Can Trust

Impressions and conversions are sent server-side through Koryla directly to GA4 via the Measurement Protocol. The GA4 Measurement Protocol API secret never reaches the browser. Events cannot be blocked.

You see accurate experiment data in your existing GA4 property — no new analytics tool to learn, no dashboard migration.

---

## Who This Is For

Koryla is for teams building on modern SSR frameworks who have outgrown browser-based testing. It is particularly valuable when:

- Performance and Core Web Vitals are a priority
- The audience uses privacy tools or ad blockers at high rates
- Testing full-page layouts, not just button colors
- Accurate conversion data matters more than ease of setup

If your current testing tool causes flicker, inaccurate data, or performance regressions — Koryla solves all three at the architecture level.
