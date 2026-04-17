# UTM Parameters for A/B Testing: The Right Way to Force a Variant

*Status: draft*

---

UTM parameters have a use beyond attribution. You can use them to force a specific variant in an A/B test — useful for email campaigns, QA, and demos. But most tools implement this wrong, and it corrupts your data in a way that's hard to detect.

---

## What UTM Overrides Are For

Three legitimate use cases:

**Email campaigns** — You want everyone in segment B to see the variant CTA, regardless of their normal random assignment. You add `?utm_text=variation-1` to the email link. Every recipient who clicks it sees the variant.

**QA** — You want to verify that the variant renders correctly before pushing it to real traffic. You open the URL with the UTM param, confirm the variant, and remove it when done.

**Demos and side-by-sides** — You want to show a client or stakeholder both versions of a page without changing traffic weights. You open two tabs: one with the UTM param, one without.

---

## The Wrong Way: UTM Sets a Sticky Cookie

This is how most tools implement UTM overrides:

1. User arrives with `?utm_text=variation-1`
2. Tool reads the param
3. Tool assigns variant B
4. Tool sets `ky_experiment_id=variant-b` cookie
5. User returns without the UTM param
6. Tool reads the cookie → user still sees variant B

The intent was to force a variant for this campaign. The result is that this user is permanently in variant B, even on organic return visits.

If you're running a campaign where 10,000 people click through with the UTM param and get assigned to variant B, and then 3,000 of them return organically — those 3,000 returns are now contaminating your organic traffic segment. They see variant B because they were in the campaign, not because the algorithm assigned them there.

Your organic conversion data now includes campaign visitors. Your variant B organic performance looks different than it actually is.

---

## The Right Way: UTM Overrides Are Per-Request

The correct behavior: the UTM param forces a variant for that request only. It does not set a cookie. It does not change the user's permanent assignment.

```
Request with ?utm_text=variation-1 → serve variant B (no cookie set)
Next request without param → read existing cookie or assign randomly
```

If the user already has a cookie assigning them to control, remove the UTM param and they revert to control. The UTM was transient. The assignment is sticky only when made through the normal random assignment path.

This is what Koryla does. In `getVariant.ts`:

```typescript
const ruleMatch = findRuleMatch(variants, url.searchParams)
if (ruleMatch) {
  return { variantId: ruleMatch.id, isNewAssignment: false }
  // isNewAssignment: false → no cookie will be set
}
```

`isNewAssignment: false` means the component (or edge function) will not call `Astro.cookies.set()`. The variant is served. No trace is left in the browser.

---

## Why This Matters for Campaign Analysis

When you send an email campaign to a segment, you want to measure how that segment responds to the variant. You add the UTM param to track attribution.

But you don't want the campaign click to permanently alter the user's experience for future organic visits. Those are different contexts, and mixing them corrupts both data sets.

With per-request UTM overrides:
- Campaign click → sees variant B → conversion attributed to campaign with variant B ✓
- Organic return → sees control (their assigned variant) → organic data uncontaminated ✓

With sticky UTM overrides:
- Campaign click → sees variant B → cookie set to variant B
- Organic return → still sees variant B → organic data contaminated with campaign cohort ✗

---

## Configuring UTM Rules in Koryla

In the Koryla dashboard, per variant you can add rules:

```
Variant B:
  Rules:
    - param: utm_text
      value: variation-1
```

When a request arrives with `?utm_text=variation-1`, variant B is served. No other logic runs. No cookie is written.

You can layer multiple rules per variant, and multiple variants can have different rules. The first matching rule wins.

---

## A Note on Impression Tracking

UTM-overridden visits still fire an impression event. This is correct — the user was shown the variant, which is a real impression. But the impression is tagged with the session ID, which you can use in GA4 to separate campaign impressions from organic impressions by filtering on `utm_source` or `utm_medium` in the event metadata.

The data is clean. Campaign and organic are separate. Both are accurate.

---

*→ See UTM override in action: [astro-demo.koryla.com/demo-sdk?utm_text=variation-1](https://astro-demo.koryla.com/demo-sdk?utm_text=variation-1)*
*→ Source code: [github.com/andresclua/koryla-astro-demo-example](https://github.com/andresclua/koryla-astro-demo-example)*
