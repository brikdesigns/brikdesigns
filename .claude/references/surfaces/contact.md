# Surface — `/contact`

**last-verified:** 2026-09-10 · **source:** `src/app/(marketing)/contact/page.tsx` · **class floor:** `class:component`

## Stylesheets

| Import | Owns | Note |
|---|---|---|
| `../shared-sections.css` | `.page-hero__title`, card-chrome-by-band (incl. `.contact-plans`) | sitewide |
| `./contact.css` | `.contact-section`, `.contact-panel`, `.contact-hero-row`, `.contact-cta-row`, `.contact-form-block`, `.contact-plans*` | this page's own scaffolding — it does **not** use `.page-hero` / `.page-section` |

This page is the outlier: it borrows only `.page-hero__title` from the shared vocabulary and builds
its own bands. Do not assume `.page-section` behaviour here.

## Sections

Neither section carries a stable id; `section-id-baseline.json` grandfathers **2** for this file.
→ [`section-identification.md`](../section-identification.md)

| # | Element / class | Band surface | Card chrome | BDS / local in use |
|---|---|---|---|---|
| 1 | `section.contact-section` > `.contact-panel` | own, from `contact.css` | — | `BookACallButton`*, `ContactForm`*, `Button variant="secondary"` ×2 |
| 2 | `section.contact-plans` | `--surface-secondary`, painted by the bespoke class **without** a `.page-section--secondary` modifier | **shadow, no border** — `.contact-plans` is hand-added to the tinted-band list (`shared-sections.css:843`) | `SectionHeader`, `Grid columns={3}`, `HomePlanCard`* |

\* local components under `src/components/`, not BDS.

**Section 2 is the documented fragile case.** `shared-sections.css:835-839` calls out by name that
`.contact-plans` and `.section-plans` paint a tint *without* the standard modifier, so they had to
be enumerated in the chrome rule — and that "any new bespoke tinted section must be added here."
`tests/a11y/card-treatment.spec.ts` exists so a missed one fails CI by name instead of shipping as
a white-treatment card on a tint. → [`card-treatment.md`](../card-treatment.md)

## Data

No `revalidate` export on this page — unlike every other marketing route, it is not on the 3600s
ISR window. Check that before assuming CMS edits appear on a schedule here.

| Source | Feeds | Rule |
|---|---|---|
| `getServiceCategories()` | line clustering + plan-card illustrations | → [`service-data-sot.md`](../service-data-sot.md) |
| `getServices()` | the form's service picker options | sorted by line `rank`, then service `rank` |
| `getSupportPlans()` | section 2's plan cards | prices come from its `service_plan_tiers` embed via `planTierPrices()` — Advisory is the headline, Managed is named under it. The plan-level `monthly_price_*` block is **retired** (#1385, portal#3959 decision A) |

Two joins happen in-page, both client-side against already-fetched rows:
`service_plans.display_line_id` → the marketing-line illustration, and the same line → the card's
CTA tint (because the card links to `/plans/{slug}`, whose own CTAs are tinted from that line, #1001).

**`Grid columns={3}` in section 2 is fed by `getSupportPlans()`** — a CMS row count, not a literal.
An unpublished plan drops the grid to 2 cards in a 3-column rule.
→ [`page-anatomy.md`](../page-anatomy.md) § collection counts

## Ratified constraints — do not undo these

| Constraint | Why | Evidence |
|---|---|---|
| Section 2's plan cards are **repurposed from the home page's `.section-plans` band**, not re-authored | the same card, the same join, one implementation | `page.tsx:29-32` |
| The service picker is clustered by service line, with each chip line-colored | mirrors the get-started page and the nav modal — three surfaces, one behaviour | `page.tsx:20-22` |
| The plan card's CTA tint comes from the joined display line, not the plan | the card links to `/plans/{slug}`, whose CTAs are tinted from that line | `page.tsx:43-45`, #1001 |
| `.contact-plans` must stay in the tinted-band chrome list | it paints a tint with no `.page-section--secondary` modifier, so the generic rule cannot reach it | `shared-sections.css:835-843` |

## Governing references

- [`card-treatment.md`](../card-treatment.md) — section 2 is one of the two named fragile cases
- [`page-anatomy.md`](../page-anatomy.md) — collection-count trap in section 2
- [`service-data-sot.md`](../service-data-sot.md) — which tables back the picker and the cards
- [`section-identification.md`](../section-identification.md) — 2 grandfathered
- [`naming-conventions.md`](../naming-conventions.md) — `__title` / `__description`
