# Horizontal scroll track

**A pinned horizontal card track is an upgrade to a scrollable row, never a replacement for one.**

Primitive: [`src/components/ui/HorizontalScrollTrack.tsx`](../../src/components/ui/HorizontalScrollTrack.tsx)
Geometry: [`src/lib/horizontal-scroll-track.ts`](../../src/lib/horizontal-scroll-track.ts)
Gate: `npm run test:hscroll` — headless geometry. Rendered assertions land with the first consumer (#1273).
Origin: #1272, under home-rebuild umbrella #1047.

## The decision — GSAP enters brikdesigns.com

Recorded here because this repo has no `docs/adr/` and `.claude/references/` is
where the site's build decisions live (see [`band-animation.md`](band-animation.md)).

`gsap@3.15.0` is a pinned runtime dependency, imported **dynamically** inside
the primitive. GSAP has zero transitive dependencies; the two `npm audit`
moderates in this repo (`@humanfs/node` via eslint, `sanitize-html`) predate it.

This is not a new bet. The BDS motion tiers already sanction the pattern —
from brik-rag, *Document: Tiers § Tier comparison*:

> | **GSAP** | … | Design calls for scroll pinning, scrubbing, **horizontal scroll panels**, text splitting. | ~120 KB JS |

Tier vocabulary: `brik-bds/content-system/vocabularies/animation-tier.ts`.

**What BDS does not have is a React primitive.** The toolkit targets the Phase
03 vanilla-HTML mockup pipeline and loads GSAP from a CDN. Hence this file.

Two things the toolkit says that do not survive contact with this repo:

| Toolkit | Here | Why |
| --- | --- | --- |
| GSAP from CDN | pinned npm dep, dynamic `import()` | a CDN `<script>` is not a thing a Next.js route bundle can tree-shake or version-pin |
| `xPercent: -100 * (panels.length - 1)` + `snap` | measured overhang, no snap | the recipe is a full-viewport **panel deck**; ours is a continuous **card track** |

Transcribing the recipe verbatim strands the last card: `panels.length` has no
relationship to how far a row of 512px cards must travel.

## The three states, in priority order

`shouldScrub()` is the only place this is decided, and the order is load-bearing:

1. **`prefers-reduced-motion: reduce`** → never pin. Pinning hijacks the scroll, which is the precise thing the preference asks us not to do.
2. **No overhang** → never pin. Every card already fits; pinning would freeze the page for no payoff.
3. **Coarse pointer** → never pin. Native momentum scrolling beats a scrubbed pin on touch.

Otherwise: pin the section, scrub the track by the **measured** overhang.

A test asserts the *ordering*, not just the outcomes — if the overhang or
pointer check ever moves above the preference check, a reduced-motion visitor
gets pinned, and no visual review would catch it.

## Why the base state is the fallback

The stylesheet alone renders a scrollable row. Nothing is hidden, clipped, or
transformed until JS measures a real overhang and opts in. This preserves the
guarantees [`band-animation.md`](band-animation.md) § Preserved guarantees
requires of anything on this site that moves:

1. **No-JS / SEO safe** — every card is in server markup and reachable.
2. **Reduced motion bails** before anything is pinned.
3. **No hydration mismatch (#760)** — attribute mutation is deferred behind a double `requestAnimationFrame`.

## Two owners of one `transform`

A tinted section is a **band**, so ScrollReveal tags its *content* for reveal —
and `.scroll-reveal` animates `transform`. The GSAP scrub also owns `transform`
on the track.

The root therefore carries `data-no-reveal`, and ScrollReveal skips any
candidate inside one ([`ScrollReveal.tsx`](../../src/components/ui/ScrollReveal.tsx)).

**This is an opt-out declared by the owning component, not a band allowlist.**
The distinction matters: `band-animation.md` forbids re-introducing a class
list *for deriving band-ness*, and that derivation is untouched and still
measured. A section carrying a track still reveals every child that isn't
inside it. #1271 is the standing precedent for what double-tagging costs.

## Keyboard reachability

With the scrub engaged the viewport no longer scrolls natively, so the
browser's own `scrollIntoView` has nothing to scroll and a card tabbed to
off-screen would stay off-screen — a WCAG 2.1.1 failure.

The primitive maps a focused card's position along the track onto the page
scroll that reveals it. The fallback viewport is `tabIndex={0}` with an
`aria-label`, because a scrollable region that keyboard users cannot reach or
identify fails the same criterion from the other direction.

## Reference behaviour — measured, not assumed

`https://www.freedomgp.com/` `.section_portfolio`, Playwright, 2026-09-07:

| Property | Value |
| --- | --- |
| driver | `gsap` + `ScrollTrigger` |
| pin | yes — section holds `top: 0` across the scrub |
| clip window | `.cms-wrapper`, `overflow-x: hidden`, 1232px |
| track | `.portfolio-cards-row`, `scrollWidth` 2028px |
| translate | `0 → −913px` |
| per-card | off-centre cards `scale(0.95)` + `opacity 0.7` |

The per-card scale/opacity is **not** implemented here — it wasn't in the Figma
design (node 25936:5132) and no operator asked for it. Noted so the next reader
doesn't mistake its absence for an oversight.

## Related

- [`band-animation.md`](band-animation.md) — the subtle tier and the band rule
- Reveal-collision precedent: #1271
- First consumer: #1273
