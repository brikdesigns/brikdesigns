# Surface — `/` (home)

**last-verified:** 2026-09-10 · **source:** `src/app/(marketing)/page.tsx` · **class floor:** `class:component` (a section add/remove here is `class:ia`)

The largest and most-referenced surface: `homepage.css` is imported by `/plans` and `/blog` too, so
a change here can reach three routes. It is also the R2/R3 redesign's reference implementation —
most of the decisions other pages cite were made here.

## Stylesheets

| Import | Owns | Note |
|---|---|---|
| `./homepage.css` | `.section-hero`, `.hero-*`, `.section-container`, `.section-problem`, `.section-services`, `.section-industries`, `.section-tooling`, `.tooling-marquee`, `.section-workflow`, `.workflow-step*`, `.section-pricing`, `.section-plans`, `.section-testimonials`, `.section-service-lines`, `.section-about`, `.home-cta` | **also consumed by `/plans` and `/blog`** — see § Shared-stylesheet reach |
| `./shared-sections.css` | sitewide bands + card-chrome-by-band | |

⚠ **Import order is reversed here.** Every other route imports `../shared-sections.css` *first*;
this file imports `./homepage.css` first (`page.tsx:18-19`). Both are unlayered, so order decides
ties — do not "normalise" it without checking what wins today.

## Sections, in render order

10 of 11 carry `data-section`; the hero does not — that is the **1** entry
`scripts/section-id-baseline.json` grandfathers for this file.
→ [`section-identification.md`](../section-identification.md)

| # | id | Element / class | Band | BDS / local in use |
|---|---|---|---|---|
| 1 | **none** — 1 grandfathered | `section.section-hero` | poppy brand band | `Cluster`, `Button` |
| 2 | `problems` | `section.section-problem` | tinted (the section, not a card) | `<ul>`/`<li>`, markers off |
| 3 | `problem-cta` | `section.section-problem-cta` | | `SectionHeader` + `Cluster` — the canonical grouped-text example |
| 4 | `services` | `section.section-services` | | `HomeServicesTabs`* (MediaTabs) |
| 5 | `industries` | `section.section-industries` — conditional | fixed-light yellow tint | `HomeIndustriesTabs`* |
| 6 | `tooling` | `section.section-tooling` | | `Marquee logoHeight={36} pauseOnHover` |
| 7 | `workflow` | `MediaBand as="section" className="section-workflow"` | | `MediaBand`, `BackgroundPattern variant="line-grid"` |
| 8 | `pricing` | `section.section-pricing` | | `Grid columns={3}`, `PricingCard`, `Image` |
| 9 | `testimonials` | `section.section-testimonials` | | |
| 10 | `service-lines` | `section.section-service-lines` | fixed-light accent-orange | `HorizontalScrollTrack`*, `ServiceLineCard`* ×5 |
| 11 | `cta` | `section.cta-section-brand.home-cta` > `.cta-card-brand` | brand panel, shared | `SectionHeader onColor`, `Button variant="on-color"` |

\* local components, not BDS.

`.section-pricing`, `.section-plans` and `.section-service-lines` all appear in the tinted-band
chrome rules (`shared-sections.css:844-845`, `:867-868`). Section 3 (`section-problem-cta`) is the
in-tree canonical example of grouped title+description with one boundary gap to the CTA
→ [`page-anatomy.md`](../page-anatomy.md) § grouping.

## Data

`revalidate = 3600`.

| Source | Feeds | Rule |
|---|---|---|
| `getServiceCategories()` | §10's five cards, plan-card illustration join | ordered by `rank` |
| `getServices()` | | |
| `getSupportPlans()` | §8's plan cards | |
| `PROBLEMS` (page-local) | §2 | verbatim from Figma — see constraints |
| `HOME_SERVICES_TABS`, `HOME_INDUSTRIES`, `TOOLING_LOGOS`, `WORKFLOW_STEPS`, `TESTIMONIALS`, `TEAM` (`@/lib/*`) | §4, §5, §6, §7, §9 + about | `HOME_INDUSTRIES` and `TEAM` are **shared** with `/how-we-work` and `/about` |

`Grid columns={3}` in §8 is fed by `getSupportPlans()` — a CMS row count. §10's card count is the
published `service_lines` count. Both can strand a trailing column.
→ [`page-anatomy.md`](../page-anatomy.md) § collection counts · gated by `tests/a11y/grid-column-fit.spec.ts`

## Ratified constraints — do not undo these

