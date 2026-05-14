---
name: Service URL & slug convention
description: Canonical `/services/*` URL structure, the five short-form service-line slugs, the Webflow long-form legacy map, and where translation lives in code. Sibling to service-token-decision-tree.md.
last-verified: 2026-05-14
---

# Service URL & slug convention

The recurring agent trip in this repo: Webflow uses long-form, flat URLs (`/service-lines/marketing-design`, `/service/web-design`); Next.js uses short-form, nested URLs (`/services/marketing`, `/services/marketing/web-design`). The DB `service_lines.slug` column may still hold long-form values and is translated at link-construction time. This doc is the single source of truth — if it disagrees with code, code wins, but file an issue and update this doc.

## TL;DR

- **Routes:** `/services/{short-form-line}/{service-slug}` (nested, short-form). Five canonical line slugs only: `brand`, `marketing`, `information`, `product`, `service`.
- **Webflow legacy:** `/service-lines/{long-form}` and `/service/{slug}` (flat) preserved via 30+ explicit redirects in [`next.config.mjs`](../../next.config.mjs).
- **DB:** `service_lines.slug` may hold long-form. Never construct a route from a raw DB slug — always pass through [`mapCategorySlug()`](../../src/lib/supabase/queries.ts).

## The five canonical service-line slugs

| Short-form (route, code) | Long-form (Webflow, DB-historical) | BDS `ServiceTag` category | Display label |
| --- | --- | --- | --- |
| `brand` | `brand-design` | `brand` | Brand Design |
| `marketing` | `marketing-design` | `marketing` | Marketing Design |
| `information` | `information-design` | `information` | Information Design |
| `product` | `product-design` | `product` | Product Design |
| `service` | `back-office-design` | `service` | Back Office Design |

`service` is the historical internal slug for Back Office Design — kept for FK stability across portal + renew-pms. Don't rename without a coordinated cross-repo migration.

## URL conventions

### Next.js routes (canonical)

| Pattern | Example | Source file |
| --- | --- | --- |
| `/services` | `/services` | [src/app/services/page.tsx](../../src/app/services/page.tsx) |
| `/services/{short-form-line}` | `/services/marketing` | [src/app/services/[categorySlug]/page.tsx](../../src/app/services/[categorySlug]/page.tsx) |
| `/services/{short-form-line}/{service-slug}` | `/services/marketing/web-design` | [src/app/services/[categorySlug]/[serviceSlug]/page.tsx](../../src/app/services/[categorySlug]/[serviceSlug]/page.tsx) |

### Webflow legacy URLs (preserved via redirects)

| Webflow pattern | Redirects to | Where |
| --- | --- | --- |
| `/service-lines/{long-form}` | `/services/{short-form}` | 5 explicit rules in [next.config.mjs](../../next.config.mjs) — one per line |
| `/service/{webflow-slug}` | `/services/{line}/{netlify-slug}` | ~25 hand-curated rules in [next.config.mjs](../../next.config.mjs) — per-service mapping |
| `/category/{plan-slug}` | (not yet redirected) | Webflow plan-category surface; Next equivalent not built |
| `/detail_service/*`, `/detail_service-lines/*` | `/services/:splat` (wildcards) | [netlify.toml](../../netlify.toml) — edge-level legacy from earlier rebuild iterations |

## Translation layer — where the mapping lives in code

