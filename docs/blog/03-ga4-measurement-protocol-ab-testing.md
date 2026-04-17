# Why We Send A/B Test Events to GA4 Server-Side

*Status: draft*

---

GA4's client-side tag — `gtag.js` — is one of the most blocked scripts on the internet. uBlock Origin blocks it by default. Brave blocks it by default. Firefox's Enhanced Tracking Protection blocks it in strict mode.

When it's blocked, your experiment events don't arrive. Impressions fire but conversions don't. Your GA4 funnel looks broken. Your data is wrong.

There's a better way to send events to GA4. Most teams don't use it.

---

## The Measurement Protocol

GA4 has two ways to receive events: client-side via `gtag.js`, and server-side via the Measurement Protocol.

The Measurement Protocol is a simple HTTP API. You POST an event directly to Google's servers from your own server. No browser involved. No JavaScript required. No script for an ad blocker to target.

```
POST https://www.google-analytics.com/mp/collect
     ?measurement_id=G-XXXXXXXXXX
     &api_secret=<your_secret>

{
  "client_id": "session-identifier",
  "events": [{
    "name": "experiment_assigned",
    "params": {
      "experiment_id": "...",
      "variant_id": "...",
      "variant_name": "control"
    }
  }]
}
```

The `api_secret` is a server-side credential. It lives in your environment variables. It never reaches the browser. It cannot be scraped or blocked.

---

## The Broken Funnel Problem

Here's the specific failure mode that happens with client-side experiment tracking:

1. User visits the experiment page
2. Variant assignment script is blocked → no impression recorded
3. User converts
4. Conversion event is also blocked → no conversion recorded

Or a worse scenario:

1. Impression fires successfully (not blocked in this session)
2. User returns on a different device with ad blocking
3. Conversion fires but is blocked
4. GA4 shows: user entered experiment, never converted

In both cases, your GA4 data shows a broken funnel that doesn't reflect reality. You can't trust the conversion rates. You can't compare variants accurately.

---

## What the Data Looks Like With Server-Side Events

With Koryla, every impression and conversion is sent from the server to GA4 via the Measurement Protocol. The flow:

```
User visits experiment page
      │
      ▼
Server assigns variant (edge function or SSR)
Server sends: POST /mp/collect { event_name: "experiment_assigned" }
      │
      ▼
User converts
Server sends: POST /mp/collect { event_name: "experiment_converted" }
      │
      ▼
GA4 receives both events
```

No browser script involved in either step. Ad blockers see nothing to block.

In GA4 Explore, you can build a funnel: `experiment_assigned → experiment_converted`, segmented by `variant_name`. The numbers are accurate because both events come from the same server-side pipeline.

---

## Setting It Up

In the Koryla dashboard, go to **Settings → Analytics destinations → Google Analytics 4**. Enter:

- `measurement_id`: your GA4 property ID (e.g. `G-XXXXXXXXXX`)
- `api_secret`: found in GA4 → Admin → Data Streams → your stream → Measurement Protocol API secrets

Once configured, every experiment event is forwarded automatically. No code changes. No new SDK to install.

Your existing GA4 property receives the events. Your existing reports work. You don't migrate anything.

---

## What You Can Do With Accurate Funnel Data

When both impressions and conversions are accurate, a few things become possible that weren't before:

**Segmentation by variant in GA4 Explore** — build an exploration that filters by `experiment_assigned` with `variant_name = "b"`, then measures conversion rate. Compare to control with the same filter.

**Audience creation** — build a GA4 audience of users who were assigned to a specific variant. Use it for retargeting, analysis, or cohort comparison.

**Multi-experiment analysis** — if you're running edge and SDK experiments simultaneously, both fire events with the same `session_id`. You can join them in GA4 Explore to see how the page-level test interacted with the component-level test.

None of this requires leaving GA4. It just requires that the data arriving in GA4 is complete and accurate.

---

*→ See it working: [astro-demo.koryla.com](https://astro-demo.koryla.com)*
*→ How it's built: [github.com/andresclua/koryla-astro-demo-example](https://github.com/andresclua/koryla-astro-demo-example)*
