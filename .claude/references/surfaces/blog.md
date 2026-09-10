# Surface — `/blog`

**last-verified:** 2026-09-10 · **source:** `src/app/(marketing)/blog/page.tsx` · **class floor:** `class:component`

The post index. `/blog/[slug]` is the post detail — a different file with **5** grandfathered
sections of its own, the largest such count in the repo.

## Stylesheets

| Import | Owns | Note |
|---|---|---|
| `../shared-sections.css` | `.page-section`, `.page-section--top`, `.cta-section-brand` / `.cta-card-brand`, card-chrome-by-band (incl. `.section-plans`) | sitewide |
| `../homepage.css` | `.section-plans`, `.section-container` | cross-page reuse, the sanctioned interim path ([`marketing-section-reuse.md`](../marketing-section-reuse.md)) |
| `./blog.css` | layout only; also serves `/blog/[slug]` | |

## Sections

| # | id | Element / class | Band surface | Card chrome | BDS / local in use |
|---|---|---|---|---|---|
| 1 | **none** — 1 grandfathered | `section.page-section.page-section--top` | `--surface-primary` | untinted → cards keep border, 3px (`shared-sections.css:859`) | `SectionHeader className="page-index-header" titleAs="h1"`, `BlogIndex`* |
| 2 | `monthly-subscription` | `section.section-plans` > `.section-container` | `--surface-secondary`, painted by the bespoke class **without** a `.page-section--secondary` modifier | **shadow, no border** — `.section-plans` is hand-added to the tinted-band list (`shared-sections.css:844`) | `SectionHeader`, `Grid columns={3}`, `HomePlanCard`* |
| 3 | `get-in-touch` | `section.cta-section-brand` > `.cta-card-brand` | brand panel, shared and reused | — | `SectionHeader onColor`, `Button variant="on-color"` |

\* local components, not BDS.

Section 2 is the second of the two documented fragile tinted bands (`.contact-plans` on `/contact`
is the other) — `shared-sections.css:835-839` names both and warns that any new bespoke tinted
section must be enumerated there. → [`card-treatment.md`](../card-treatment.md)

The page's `<h1>` is `SectionHeader`'s title with `titleAs="h1"`; there is no `<h1>` element in
this file.

## Data

`revalidate = 600` — **not** the 3600 the other marketing routes use. Blog content refreshes on a
10-minute window.

| Source | Feeds | Rule |
|---|---|---|
| `getAllPosts()` (`@/lib/blog`) | section 1 | file-backed, not Supabase |
| `getServiceCategories()` | the plan-card illustration join | |
| `getSupportPlans()` | section 2's cards | **filtered** — `product-support` excluded, as on the home band |

**`Grid columns={3}` in section 2 is fed by `(published plans) − 1`.** Both a CMS change and an
edit to the exclusion move the count.
→ [`page-anatomy.md`](../page-anatomy.md) § collection counts

## Ratified constraints — do not undo these

| Constraint | Why | Evidence |
|---|---|---|
| Section 3 uses the **shared** `.cta-section-brand` / `.cta-card-brand` pattern | it was a second, `/blog`-only brand CTA card (`.section-cta` / `.cta-card`, `homepage.css`) until #1260 consolidated it. Identical to `/results`, `/customers`, `/blog/[slug]` | `page.tsx:86-89`, #1260 |
| Section 2 mirrors the home page's Monthly Subscription band, not a re-authored one | one card, one join, four surfaces | `page.tsx:27-31` |
| `product-support` is excluded from section 2 | matches the home band; still live on `/plans` and its detail route | `page.tsx:30-34` |
| `.section-plans` must stay in the tinted-band chrome list | it paints a tint with no `.page-section--secondary` modifier | `shared-sections.css:835-844` |

## Known inconsistency (not a ratified constraint)

Section 2's `HomePlanCard` is called **without** `serviceLineSlug` here, while the identical band on
`/contact` (`page.tsx:109`) and `/results` (`page.tsx:109`) passes it — so those two get a
service-line-tinted CTA and this one does not. No ticket found for the difference; it reads as an
omission rather than a decision. Verify against the design before matching either side.

## Governing references

- [`card-treatment.md`](../card-treatment.md) — section 2 is one of the two named fragile cases
- [`marketing-section-reuse.md`](../marketing-section-reuse.md) — why `../homepage.css` is imported
- [`page-anatomy.md`](../page-anatomy.md) — the `titleAs="h1"` grouping, and the filtered collection count
- [`section-identification.md`](../section-identification.md) — 1 grandfathered (section 1)
- [`naming-conventions.md`](../naming-conventions.md) — `__title` / `__description`