| Surface | File | What it does |
| --- | --- | --- |
| Footer service-line links | [src/components/layout/Footer.tsx](../../src/components/layout/Footer.tsx) | Hard-coded short-form `href` values + label + BDS category |
| MegaNav columns | [src/lib/meganav-columns.ts](../../src/lib/meganav-columns.ts) | Hand-curated, keyed by short-form line slug; service slugs filtered against live `services.is_public` |
| Route → category | [src/lib/supabase/queries.ts](../../src/lib/supabase/queries.ts) — `mapCategorySlug` | Short-form-only map (5 entries). Unknown input → `console.warn` + fallback to `'brand'`. Loud failure (PR #143 retrospective). |
| `ServiceTag` color | [src/lib/supabase/queries.ts](../../src/lib/supabase/queries.ts) — `resolveServiceTagCategory` | Prefers CMS-editable `service_lines.service_tag_category` column; falls back to `mapCategorySlug(slug)` for legacy rows |
| Webflow → Next routing | [next.config.mjs](../../next.config.mjs) `redirects()` | 5 line + ~25 service explicit rules. SEO continuity. |
| Edge legacy | [netlify.toml](../../netlify.toml) `[[redirects]]` | `/service-lines/*`, `/detail_service/*`, `/detail_service-lines/*` wildcards. Processed before `next.config.mjs` — order-sensitive. |

## Rules for new code

1. **Never construct a `/services/{x}` route from a raw `service_lines.slug` column.** Always pass through `mapCategorySlug()` (or hard-code the short-form when you have a static list, like Footer does).
2. **Never add a sixth short-form line slug.** The set is closed by the FK across portal + renew-pms and by the BDS `ServiceTag` category enum. Adding one is a coordinated cross-repo schema migration.
3. **When adding a Webflow → Next redirect**, put the rule in [`next.config.mjs`](../../next.config.mjs), not [`netlify.toml`](../../netlify.toml). The latter's wildcards preempt the former's specific rules — that's the bug #133 surfaced.
4. **When a slug is unknown**, `console.warn` + fall back loudly. Silent fallback hid 3 NULL FKs for weeks before PR #143 caught it via screenshot diff.

## Pitfalls

- **Long-form in URL builders.** If you write `/services/${slug}` where `slug` is the DB column, you'll emit `/services/marketing-design` which 404s. Use `mapCategorySlug` or a short-form-only constant.
- **Assuming Webflow's flat structure.** Webflow has no category-landing layer. `/services/marketing` (Next) has no Webflow equivalent — only individual services exist at `/service/{slug}`. When doing visual parity, the category-landing target on Webflow is `/service-lines/{long-form}` (the line's own page), not a service listing.
- **Editing `netlify.toml` redirects without checking ordering.** Netlify processes top-to-bottom, first-match-wins. A wildcard above a specific rule kills the specific rule.

## History — decisions encoded here

- [#100](https://github.com/brikdesigns/brikdesigns/issues/100) (closed 2026-05-13) — chose nested `/services/{category}/{service}` as canonical for the rebuild
- [#113](https://github.com/brikdesigns/brikdesigns/issues/113) (closed 2026-05-13) — audited `/services/*` route resolution
- [#121](https://github.com/brikdesigns/brikdesigns/issues/121) (merged) — Footer + MegaNav short-form fix
- [#131](https://github.com/brikdesigns/brikdesigns/issues/131) (closed 2026-05-13) — `/services/information-design` 404; fixed via code-side translation (#132)
- [#133](https://github.com/brikdesigns/brikdesigns/issues/133) (closed 2026-05-14) — netlify.toml wildcard preempting next.config.mjs specific rules; redirect-layer cleanup
- [#143](https://github.com/brikdesigns/brikdesigns/pulls/143) (merged) — loud-fallback retrofit on `mapCategorySlug`

## Where this is enforced

- `scripts/lint-service-urls.mjs` scans `src/**/*.{ts,tsx}` for bad `/services/<slug>` URLs. Does **not** cover [`next.config.mjs`](../../next.config.mjs) or [`netlify.toml`](../../netlify.toml) — extending it is a separate follow-up flagged in #133's "defense-in-depth" note.
- No CI gate today. Drift is caught by visual-parity sweep + manual review.

## Related

- [service-token-decision-tree.md](service-token-decision-tree.md) — service-line *token* decisions (surface-* vs background-*)
- [#114](https://github.com/brikdesigns/brikdesigns/issues/114) — broader service-data source-of-truth doc (this file is the slug-convention component)
