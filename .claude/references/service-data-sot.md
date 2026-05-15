---
name: Service-data source-of-truth inventory
description: Per-surface map of which Supabase table/columns and which query layer drive each `/services/*` surface — meganav, /services index, category landings, detail pages, footer service links, related-services blocks, and ServiceTag color resolution. Sibling to service-url-slug-convention.md.
last-verified: 2026-05-15
---

# Service-data source-of-truth inventory

The recurring agent trip this doc closes: each `/services/*` surface pulls from a different combination of tables, query helpers, *and* hand-curated arrays in TS source. Touching one surface routinely breaks another because the implicit fan-out isn't documented. This doc is the inventory — given a surface, find its data path; given a column, find which surfaces it feeds.

The sibling doc [service-url-slug-convention.md](./service-url-slug-convention.md) covers URL/slug translation (short-form vs Webflow long-form). This doc covers data sourcing — *what* each surface reads, not *how* slugs map.

## TL;DR

- **Single canonical translation function:** [`mapCategorySlug()`](../../src/lib/supabase/queries.ts) — short-form line slug → BDS `ServiceCategory` enum. Hard-coded sources that bypass it (see [§Hard-coded arrays](#hard-coded-arrays-that-bypass-mapCategorySlug)) are drift risks.
- **Two hand-curated TS files own visibility decisions** (not Supabase): [`meganav-columns.ts`](../../src/lib/meganav-columns.ts) chooses *which* services appear in the meganav and *under which line*; [`Footer.tsx`](../../src/components/layout/Footer.tsx) hard-codes the 5 service lines + their hrefs.
- **Audit gates:** `npm run audit:meganav` (NAV_COLUMNS ↔ live Supabase), `npm run audit:cms-drift` (Supabase ↔ Webflow CSV).
- **Implicit cross-row FKs:** `services.related_service_slug → services.slug`, `services.support_plan_slug → plans.slug`, `service_lines.support_plan_slug → plans.slug` — no DB constraint enforces these; broken links fail at render-time only.

## Per-surface inventory

### MegaNav (top nav `/services` dropdown + mobile menu)

| Surface concern | Source |
| --- | --- |
| Server fetch | [`MegaNavServer.tsx`](../../src/components/layout/MegaNavServer.tsx) — `Promise.all([getServiceCategories, getServices, getSupportPlans, getIndustryPages])` |
| Tables read | `service_lines` (is_public=true, by rank), `services` (is_public=true, by rank), `plans` (plan_type='support', is_public=true), `industry_pages` (is_public=true) |
| Visibility curation | Hand-curated [`NAV_COLUMNS`](../../src/lib/meganav-columns.ts) — keyed by short-form `service_lines.slug`; `slugs[]` per column lists `services.slug` values to show |
| Ordering | NAV_COLUMNS array order (DB `rank` is ignored for in-column ordering) |
| Category color | `mapCategorySlug(cat.slug)` → BDS `ServiceTag` category prop |
| Service filtering | A `services.slug` not in `NAV_COLUMNS[*].slugs` is **silently dropped from the nav**. Surfaced by `npm run audit:meganav`. |
| Promo lane | `serviceLines.find(l => l.category === 'product')` renders as right-rail promo card with `href="/services/product"` |
| Audit gate | `netlify dev:exec --context=branch-deploy -- npm run audit:meganav` — read-only diff |

### `/services` (index)

| Surface concern | Source |
| --- | --- |
| Source file | [`src/app/services/page.tsx`](../../src/app/services/page.tsx) |
| Data fetched | `getServiceCategories()` **only** — service-lines, no services |
| Visibility curation | Two hard-coded arrays in `page.tsx`: `MAIN_LINES` (3-col grid) + `CALLOUT_LINES` (callout band, order matters: Product → Information) |
| URL construction | Hard-coded `/services/{slug}` patterns using `service_lines.slug` (short-form by convention) |
| Per-line color | `mapCategorySlug(cat.slug)` |

### `/services/[categorySlug]` (category landing)

| Surface concern | Source |
| --- | --- |
| Source file | [`src/app/services/[categorySlug]/page.tsx`](../../src/app/services/[categorySlug]/page.tsx) |
| Data fetched | `getCategoryBySlug(categorySlug)`, `getServicesByCategory(category.id)`, `getServiceCategories()` (for "Other Service Lines"), optionally `getSupportPlanBySlug(category.support_plan_slug)` |
| Tables read | `service_lines`, `services` (by `service_line_id` FK), `plans` (conditional) |
| Hero surface color | `serviceColor(mapCategorySlug(category.slug)).surface` — BDS `--surface-service-*` token |
| "Other Service Lines" tile image | `cat.card_image_url` (NOT `hero_image_url` — see #158/#162) |
| 404 path | `getCategoryBySlug` throws → `notFound()` |

### `/services/[categorySlug]/[serviceSlug]` (service detail)

| Surface concern | Source |
| --- | --- |
| Source file | [`src/app/services/[categorySlug]/[serviceSlug]/page.tsx`](../../src/app/services/[categorySlug]/[serviceSlug]/page.tsx) |
| Primary fetch | `getServiceBySlug(serviceSlug)` — joins `service_lines` + `offerings` |
| Related services (sidebar/grid) | `getServicesByCategory(category.id)` filtered to exclude current + `.slice(0, 3)` |
| Related customer story | `getStoriesByService(serviceSlug)` — gated on `service.has_customer_story` |
| Recommended add-on | `getRelatedService(service.related_service_slug)` — implicit FK to `services.slug` |
| Support plan (CTA band) | `getSupportPlanBySlug(service.support_plan_slug)` — implicit FK to `plans.slug` |
| Pricing | `offerings.base_price_cents` (canonical, owned by portal admin/Stripe), sorted asc, ties broken by `offerings.rank`. **Never use `sort_order`** — legacy column from Webflow CSV `tier_rank`, not editable from this admin |
| Pricing display string | Derived from `base_price_cents` at render time (no `price_display` column read for service detail) |
| Offerings filter | `offerings.is_public = true` in JS (not in the join) |

### Footer service links

| Surface concern | Source |
| --- | --- |
| Source file | [`src/components/layout/Footer.tsx`](../../src/components/layout/Footer.tsx) — `serviceLines` const at L28 |
| Data | **HARD-CODED** 5-entry array; **does not query Supabase** |
| Fields per entry | `label` (display name), `href` (short-form `/services/{slug}`), `category` (BDS `ServiceCategory` enum literal) |
| Sync requirement | Renaming a service line OR a slug requires manual edits to: this Footer array, `NAV_COLUMNS` keys in `meganav-columns.ts`, `CATEGORY_MAP` in `queries.ts`, the slug-convention doc, *and* the DB row. No automated detector — discovered via 404 reports. |
| Drift signal | `npm run audit:meganav` catches NAV_COLUMNS drift but **not** Footer drift |

### Related-services blocks

Two distinct patterns; not interchangeable:

| Block | Used on | Source |
| --- | --- | --- |
| "Other Service Lines" | Category landing | `getServiceCategories().filter(c => c.slug !== categorySlug)` — sibling lines, not sibling services |
| "Sibling services" (3-up) | Service detail | `getServicesByCategory(category.id).filter(s => s.slug !== serviceSlug).slice(0, 3)` |
| Recommended add-on (single) | Service detail | `getRelatedService(service.related_service_slug)` — explicit per-row FK-by-slug |

### ServiceTag color resolution

| Surface concern | Source |
| --- | --- |
| Function | [`resolveServiceTagCategory()`](../../src/lib/supabase/queries.ts) |
| Preferred input | `service_lines.service_tag_category` — CMS-editable, portal migration `00182`, brikdesigns#129 |
| Fallback input | `mapCategorySlug(row.slug)` — legacy rows where the column is NULL |
| Output | BDS enum: `'brand' \| 'marketing' \| 'information' \| 'product' \| 'service'` |
| DB constraint | Check constraint on `service_lines.service_tag_category` enforces the 5 canonical BDS values (cast in TS is safe) |

## Hard-coded arrays that bypass `mapCategorySlug`

These TS-side curations are intentional — they encode editorial decisions Supabase doesn't model — but they're drift risks. Renaming a line slug requires touching every one:

| File | Symbol | What it controls |
| --- | --- | --- |
| `src/lib/meganav-columns.ts` | `NAV_COLUMNS` | Which services appear in meganav and under which line |
| `src/components/layout/Footer.tsx` | `serviceLines` (L28) | The 5 service-line links in the site-wide footer |
| `src/app/services/page.tsx` | `MAIN_LINES`, `CALLOUT_LINES` | Which lines render as 3-col grid vs callout band |
| `src/lib/supabase/queries.ts` | `CATEGORY_MAP` | The slug ↔ BDS enum translation table |
| `next.config.mjs` | `redirects()` | 5 line + ~25 service Webflow-legacy redirects |

When renaming a `service_lines.slug` or `services.slug`, grep all five before merging. The DB migration alone will silently break surfaces 2, 3, and 5.

## Implicit cross-row FKs (no DB constraint)

These are FK-by-slug — soft references the schema doesn't enforce. They fail at render-time, not write-time:

| Column | References | Symptom on break |
| --- | --- | --- |
| `services.related_service_slug` | `services.slug` | Recommended add-on band missing on service detail |
| `services.support_plan_slug` | `plans.slug` (where `plan_type='support'`) | Support plan CTA band missing on service detail |
| `service_lines.support_plan_slug` | `plans.slug` (where `plan_type='support'`) | Support plan CTA band missing on category landing |
| `customer_stories.service_slug` | `services.slug` | Related customer story missing; covered by [#151](https://github.com/brikdesigns/brikdesigns/issues/151) |
| `customer_stories.service_line_slug` | `service_lines.slug` | "Other Customer Stories" line-fit fallback to global pool (#171); covered by #151 |

`offerings.service_id` is a real FK on `services.id` — orphaning was fixed in [#106](https://github.com/brikdesigns/brikdesigns/issues/106). The slug-based references above remain unenforced.

## Audit gates

| Command | Diffs | What it catches |
| --- | --- | --- |
| `npm run audit:meganav` | `NAV_COLUMNS` ↔ `service_lines` + `services` (live Supabase) | Stale slugs, cross-line drift, services missing from any nav column |
| `npm run audit:cms-drift` | Supabase tables ↔ `content/csv/*` (Webflow exports) | Row orphans, missing rows, field drift |
| `npm run audit:plan-data` | `plans` + `plan_items` join integrity | Plan-page data gaps |
| `npm run audit:plan-routes` | `plans.slug` ↔ route resolution | Plan 404s |

Neither audit catches Footer.tsx drift, MAIN_LINES/CALLOUT_LINES drift, or the implicit slug FKs above.

## Rules for new code

1. **Never construct a `/services/*` URL from a raw DB slug.** Pass through `mapCategorySlug()` for the line slug. See [service-url-slug-convention.md](./service-url-slug-convention.md).
2. **Never add a new hard-coded service-line array** without updating this inventory + the [Hard-coded arrays](#hard-coded-arrays-that-bypass-mapCategorySlug) table.
3. **Renaming a slug? Grep all 5 hard-coded sources** before merging. The DB migration alone will not propagate.
4. **Adding an implicit cross-row FK?** Document it in the [Implicit FKs](#implicit-cross-row-fks-no-db-constraint) table and consider whether a real DB constraint is warranted (or fail-loud handling in the consuming query, per the `mapCategorySlug` precedent).
5. **Surfaces that read `services` directly should filter `is_public = true`** — the helpers in `queries.ts` do this; raw `supabase.from('services')` calls in new code must replicate it.

## History

- #112 / #122 (merged) — meganav coverage audit + reconcile
- #129 → portal `00182` — `service_tag_category` CMS column
- #156 (merged) — canonical URL/slug convention doc (this doc's sibling)
- #143 — `mapCategorySlug` loud-fallback precedent
- #106 (closed) — offerings.service_id real FK fix
- #114 — this doc
