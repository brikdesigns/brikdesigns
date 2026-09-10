# Surface — `/services`

**last-verified:** 2026-09-10 · **source:** `src/app/(marketing)/services/page.tsx` · **class floor:** `class:component`

The service-line index. Not to be confused with `/services/[serviceLineSlug]` (the line detail) or
`/services/[serviceLineSlug]/[serviceSlug]` (the service detail) — three different surfaces, three
different files.

## Stylesheets

| Import | Owns | Note |
|---|---|---|
| `../shared-sections.css` | `.page-hero`, `.page-section`, `.service-surface`, `.container-lg`, card-chrome-by-band | sitewide |
| `./services.css` | layout only | |

## Sections

**3 `<section>` literals, 4 at runtime** — the callout section is inside a `.map()` over
`CALLOUT_LINES` (2 entries). Counting `<section>` in the source undercounts this page.

None carry a stable id. `scripts/section-id-baseline.json` grandfathers **3** for this file, so
converting one *without lowering the count* also fails the gate — the ratchet cuts both ways.
→ [`section-identification.md`](../section-identification.md)

| # | Element / class | Band surface | Card chrome | BDS / local in use |
|---|---|---|---|---|
| 1 | `section.page-hero` | `--surface-primary` | — | `ScrollDownCta` |
| 2 | `section.page-section` | `--surface-primary` | untinted → cards keep border, 3px (`shared-sections.css:859`) | `SectionHeader`, `Grid columns={3}`, `ServiceLineCard` ×3 |
| 3–4 | `section.page-section.service-surface` ×2 | per-line `serviceColor(...).surfaceLight`, set inline | **shadow, no border** — `.service-surface` is on the tinted-band list (`shared-sections.css:842`) | `SectionHeader`, `ServiceCallout` |

`ServiceLineCard` / `ServiceCallout` are **local** components (`./ServiceLineCard.tsx`), not BDS.

## Data

| Source | Feeds | Rule |
|---|---|---|
| `getServiceCategories()` | all cards + callouts | → [`service-data-sot.md`](../service-data-sot.md) |
| `MAIN_LINES` (page-local) | section 2's three cards | `['brand','marketing','back-office']` — canonical **enum**, matched via `mapServiceLineSlug`, never the raw slug |
| `CALLOUT_LINES` (page-local) | sections 3–4 | `['product','information']` — order is the design intent, applied manually |
| `CALLOUT_COPY` (page-local) | callout title/subtitle | transcribed from the live Webflow site |

**`Grid columns={3}` in section 2 is fed by `mainLines`, which is a filter result, not a literal.**
If a service line is unpublished or its slug drifts, the grid renders 2 cards in a 3-column rule —
the exact failure #1004 shipped. Any change to `MAIN_LINES`, to the DB rows, or to
`mapServiceLineSlug` must check the grid rule in the same change.
→ [`page-anatomy.md`](../page-anatomy.md) § collection counts · gated by `tests/a11y/grid-column-fit.spec.ts`

## Ratified constraints — do not undo these

| Constraint | Why | Evidence |
|---|---|---|
| `MAIN_LINES` matches the **canonical BDS `ServiceLine` enum** via `mapServiceLineSlug`, not the raw DB slug | the back-office rename is mid-migration on the shared Supabase; matching raw `service` silently dropped the card once an env flipped | `page.tsx:18-23` |
| `CALLOUT_LINES` order is applied in code, not taken from the DB | DB sort does not match the design intent (Product → Information) | `page.tsx:44-47` |
| Callout bands use the **pale `surfaceLight`** ramp, not the mid or deep service tint | matches the sitewide pale hero/band treatment and the already-pale service-line pages | `page.tsx:93-95`, #408, #389 |
| The callout subtitle pins `color.text.primary` explicitly | `SectionHeader`'s default description ink is too light against the pale service tint | `page.tsx:101` |

## Governing references

- [`service-data-sot.md`](../service-data-sot.md) — which table backs these cards
- [`service-url-slug-convention.md`](../service-url-slug-convention.md) — the `service` → `back-office` rename this page defends against
- [`service-token-decision-tree.md`](../service-token-decision-tree.md) — the callout band tints
- [`card-treatment.md`](../card-treatment.md) — section 2 untinted vs sections 3–4 tinted
- [`page-anatomy.md`](../page-anatomy.md) — the live collection-count trap in section 2
- [`section-identification.md`](../section-identification.md) — 3 grandfathered; the ratchet fails on conversion too
