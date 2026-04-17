# Your Ad-Block Users Are Missing From Your A/B Tests

*Status: draft*

---

You're making product decisions based on data that excludes your most valuable users.

Not because they opted out. Because their browser silently blocked your testing script — and your tool recorded nothing.

---

## The Scale of the Problem

Ad blocker usage varies significantly by audience. General consumer sites see 15–25% ad block rates. Developer-focused products, SaaS tools, and privacy-conscious audiences routinely see 30–50%.

These aren't fringe users. In the audiences where Koryla's customers operate, they are often the majority of high-intent visitors.

Browser-based A/B testing tools inject a JavaScript snippet to manage variant assignment and track events. Ad blockers, uBlock Origin, Brave's built-in blocking, and Firefox's Enhanced Tracking Protection all target these patterns. When the script is blocked, those users are excluded from the experiment entirely — no impression recorded, no variant assigned, no conversion tracked.

---

## What "Excluded" Actually Means

When a user is excluded from an experiment, one of two things happens:

**Scenario A:** They see the control (default) regardless of the traffic split. Your variant never reaches them. Your conversion data for the variant is based on users without ad blockers only.

**Scenario B:** The tool assigns them randomly but fails to record the impression. They convert. The conversion gets attributed to a variant that has no impression record. Your funnel is broken.

Neither scenario gives you accurate data.

---

## The Specific Bias You're Introducing

Users with ad blockers are not a random sample of your audience. They tend to be:

- More technically sophisticated
- More privacy-aware
- More deliberate in their online behavior
- In B2B contexts, often the decision-makers or technical evaluators

These are exactly the users whose conversion behavior you want to understand. They are the ones most likely to evaluate your product seriously, read your documentation, and recommend it to their team.

When they're excluded from your experiment, your conversion rates reflect a skewed sample. A variant might perform well among users without ad blockers and poorly among those with them — or vice versa. You ship based on the non-representative half.

---

## A Concrete Example

Imagine you're testing two versions of a pricing page. Variant B has a more detailed feature comparison table — more information, longer page.

Among users without ad blockers (casual browsers, less technical): Variant A wins. Less text, faster decision.

Among users with ad blockers (technical, deliberate, high-intent): Variant B wins. More information supports their evaluation process.

If 35% of your audience has ad blockers, and they all see the control by default, your test shows Variant A winning. You ship it. You've optimized for the wrong segment.

You never knew the other segment existed in your data.

---

## The Fix

Server-side variant assignment eliminates this problem at the root. There is no JavaScript injected into the browser. There is no script for an ad blocker to target. The decision happens at the edge or on the server — before the browser is involved.

With Koryla, variant assignment happens in a Netlify edge function. Event tracking (impressions and conversions) is sent from the server to GA4 via the Measurement Protocol. There is nothing in the browser to block.

Every visitor is included in the experiment. Your conversion data reflects your actual audience.

---

## One More Layer: Analytics Events

Even if your variant assignment survives the ad blocker, your analytics events might not.

GA4's `gtag.js` is one of the most widely blocked scripts on the internet. When it's blocked, impression events fire but conversion events don't — or neither fires. Your funnel in GA4 shows users entering experiments but not converting, even when they do.

The Measurement Protocol sends events from the server directly to GA4. No browser script. No blocking. The `api_secret` lives in your server environment and never reaches the browser.

You keep GA4. You keep your existing reports. The data is just accurate.

---

*→ See it working: [astro-demo.koryla.com](https://astro-demo.koryla.com)*
*→ How it's built: [github.com/andresclua/koryla-astro-demo-example](https://github.com/andresclua/koryla-astro-demo-example)*
