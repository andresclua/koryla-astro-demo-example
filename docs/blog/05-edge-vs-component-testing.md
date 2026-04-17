# Edge Testing vs Component Testing: Which One Do You Need?

*Status: draft*

---

Not all A/B tests are the same. Testing a button label is a fundamentally different operation than testing two completely different page layouts. Using the wrong type of test for the wrong change creates unnecessary complexity — or worse, a test that can't be run cleanly at all.

Koryla has two modes. Here's how to decide which one to use.

---

## The Core Question

**How different are the two variants?**

If your variants share the same page structure, navigation, and layout — only a specific element changes — you want a **component test**.

If your variants are so different that they effectively need to be separate pages — different layout, different sections, different component hierarchy — you want an **edge test**.

---

## Component Testing

The SDK layer runs inside your framework during server-side rendering. You wrap a component in `<Experiment>`, define named slots for each variant, and the server renders only the active one.

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

**What it's good for:**
- Button or CTA copy
- Headlines and subheadings
- Hero section content
- Form layout or field ordering
- Pricing display (same page, different format)

**How it works:**
`getVariant()` runs in the component's server frontmatter. It reads the variant cookie or assigns one. Only the active slot is rendered — the other is never included in the HTML response. No client JavaScript needed.

**Tradeoff:**
Both variants live in the same file. If the variants are very different, the component file can get complex. If you need to test entirely different templates, you're fighting the tool.

---

## Edge Testing

The edge layer runs before your framework processes the request — at the network edge, in a Deno runtime. It intercepts the request, assigns a variant, and transparently rewrites the URL.

The browser requests `/pricing`. The edge function decides to serve `/pricing-b`. Astro renders `/pricing-b`. The browser receives the HTML and sees `/pricing` in the address bar. No redirect. No history change.

**What it's good for:**
- Full page layout (sidebar vs no sidebar, card vs table layout)
- Different navigation structures
- Entirely different component hierarchies
- Testing a new design system against the old one

**How it works:**
Each variant is a separate Astro page file (`pricing.astro`, `pricing-b.astro`). The edge function matches the request path against the experiment's `base_url` and rewrites to the target variant's path. The rewrite is transparent.

**Tradeoff:**
You maintain two separate page files. If the pages share most of their content, you end up with duplication. Good for structural tests, overkill for copy changes.

---

## Combined: Edge Routes, SDK Adjusts

The most powerful pattern. The edge decides which page to serve. Inside that page, the SDK makes independent fine-grained decisions.

```
GET /demo-combined
      │
      ▼
Edge: 50% → /demo-combined (control layout)
      50% → /demo-combined-b (variant layout)
      │
      ▼
Inside /demo-combined-b:
<Experiment id="cta-test-uuid">
  <Variant slot="control">Start testing free →</Variant>
  <Variant slot="b">A/B test in 5 min →</Variant>
</Experiment>
```

Two experiments. Two traffic splits. Two separate sets of events in GA4. You can measure whether layout and CTA copy interact, or analyze them independently.

---

## Decision Guide

| Change you're testing | Use |
|---|---|
| Button or link copy | Component |
| Headline text | Component |
| CTA placement on page | Component |
| Hero section content | Component |
| Form fields or order | Component |
| Entire page layout | Edge |
| Navigation structure | Edge |
| New vs old design system | Edge |
| Different marketing angle (same URL) | Edge |
| Page layout + element within it | Combined |

---

## One Rule

Both tests can run on the same URL. They fire separate impression events with separate experiment IDs. They are tracked independently in GA4. Running both simultaneously does not require coordination — each layer is unaware of the other.

---

*→ See all three types live: [astro-demo.koryla.com](https://astro-demo.koryla.com)*
