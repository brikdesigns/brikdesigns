# Surface — `/how-we-work`

**last-verified:** 2026-09-10 · **source:** `src/app/(marketing)/how-we-work/page.tsx` · **class floor:** `class:component`

The process page. Route is `/how-we-work`; the page's *subject* is "How It Works" — do not rename
either to match the other (see constraints).

## Stylesheets

| Import | Owns | Note |
|---|---|---|
| `../shared-sections.css` | `.cta-section-brand` / `.cta-card-brand`, card-chrome-by-band (incl. `.hiw-practice`) | sitewide |
| `./how-we-work.css` | the whole `hiw-*` vocabulary: hero, container, timeline, step cards, checklist, modes, practice, industries, CTA | this page builds its own scaffolding — it uses **no** `.page-section` / `.page-hero` |

## Sections, in render order

**5 sections, all 5 identified** by `data-section`. This file has **no** entry in
`scripts/section-id-baseline.json`.

*Resolves the count mismatch flagged in #1376: the source has 5 `<section>` elements and 5 ids —
an earlier `rg -c '<section'` sweep reported 4 because one is indented inside a conditional.*

| # | id | Element / class | Band surface | Card chrome | BDS / local in use |
|---|---|---|---|---|---|
| 1 | `hero` | `section.hiw-hero` | `--surface-accent-blue` full-bleed, ink darkened not band | — | — |
| 2 | `process` | `section.hiw-process` | own, from `how-we-work.css` | app-local `.hiw-card`, not a BDS `Card` | `ProcessFoundationTiers`*, inline SVGs |
| 3 | `practice` | `section.hiw-practice` | tinted | **shadow, no border** — `.hiw-practice` is hand-added to the tinted-band list (`shared-sections.css:846`) | `Grid columns={2}`, `Card`, `CardTitle`, `CardDescription`, `Badge` |
| 4 | `industries` | `section.hiw-industries` — **conditional** on `industriesTabs.length > 0` | fixed-light yellow tint, on-band text pinned dark in `how-we-work.css` | — | `HomeIndustriesTabs`* (the home's MediaTabs) |
| 5 | `cta` | `section.cta-section-brand.hiw-cta` > `.cta-card-brand` | brand panel, shared and reused | — | `Cluster`, `Button variant="on-color"` + `variant="outline"` |

\* local components, not BDS.

`.hiw-practice` is a **third** bespoke tinted band beyond the two `shared-sections.css:835-839`
calls out by name (`.contact-plans`, `.section-plans`). All three must stay enumerated in the chrome
rule; `tests/a11y/card-treatment.spec.ts` fails by name if one is missed.
→ [`card-treatment.md`](../card-treatment.md)

Section 2's timeline is deliberately **app-local, outside BDS** (#1121) — `.hiw-step__badge`'s dark
inverse fill is not a BDS `Badge` tone. Do not "fix" it by swapping in `Badge`.

## Data

| Source | Feeds | Rule |
|---|---|---|
| `PROCESS_STEPS`, `PRACTICE_CARDS` (`@/lib/how-we-work`) | sections 2, 3 | page-local SoT |
| `HOME_INDUSTRIES` (`@/lib/home-industries`) | section 4 | **shared with the home page** — one SoT, two surfaces |
| `getManagedPlanPrices()` | step 2's segmented control | **DB is the pricing SoT (#1123)** — no price literal |

`Grid columns={2}` in section 3 is fed by `PRACTICE_CARDS`; a count change must move the grid rule
in the same commit. → [`page-anatomy.md`](../page-anatomy.md) § collection counts

## Ratified constraints — do not undo these

| Constraint | Why | Evidence |
|---|---|---|
| Hero keeps the blue band and **darkens the ink**; emphasis words are poppy-800 (`#7d1d09`, 4.94:1) | Figma renders white ink, but white on `#8ebbcc` is ~1.9:1 — an AA fail. Operator decision on #1127: darken the ink, not the band. poppy-800 is the deepest brand orange clearing AA-body in both themes | `page.tsx:97-104`, #1127 |
| `metadata.title` is **bare** ("How It Works"), not suffixed | the root layout applies the `%s \| Brik Designs` template (`layout.tsx:11`); the prior value double-suffixed | `page.tsx:16-17` |
| Step-3 mode icons, `CheckIcon`, and the timeline check-circle are **inline SVG**, not `ph:*` via `@/lib/icon` | deliberately self-contained so the build does not wait on the Iconify offline subset. This is a **stated exception** to CLAUDE.md § ICONS, with the reason in the file | `page.tsx:25-26`, `page.tsx:54-58` |
| The timeline is app-local, outside BDS; `.hiw-step__badge` is not a BDS `Badge` | the dark inverse fill is not a BDS `Badge` tone | `page.tsx:122-123`, `page.tsx:143`, #1121 |
| Practice cards deep-link to a customer story **only when one exists** | not every practice card has a story | `page.tsx:235`, #1128 |
| Section 4 reuses `HomeIndustriesTabs` with the curated `HOME_INDUSTRIES` copy | one industries SoT for the home and this page; art is deliberately **decoupled** from the shared `industry_pages.image_url` icon | `page.tsx:83-86` |
| `BRIKDOWN_HREF` is `/offers/brikdown` | matches `/about` and the home; superseded the `-analysis` slug | `page.tsx:23` |

## Governing references

- [`card-treatment.md`](../card-treatment.md) — `.hiw-practice` is the third bespoke tinted band
- [`page-anatomy.md`](../page-anatomy.md) — layer identification, collection count in section 3
- [`section-identification.md`](../section-identification.md) — 5 of 5 identified, no baseline entry
- [`naming-conventions.md`](../naming-conventions.md) — the `hiw-*__title` / `__description` pairs follow the convention
- [`band-animation.md`](../band-animation.md) — if section 2's timeline gains scroll behaviour
- [`image-optimization.md`](../image-optimization.md) — section 4's `public/images/industries/` illustrations