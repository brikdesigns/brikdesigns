# Surface — `/industries`

**last-verified:** 2026-09-10 · **source:** `src/app/(marketing)/industries/page.tsx` · **class floor:** `class:component`

The industries index. Rebuilt to the Figma "Industries" design and renamed from `/customers`
(#1406). `/industries/[slug]` is the industry detail (e.g. `/industries/dental`) — a different
file, moved with the route rename but otherwise unchanged. `/customers` + `/customers/:slug`
301-redirect here ([next.config.mjs](../../next.config.mjs)).

## Stylesheets

| Import | Owns | Note |
|---|---|---|
| `../homepage.css` | `.section-hero`, `.hero-container`, `.hero-layout`, `.hero-text`, `.hero-title`, `.hero-description` | hero reuse — the sanctioned `section-hero` path ([marketing-section-reuse.md](../marketing-section-reuse.md)) |
| `../shared-sections.css` | `.page-section`, `.container-lg`, `.illustration-media-bg`, `.cta-*`, card-chrome-by-band | sitewide |
| `./industries.css` | `.industries-hero`, `.industry-card`, `.customer-story*` (index); `.customer-hero-media*`, `.customer-topic-grid*` (detail) | layout only |

## Sections, in render order

All three carry a stable `data-section` id — **none grandfathered** (the old 6-section
`/customers` build's baseline entry was removed in #1406).
→ [`section-identification.md`](../section-identification.md)

| # | Element / class | `data-section` | Band surface | Card chrome | BDS / local in use |
|---|---|---|---|---|---|
| 1 | `section.section-hero.industries-hero` | `hero` | outer `--surface-primary`; inner `.hero-container` = `--surface-inverse` (fixed dark, both themes) | — | reused `.section-hero` block, re-themed by `.industries-hero` |
| 2 | `section.page-section` — **conditional** on the CMS list | `industries` | `--surface-primary` white | untinted → cards keep border, 3px (`shared-sections.css`) | `Grid columns={3}`, `Card preset="display"` (`.industry-card`), `Frame ratio="square" fit="contain"` |
| 3 | `section.page-section` | `brikdown` | `--surface-primary` white | container's own border (not a band rule) | `.customer-story` 2-col, `LinkButton` |

## Hero — reuses `.section-hero`, does not add a 9th hero class

The Figma `section-hero` frame renders a **contained dark rounded card**, not the full-viewport
image hero homepage draws. Both use the same `.section-hero` band + `.hero-container` inner card;
`.industries-hero .hero-container` (`industries.css`) only re-themes the fill (`--surface-inverse`)
and radius (`--border-radius-800`) — the exact per-page re-theme pattern `.plans-hero` uses for its
accent-blue fill. `.hero-container` already pins its ink to the invariant-white `--text-on-color-dark`,
which reads on the fixed-dark surface, so no text-token override is needed.
→ [`marketing-section-reuse.md`](../marketing-section-reuse.md) ("8 heroes for one frame — do not add a ninth")

## Data

`revalidate = 86400` (24h) — unchanged from the prior build.

| Source | Feeds | Rule |
|---|---|---|
| Notion "Industries" page (static, in JSX) | sections 1 + 3 copy | copy source of truth, **not** the Figma placeholder |
| `getIndustryPages()` | section 2's cards | CMS — the only Supabase read on this page |

**`Grid columns={3}` in section 2 is fed by the CMS row count.** ≥3 published industries fill it;
fewer than 3 leaves a gap in a 3-column rule (#1004 failure mode).
→ [`page-anatomy.md`](../page-anatomy.md) § collection counts · gated by `tests/a11y/grid-column-fit.spec.ts`

## Ratified constraints — do not undo these

| Constraint | Why | Evidence |
|---|---|---|
| Copy comes from the Notion "Industries" page, not Figma | Figma copy is placeholder/Marketing-flavored ("We already speak your language", "$2,500 Foundation Investment") — [[figma-is-style-not-data]] | `page.tsx` hero + customer-story |
| The Figma "Before we build, we learn" cards-section **header is omitted** | not in the Notion Industries copy — operator: "if it's not in Notion then exclude" (2026-09-10) | `page.tsx` §2 has no `SectionHeader` |
| Cards are CMS-driven (render all published), not Figma's hardcoded 3 | operator chose CMS-driven; CMS industry pages are a later task, temp gap OK | `page.tsx:47` |
| Card taglines render from the DB **as-is** | operator accepted the mismatch vs Notion's per-industry blurbs (temp gap, #1406) | `getIndustryPages()` |
| Section 2 is conditional on the CMS list | no published industries → no empty 3-column band | `page.tsx` `industryCards.length > 0` |
| Customer-story image is a **placeholder well** (`.customer-story__media`, no `<img>`) | operator: "placeholder for now" (2026-09-10); no broken-asset request | `page.tsx` §3 |
| `--surface-inverse` chosen over a flipping token | it resolves to `--color-grayscale-darkest` in **both** themes, so the hero card stays dark in dark mode | `dist/tokens.css` L584/L746 |

## Surfaced gap (not yet resolved)

The Figma `card-vertical` carries a per-industry **service badge + service-colored button**;
`getIndustryPages()` returns `industry_pages.*` with **no service field**, so those slots render
without service theming (a plain primary "Learn More" button, no badge). Needs a data source or an
explicit accept from Nick — filed on #1406.

## Governing references

- [`card-treatment.md`](../card-treatment.md) — section 2 cards on a white band → border + no shadow (gated `tests/a11y/card-treatment.spec.ts`)
- [`marketing-section-reuse.md`](../marketing-section-reuse.md) — the hero reuse path
- [`page-anatomy.md`](../page-anatomy.md) — CMS collection count in section 2
- [`service-data-sot.md`](../service-data-sot.md) — `getIndustryPages()`
- [`section-identification.md`](../section-identification.md) — 3 sections, 0 grandfathered
- [`image-optimization.md`](../image-optimization.md) — CMS illustration budgets