| Constraint | Why | Evidence |
|---|---|---|
| **All five** public `service_lines` render in §10, not the three Figma draws | OPERATOR SAID 2026-09-07: all lines are one-time-project offers | `page.tsx:447-450` |
| §8's plan cards take the plain `--surface-primary` fill; the per-card pale service tint is **retired** | operator decision 2026-08-31 (#1169). The service line still reads through the illustration and the themed CTA. Retiring the tint also retired the on-card text pin in `shared-sections.css` — that pin existed only because the tint was fixed-light in both themes | `page.tsx:345-355`, #1169 |
| §8's "Learn More" primary is themed to the card's own service line via `serviceCtaVars()` + `.service-themed` | the canonical service-button handoff; `.service-themed` opts into the dark-mode fill rule in `globals.css` | `page.tsx:357-360`, #1114 |
| `PROBLEMS` is verbatim from Figma node 25768:9531, **in Figma's order** | the redesign deliberately dropped three strings and split a fourth. Named in the file so the loss stays deliberate: **re-adding a line means adding it to the Figma frame first, not to this array** | `page.tsx:24-35`, #1268 |
| §2 is a `<ul>`/`<li>` with markers off, not cards | plain strings, no per-item action, no shared attribute set — the display-choice canon. The former tinted Card + 3-col Grid are gone; the section itself carries the tint now | `page.tsx:155-162`, #1268 |
| The `<ul>` in §2 is a **direct child** of `.section-container` | so `ScrollReveal`'s `contentTargets()` lands on `[title, list]` and the stagger ladder in `homepage.css` can key off the list's own reveal class | `page.tsx:159-162` |
| §6's marquee repeats the logo set **permanently**, not as a stopgap | only 11 logos render — the rest are licence-**BLOCKED**, not pending (`home-tooling.ts`). One pass falls short of the viewport, leaving the row inset instead of edge-to-edge. The duplicate group is `aria-hidden`, so the repeat multiplies decorative copies only | `page.tsx:241-249`, #1093 |
| §7's copy comes from the Homepage-R2 **Notion** doc; the placeholder Figma per-row buttons are ignored | Notion is the content SoT; one primary CTA at the section end | `page.tsx:268-274` |
| §7's media panels are `aria-hidden` decoration with `alt=""` | the step title + description carry the meaning | `page.tsx:273-276`, #1073 |
| §10 uses `HorizontalScrollTrack`, never hand-rolled scroll code | pinned GSAP scrub that degrades to a plain scrollable row under reduced-motion / coarse-pointer / no-JS | `page.tsx:450-453`, #1272, [`horizontal-scroll-track.md`](../horizontal-scroll-track.md) |
| §10's header sits in `.section-container`; the track is a **full-bleed sibling** | so the track can bleed past the right viewport edge while the header stays capped and centred | `page.tsx:453-455` |
| §10's on-band text pin is on the **header alone**, never the cards | the cards carry their own surface and would flip dark-on-dark in the dark root | `page.tsx:455-457` |
| §9/about's team cards are hand-built `<article>`s, not BDS `<Card>`; chrome lives in `.team-member` | a person's bio is not a Card's content shape. `card-treatment.spec.ts` asserts this section explicitly | `page.tsx:485-489`, #1274 |
| The about section animates as a **whole section**, not per-content | it is painted the page ground (`--surface-primary` == body), so there is no band edge to reveal against | `page.tsx:483-486`, [`band-animation.md`](../band-animation.md) |

## Shared-stylesheet reach

`homepage.css` is imported by `/plans` (`page.tsx:21`) and `/blog` (`page.tsx:9`) as the sanctioned
cross-page reuse path. A change to `.section-hero`, `.hero-*`, `.pricing-header`,
`.section-container` or `.section-plans` reaches those routes too. Check all three before editing a
shared class. → [`marketing-section-reuse.md`](../marketing-section-reuse.md)

## Governing references

- [`page-anatomy.md`](../page-anatomy.md) — §3 is the canonical grouping example; two live collection counts
- [`card-treatment.md`](../card-treatment.md) — §8, §10 and the retired on-card pin
- [`horizontal-scroll-track.md`](../horizontal-scroll-track.md) — §10, mandatory
- [`band-animation.md`](../band-animation.md) — why the about section reveals as a whole
- [`marketing-section-reuse.md`](../marketing-section-reuse.md) — this stylesheet's reach into two other routes
- [`service-token-decision-tree.md`](../service-token-decision-tree.md) — §8's themed CTA, §10's band
- [`section-identification.md`](../section-identification.md) — 1 grandfathered (the hero)
- [`image-optimization.md`](../image-optimization.md) — §7's illustrations, §6's logos
