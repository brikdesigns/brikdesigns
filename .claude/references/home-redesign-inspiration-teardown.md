# Home Redesign — Inspiration Teardown & Pattern Vocabulary

**Status:** PROPOSED — needs operator ratification before any BDS/token work is filed.
**Date:** 2026-08-26 · **Context:** Figma home redesign (node 25157-16798). brikdesigns.com committed to **Premium** motion tier as our own client site.

Live teardowns (Playwright, measured this session) of 4 inspiration sites, mapped to Brik's three-tier motion system (Lightweight CSS → GSAP → Premium) and BDS. Goal per Brik doctrine: extract animations/effects as a **reusable, named, token-driven pattern vocabulary**, not one-off hand-code.

All proposed tokens/components below were validated **absent** from `node_modules/@brikdesigns/bds/dist/tokens.css` and `bds-manifest.json` this session — they are genuine gaps. Existing motion tokens: `--duration-fast/normal/slow` (+ `--duration-100..600`), `--ease-in/out/in-out/spring`. No linear ease, no long-duration token, no bezier eases beyond spring.

## Pattern vocabulary

| Pattern | Source (measured) | Mechanism | Tier | BDS today | Add |
|---|---|---|---|---|---|
| **LogoTicker / Marquee** | base.org: 55s linear, ~72px/s, 40px gap, 24px logos, edge mask `transparent→black 10%→90%→transparent`, no lib, no pause-on-hover, **no reduced-motion** | 2 duplicate logo groups on a `flex w-max` track, `@keyframes translateX(0 → -50%)`, dupe group `aria-hidden` | **Lightweight** (pure CSS) | ❌ absent | `Marquee`/`LogoTicker` cmpt; tokens `--duration-marquee`, `--ticker-gap`, `--ticker-logo-height`, `--ease-linear`. Logos = pre-monochromed SVG per band, not runtime `grayscale()`. |
| **MediaTabs** (peer categories) | customer.io "Meet your AI Agent": Radix vertical tabs, 3 items, auto-advance ≈5s (exact unverified), Lottie panels, description reveal `grid-template-rows 0fr→1fr` 200ms `cubic-bezier(0,0,0.2,1)`; instant panel swap; no progress cue, no pause-on-hover, no reduced-motion | `TabBar` (vertical) + media slot (`lottie-react`) + autoplay timer + IntersectionObserver gate | **Lightweight** (+ Lottie, already in toolkit) | `TabBar` ✓; no autoplay / media-compose | `--tabs-autoadvance` (≈5s), `--ease-decel` = `cubic-bezier(0,0,0.2,1)`; add animated progress cue |
| **SyncedMediaSteps** (sequence) | Asana "Build your own AI Teammate": 3 steps, auto-advance ~10s, staggered crossfade (out 0.3s `cubic-bezier(0.61,0.03,1,0.82)` / in 0.5s `cubic-bezier(0,1.08,0.77,1.01)` +0.25s delay), progress bar 10s linear, height `0.3s ease-in-out`; role=tab a11y on accordion visuals; no reduced-motion | `Accordion` rows ↔ synced media crossfade + countdown, autoplay + pause-on-exit + click-override | **Lightweight** (JS timer + IO; **no GSAP** — no scrub/pin) | `Accordion` ✓; no sync/autoplay/countdown | `--duration-crossfade` (500ms), `--autoplay-interval` (10s), `--ease-accel` = `cubic-bezier(0.61,0.03,1,0.82)`, `--ease-overshoot-soft` = `cubic-bezier(0,1.08,0.77,1.01)` |
| **BackgroundPattern** (dot/line grid) | customer.io "Supercharge your messaging": static `radial-gradient(circle, <oklab> 1px, transparent 1px)`, 15px pitch, 1px dot, layer opacity 0.3, `absolute inset-0 z-0` | CSS gradient behind content, optional `mask-image` edge-fade | **Lightweight** (static CSS; Premium upgrade = Granim/pointer-drift) | ❌ absent | `BackgroundPattern` cmpt (kinds: dot-grid, line-grid); tokens `--bg-grid-color`, `--bg-grid-size`, `--bg-grid-dot-size`, `--bg-grid-opacity`, `--bg-grid-fade` |
| **Z-Index Media Band** | teak.io footer/CTA (Framer): `relative z:1` parent (stacking context, `overflow:clip`) → decorative graphic `absolute z:0` → content `relative z:2` → seam-fade gradient `absolute z:4`. Depth via gradient masks + token scrims, **no blend modes**. Not parallax. Framer respects reduced-motion (short-circuits appear anims to final state). | positioned-parent stacking recipe | **Lightweight** static → **GSAP** only if pinned/parallax needed | ❌ no band/seam primitive | `--bg-band-graphic` (SVG/URL swap), `--bg-band-surface`, `--bg-band-seam-from`, `--bg-band-seam-to` |
| **Ambient Motion Field** | teak.io: 2D-canvas "Gravity" field + Lottie behind content (`abs z:1`); MagneticHover pointer-attraction | Lottie loop (preferred, low-cost) or 2D-canvas particles (physics feel) | **Premium** | ❌ no Lottie wrapper / canvas primitive / static-frame fallback | `--bg-field-src` (Lottie JSON), `--bg-field-tint`, `--bg-field-opacity`; **must** freeze to poster frame under reduced-motion |

## Accordion vs Tab — decision rule

- **Tabs** → peer/parallel options, mutually exclusive, large media panels, desktop-first, low count. (Asana "Meet your Teammates", customer.io "AI Agent")
- **Accordion** → a readable **sequence** (steps 1→2→3), labels stay visible, must stack cleanly on mobile. (Asana "Build your own")
- Tie-breakers: many items OR tall content → accordion.

## Applied to the mockup

| Mockup section | Pattern | Decision |
|---|---|---|
| Services (Marketing / Back-Office toggle) | peer switch | **Tabs / SegmentedControl** |
| Industries (Dental / Real Estate / Small Business) | peers, but Figma drew accordion | **Tabs** (ratified 2026-08-26 — peers, not a sequence) |
| Tooling | **LogoTicker** (new) | Lightweight |
| Workflow (z-index bg) | **Z-Index Media Band** (+ optional **Ambient Field**, Premium — allowed) | GSAP only if pinned/parallax |

## Cross-cutting lessons for our system

1. **Tokenize every graphic color; build depth with gradient masks + token scrims, not blend modes** — teak.io drives all 50 colors through tokens; masks are cheaper and predictable across light/dark, swap per client via one token.
2. **Ship `prefers-reduced-motion` + pause-on-hover as defaults** — all 4 sites skip or half-do this. This is Brik's quality bar, not something to copy.
3. **Prefer the lowest tier that works** — a ticker is Lightweight even on a Premium site; reserve GSAP/canvas for the workflow band + ambient field.

## Provenance

Teardown method + measured values are the source of truth; issue prose is not. Re-run the Playwright inspection before treating any measurement as canon if adopting months later — vendor sites drift.
