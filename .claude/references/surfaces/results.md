# Surface — `/results`

**last-verified:** 2026-09-10 · **source:** `src/app/(marketing)/results/page.tsx` · **class floor:** `class:component`

The customer-story index. `/results/[slug]` is the story detail — a different file with **4**
grandfathered sections of its own.

## Stylesheets

| Import | Owns | Note |
|---|---|---|
| `../shared-sections.css` | `.page-section`, `.page-section--top`, `.page-section--accent`, `.container-lg`, `.cta-section-brand` / `.cta-card-brand`, card-chrome-by-band | sitewide |
| `./results.css` | layout only; also serves `/results/[slug]` — check which route a rule serves before editing | |

## Sections

None carry a stable id; `section-id-baseline.json` grandfathers **3** for this file.
→ [`section-identification.md`](../section-identification.md)

| # | Element / class | Band surface | Card chrome | BDS / local in use |
|---|---|---|---|---|
| 1 | `section.page-section.page-section--top` | `--surface-primary` | untinted → cards keep border, 3px (`shared-sections.css:859`) | `SectionHeader className="page-index-header" titleAs="h1"`, `ResultsList`* |
| 2 | `section.page-section.page-section--accent` — **conditional** on `supportPlans.length > 0` | `--surface-accent` tan (`shared-sections.css:80-82`) | **shadow, no border** — `.page-section--accent` is on the tinted-band list (`shared-sections.css:841`) | `SectionHeader`, `Grid columns={3}`, `HomePlanCard`* |
| 3 | `section.cta-section-brand` > `.cta-card-brand` | brand panel, shared and reused | — | `SectionHeader onColor`, `Button variant="on-color"` |

\* local components, not BDS.

The page's `<h1>` is **not** a bare heading — it is `SectionHeader`'s title with `titleAs="h1"`.
Looking for an `<h1>` element in this file will not find one.
→ [`page-anatomy.md`](../page-anatomy.md) § grouping (why the title lives in a content block)

## Data

| Source | Feeds | Rule |
|---|---|---|
| `getCustomerStories()` | section 1's story list | empty → the "Customer stories coming soon." fallback, not a hidden section |
| `getServiceCategories()` | the plan-card illustration + tint join | |
| `getSupportPlans()` | section 2's cards | **filtered** — see constraints |

**`Grid columns={3}` in section 2 is fed by `getSupportPlans()` minus one hard-coded exclusion.**
The count is therefore `(published plans) − 1`. Both a CMS change and an edit to the exclusion move
it, and either can strand a trailing column.
→ [`page-anatomy.md`](../page-anatomy.md) § collection counts · gated by `tests/a11y/grid-column-fit.spec.ts`

Section 1's story cards go through `mapServiceLineSlug` to reach the canonical `ServiceLine` enum
— the same mid-migration guard `/services` uses.

## Ratified constraints — do not undo these

| Constraint | Why | Evidence |
|---|---|---|
| Section 2 renders **every public plan** — no per-surface exclusion | `product-support` was unpublished (`is_public: false`); the four hand-maintained filters were working around a row that should not have been public, and removing them deletes the pattern that produced the leak | `page.tsx:31-33`, #1385 |
| Section 2's plan cards mirror the home page's Monthly Subscription mapping, not a re-authored one | one card, one join, three surfaces (`/`, `/contact`, here). The tier prices come from the shared `planTierPrices()` helper, not a per-surface `.find()` | `page.tsx:27-31`, `src/lib/plan-tier-prices.ts` |
| The plan card's CTA tint comes from the joined display line, not the plan | the card links to `/plans/{slug}`, whose CTAs are tinted from that line | `page.tsx:44-46`, #1001 |
| An empty story list renders a **visible fallback**, not a hidden section | "Customer stories coming soon." — the page never collapses to nothing | `page.tsx:87-89` |
| Section 2 is conditional; section 1 and 3 are not | no plans → no band at all, rather than an empty tinted band | `page.tsx:93` |

## Governing references

- [`card-treatment.md`](../card-treatment.md) — section 2 tinted, sections 1 and 3 not
- [`page-anatomy.md`](../page-anatomy.md) — the `titleAs="h1"` grouping, and the filtered collection count
- [`service-data-sot.md`](../service-data-sot.md) — the story and plan tables
- [`service-url-slug-convention.md`](../service-url-slug-convention.md) — the `mapServiceLineSlug` guard
- [`section-identification.md`](../section-identification.md) — 3 grandfathered
- [`card-media.md`](../card-media.md) — story thumbnails fall back `thumbnail_url` → `hero_image_url`
