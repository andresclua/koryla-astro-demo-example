# The Flicker Problem Nobody Talks About

*Status: draft*

---

Every A/B testing tutorial skips the same part: the moment where the user sees the wrong version first.

It's called flicker. It happens in milliseconds. And it's been the accepted tradeoff of browser-based A/B testing for years — quietly baked into every tutorial, every tool, every "getting started" guide.

Here's what it actually costs you.

---

## What Flicker Is

Browser-based A/B testing tools work by injecting JavaScript into the page. The sequence goes like this:

1. Browser receives HTML
2. Browser renders the page
3. JavaScript loads and executes
4. Tool identifies which variant to show
5. Tool swaps the content

Step 4 and 5 happen after step 2. By the time the tool makes its decision, the user has already seen the default version. The swap is fast — often under 100ms — but not instantaneous. The user sees the control for a fraction of a second before the variant appears.

On a fast laptop with a fast connection, this is nearly imperceptible. On a mid-range Android phone on a 4G connection, it's visible. On a slow connection, it's obvious.

---

## Why It's Not Just a UX Problem

Flicker affects your data, not just your user experience.

When a user sees both versions in the same session — even for milliseconds — their impression data is compromised. They registered a partial view of the control before being shown the variant. Their subsequent behavior reflects an experience that neither variant was designed to create.

More specifically: flicker makes your variant look worse than it is.

Users who notice a flash of unexpected content are more likely to disengage. If your variant has a bolder design or a different layout, the flash creates cognitive friction that the variant itself would not have created on a clean load. You're measuring the variant plus the transition cost — not the variant alone.

---

## The Anti-Flicker Snippet Problem

Most tools offer an "anti-flicker snippet" as the solution. The snippet hides the page until the JavaScript has loaded and executed.

```html
<style>.async-hide { opacity: 0 !important }</style>
<script>
  window.dataLayer = window.dataLayer || [];
  (function(a,s,y,n,c,h,i,d,e){...})(window,...);
</script>
```

This solves the visual problem by making it invisible. But it creates a new one: the page is blank until the script executes. If the script loads slowly — due to network conditions, ad blockers, or script errors — the user sees a blank white page.

You traded a flash for a potential blank screen. Neither is a good outcome.

---

## The Only Real Fix

The root cause of flicker is that the variant decision happens in the browser, after the page has already rendered.

The fix is to move the decision earlier — to the server, before the HTML is generated.

When variant assignment happens at the network edge or during server-side rendering, the browser receives the correct version directly. There is no swap. There is nothing to flash. The page loads and it is already the right variant.

```
Before (browser-based):
  HTML arrives → page renders → JS executes → variant swap
                                              ↑ flicker happens here

After (server-side):
  Variant assigned at edge → correct HTML generated → page renders
                                                        ↑ no swap needed
```

This is not a performance optimization. It is an architectural change that eliminates the problem entirely.

---

## What This Looks Like in Practice

With Koryla, the variant decision happens in a Netlify edge function — before Astro processes the request. The edge function reads the variant cookie (or assigns one), and transparently serves the correct page.

For component-level tests, the `<Experiment>` component renders only the active slot during server-side rendering. The inactive variant is never included in the HTML response.

In both cases, by the time the browser receives the first byte, the decision has already been made. There is no JavaScript swap. There is no flicker.

---

## The Uncomfortable Truth

Flicker has been normalized in the A/B testing industry because the alternative — server-side rendering — was until recently harder to set up. The industry built workarounds (anti-flicker snippets, faster scripts, CDN-loaded testing tools) instead of addressing the architecture.

The ecosystem has changed. SSR frameworks like Astro, Next.js, and Nuxt are now the default for production web applications. Edge functions are available on every major hosting platform.

The workarounds are no longer necessary. The architectural fix is accessible.

---

*→ See it working: [astro-demo.koryla.com](https://astro-demo.koryla.com)*
*→ How it's built: [github.com/andresclua/koryla-astro-demo-example](https://github.com/andresclua/koryla-astro-demo-example)*
