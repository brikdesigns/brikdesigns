# Surface — `/plans`

**last-verified:** 2026-09-10 · **source:** `src/app/(marketing)/plans/page.tsx` · **class floor:** `class:component`

What this page is built from. Read this before changing a section here; it replaces
re-deriving the page from `page.tsx` plus three stylesheets. It does **not** restate the
cross-cutting rules — it names which ones govern each section.

## Stylesheets (import order matters)

| Import | Owns | Note |
|---|---|---|
| `../shared-sections.css` | `.page-section`, `.container-lg`, `.service-surface`, `.cta-section-brand` / `.cta-card-brand`, card-chrome-by-band | sitewide |
| `../homepage.css` | `.section-hero`, `.hero-*`, `.pricing-header` | cross-page reuse, the sanctioned interim path ([`marketing-section-reuse.md`](../marketing-section-reuse.md)) — not a copy |
| `./plans.css` | layout only: hero re-pin, header-row alignment, recommended fill, mode chip | **also serves `/plans/[slug]`** — see § Shared-stylesheet trap |

A class resolves only where its stylesheet is imported. Adding a class here without its
import renders unstyled with **no build error**.

## Sections, in render order

| # | id | Element / class | Band surface | Card chrome | BDS in use |
|---|---|---|---|---|---|
| 1 | `hero` | `section.section-hero.plans-hero` | `--surface-accent-blue` on `.hero-container`, ink re-pinned dark (white measures ~1.3:1) | — | `Cluster`, `Button` |
| 2 | `paths` | `section.page-section` | white `--surface-primary` (shared default) | `PricingCard` renders `.bds-pricing-card`, **not** `.bds-card` — so neither the tinted-band rule nor the 3px border-width standard reaches it (`shared-sections.css:840-861`). Its own BDS default stands; nothing here overrides it | `SectionHeader`, `Grid columns={3}`, `PricingCard`, `Image`, `Button` |
| 3 | `engagement-modes` | `section.page-section.service-surface` | back-office tint, set inline from `serviceColor('back-office').surfaceLight` | **shadow, no border** — carried by `.service-surface`, never a per-card prop | `SectionHeader`, `Grid columns={2}`, `Card`, `CardTitle`, `CardDescription`, `Icon` |
| 4 | `cta` | `section.cta-section-brand` > `.cta-card-brand` | brand panel (shared, reused verbatim) | — | `SectionHeader onColor`, `Button variant="on-color"` |

Section 1 is the Section layer; the thing a ticket would call "the hero card" is
`.hero-container` (Container layer). Section 3's tint is on the **Section**, while its mode
cards own their own surface — two different layers, not interchangeable.
→ [`page-anatomy.md`](../page-anatomy.md)

## Data

| Source | Feeds | Rule |
|---|---|---|
| `getSupportPlans()` | path-card copy + illustration | |
| `getManagedPlanPrices()` | Advisory / Managed tier prices | **the DB is the pricing SoT (#1123)** — no price literal on this page |
| `PATH_SLUGS` (page-local) | card order | Notion's argument order, deliberately **not** the DB `rank` |
| `ENGAGEMENT_MODES` (page-local) | section 3 cards | copy only |

`Grid columns={3}` in section 2 is fed by `PATH_SLUGS` (3 entries), `columns={2}` by
`ENGAGEMENT_MODES` (2). Changing either count is a **layout** change — the grid rule and the
data must move in the same commit.
→ [`page-anatomy.md`](../page-anatomy.md) § collection counts

## Ratified constraints — do not undo these

Each was decided against an agent's earlier build. Re-deriving this page from the mockup or
the CMS will re-propose all of them.

| Constraint | Why | Evidence |
|---|---|---|
| Full Stack's emphasis is a **card fill**, never a ring or a `highlighted` prop | the operator ratified "3 equal paths" in the #1287 session | `page.tsx:41-48`, #1304 |
| Section 3 titles are **Notion's** ("Advisory" / "Managed"), not Figma's parenthetical variants | Figma owns layout, Notion owns copy | `page.tsx:54-58`, #1303 |
| The mode-chip glyph is Phosphor `ph:stack-fill`, not Figma's Font Awesome trowel | FA is Figma-only; no Phosphor trowel or brick exists (0 of 9,161) | `page.tsx:237-243` |
| The chip is `aria-hidden` | the same mark repeats on every card and carries no per-mode meaning | `page.tsx:243` |
| Hero ink is re-pinned dark, mode-invariant | white on `--surface-accent-blue` fails AA outright; the token is fixed-light in both themes | `plans.css:3-19` |
| Section 3's band is `.service-surface`, not a bespoke band class | Figma's `#ffe8dc` **is** `--surface-service-back-office-light` | `page.tsx:128-131` |

## Shared-stylesheet trap

`plans.css` serves **both** `/plans` and `/plans/[slug]`. Everything from
`.plans-card-wrapper` (`plans.css:112`) down — `.plans-card-wrapper*`, `.plan-detail-*`,
`.plan-service-list*` — belongs to the detail route. Check which route a rule serves before
touching it.

## Governing references

- [`card-treatment.md`](../card-treatment.md) — sections 2 and 3 sit on opposite sides of the luminance rule
- [`page-anatomy.md`](../page-anatomy.md) — layer identification, collection counts, text-group rhythm
- [`marketing-section-reuse.md`](../marketing-section-reuse.md) — why `../homepage.css` is imported
- [`section-identification.md`](../section-identification.md) — all 4 sections carry `data-section`; this file has **no** entry in `scripts/section-id-baseline.json`, so a new un-identified section fails the gate
- [`naming-conventions.md`](../naming-conventions.md) — `__title` / `__description`, never `__heading`
- [`service-token-decision-tree.md`](../service-token-decision-tree.md) — section 3's tint and the two chip accents
