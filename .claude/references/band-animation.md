# Band animation

**A band's surface never animates. Its content does.**

Canonical rule: [`src/components/ui/ScrollReveal.tsx`](../../src/components/ui/ScrollReveal.tsx).
Gate: [`tests/a11y/band-animation.spec.ts`](../../tests/a11y/band-animation.spec.ts) — measured, light + dark.
Origin: #728 (decided), #1170 (made derived + gated), under round umbrella #1168.

## The rule

| Section | What animates |
| --- | --- |
| Painted the same as the page ground, or transparent | The **section**. Content and background rise together — invisible by design, because there's no edge to see. |
| Painted anything else — a **band** | The section's **content**. The surface stays put. |

"Band" is decided by **measurement**, not by class name:

```js
const ground = getComputedStyle(document.body).backgroundColor;
const bg = getComputedStyle(section).backgroundColor;
const isBand = !isTransparent(bg) && bg !== ground;
```

## Why measured and not a class list

This rule was decided once already, in #728 / BACKLOG-940, and shipped as four literal class names:

```js
'.service-surface, .page-section--secondary, .page-section--accent, .vband'
```

It covered the bands that existed the day it was written and nothing since. By 2026-08-31 there were 20+ tinted band rules across `src/app/(marketing)/**/*.css`, and six bands were animating as whole rectangles — three on `/how-it-works` (`.hiw-process`, `.hiw-practice`, `.hiw-industries`) and three on the home page (`problem-cta`, `industries`, `pricing`). The operator reported the original defect a second time.

**Do not reintroduce a class list here.** If a band is animating wrongly, the derivation is wrong — fix the derivation. Adding a class name is how this became a two-time defect.

## Why measurement is also the theme-correct answer

A class list cannot express what happens across themes; a measurement doesn't have to.

| Token | Light | Dark | Band? |
| --- | --- | --- | --- |
| page ground (`body`) | `rgb(255,255,255)` | `rgb(0,0,0)` | — |
| `--surface-primary` | `rgb(255,255,255)` | `rgb(0,0,0)` | **never** — tracks the ground in both |
| `--surface-secondary` | `rgb(241,240,236)` | `rgb(27,27,27)` | always |
| `--surface-accent-yellow` | `rgb(247,225,144)` | `rgb(247,225,144)` | always — fixed-light in both |

Measured 2026-08-31. So a `.page-section` is never a band in either theme, and an accent band is a band even on a black ground, with no per-theme branch in the code.

## Which elements carry a band's motion

`contentTargets()` descends through **single-child wrappers** (bounded by `MAX_UNWRAP_DEPTH`) and returns the first set of real siblings.

Marketing sections are near-universally `<section>` → one layout container → N content blocks, so this lands on the content:

```
section.hiw-industries        ← band, stays put
└── div.hiw-container         ← single child, descended through
    ├── .bds-section-header   ← animates
    └── .industries-tabs      ← animates
```

Tagging the container instead would re-create the whole-rectangle problem one level down.

## Preserved guarantees

Anything that changes this file must keep all four:

1. **No-JS / SEO safe** — classes are only ever applied from JS, so nothing is ever hidden in server markup.
2. **`prefers-reduced-motion: reduce` bails** before tagging anything.
3. **No hydration mismatch (#760)** — tagging is deferred behind a double `requestAnimationFrame` so it lands after `<main>`'s hydration lane commits.
4. **Above-the-fold content never flashes** — anything within `innerHeight * 0.85` at init is skipped.

## Testing note — the one spec that needs motion

Both Playwright projects set `contextOptions: { reducedMotion: 'reduce' }` so axe scans real foreground/background pairs instead of `opacity: 0` mid-reveal. ScrollReveal honours that and tags nothing.

`band-animation.spec.ts` therefore opts back in with `test.use({ contextOptions: { reducedMotion: 'no-preference' } })`. Without it the spec measures zero targets and every assertion passes vacuously — which is exactly what `expectMeasured` exists to catch, and did.

## Related

- Card border/shadow by band: [`card-treatment.md`](card-treatment.md) — also band-derived, on measured luminance
- Card media: [`card-media.md`](card-media.md) — derived on card structure, same anti-allowlist reasoning
- Section identity: [`section-identification.md`](section-identification.md)
