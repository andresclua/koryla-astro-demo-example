# Why Koryla — Server-Side A/B Testing That Works With Your Analytics

## The Problem With Browser-Based A/B Testing

Every major A/B testing platform works the same way. JavaScript loads, the page renders, then the tool swaps content to show the variant. For a fraction of a second the user sees the original version before the variant appears — the **flicker problem**. It has been the accepted tradeoff for years.

There is a second, less visible problem: browser-based testing tools depend on JavaScript running successfully. Ad blockers, tracking prevention, and privacy extensions can silently block these scripts. When they do, those visitors are excluded from your experiment — or worse, recorded with bad data.

The result: your A/B test results in GA4 are skewed before you even look at them.

---

## Koryla Doesn't Replace Your Analytics. It Makes Them Accurate.

Koryla is not a dashboard. It does not ask you to migrate your data or learn a new reporting tool. You keep GA4. You keep your existing reports, audiences, and funnels.

What Koryla changes is the **quality of the data that gets there**.

Variant assignment happens server-side — at the network edge, before any HTML is sent to the browser. There is no JavaScript to block. There is no flicker to skew conversion rates. Impressions and conversions are sent directly to GA4 via the Measurement Protocol, server-side, bypassing ad blockers entirely.

The experiment events appear in GA4 as `experiment_assigned` and `experiment_converted`. You analyze them exactly where you already work.

---

## What Bad Data Costs You

Browser-based testing systematically excludes privacy-conscious users — the ones with ad blockers and tracking prevention enabled. In many audiences, that is 20–40% of visitors. They tend to be more technical, more engaged, and higher-intent.

When those users are excluded from your experiment:
- Your sample is not representative
- Conversion rates look different than they actually are
- You ship the wrong variant

With server-side testing, every visitor is included. The data in GA4 reflects your real audience.

---

## How It Works

Koryla intercepts requests at the network edge before the page renders. It assigns a variant, serves the correct HTML, and records the impression — all before the browser receives the first byte.

```
Visitor arrives
      │
      ▼
  Koryla assigns variant (edge, before HTML)
      │
      ├─→ Correct HTML delivered to browser (no flicker)
      └─→ Impression sent to GA4 (server-side, bypasses ad blockers)

Visitor converts
      │
      └─→ Conversion sent to GA4 (server-side, bypasses ad blockers)
```

Your GA4 property receives clean, complete, accurate experiment data.

---

## Two Testing Modes

**Edge** — test entire pages. Two completely different layouts share one URL. The rewrite is transparent to the browser.

**SDK** — test components. Wrap any element in `<Experiment>`. Only the active variant is rendered in the HTML — the other is never sent to the browser.

Both modes send events to the same GA4 property. You see all experiments in one place.

---

## The Setup

- One environment variable (`KORYLA_API_KEY`)
- One edge function file
- One line in `netlify.toml`
- GA4 property + Measurement Protocol API secret

That is the full integration. No new dashboard to learn. No data migration. No vendor lock-in on your analytics.

Experiment results live in GA4, where your team already works.
