---
name: Services CMS write-ownership
description: Which CMS write surface owns which shared Supabase table — brikdesigns vs brik-client-portal. Governs every "where do I edit X?" question. Sibling to service-data-sot.md and service-url-slug-convention.md.
last-verified: 2026-05-15
---

# Services CMS write-ownership

brik-client-portal and brikdesigns share **one Supabase project** (staging `lmhzpzobdkstzpvsqest`, prod `rnspxmrkpoukccahggli`). Both apps have admin UIs. To stop the back-and-forth, write authority on each table is fixed below.

Tracking umbrella: [#178](https://github.com/brikdesigns/brikdesigns/issues/178).

## Ownership matrix

| Table | Schema owner | Write authority | brikdesigns admin state |
| --- | --- | --- | --- |
| `services` | portal | **portal** (`portal.brikdesigns.com/admin/services`) | **read-only** — links to portal admin |
| `service_lines` | portal | brikdesigns (interim — portal admin TBD) | writable |
| `offerings` | portal | brikdesigns (interim — portal admin TBD) | writable |
| `plans` | portal | **portal** (no UI yet — direct DB until portal builds admin) | not present |
| `customer_stories` | portal | brikdesigns | writable |
| `blog_posts` | portal | brikdesigns | writable |
| `industry_pages` | portal | brikdesigns | writable (TODO: confirm) |
| `engagements` | portal | **portal** | not present |
| `companies` / `contacts` / `users` / etc. | portal | **portal** | not present |

"Schema owner" = the repo whose `supabase/migrations/` directory contains the canonical `CREATE TABLE` / `ALTER TABLE` for that table. Portal owns 100% of these — brikdesigns has zero migrations.

## Rules

1. **Schema migrations always land in portal.** Never add a `supabase/migrations/` directory to brikdesigns. If brikdesigns needs a new column or constraint, file a portal-side issue and consume the column read-only here once it ships.
2. **Marketing-only columns are still owned by portal.** `service_tag_category`, `card_image_url`, `tagline`, etc. were added via portal migrations (00177, 00178, 00180, 00182) even though brikdesigns is the primary consumer. Same rule applies to future marketing columns — they're portal migrations.
3. **brikdesigns is read-only on `services`.** UI: `/admin/services` services tab links each row to `portal.brikdesigns.com/admin/services/{slug}`. API: `POST /api/admin/services`, `PATCH /api/admin/services/[id]`, `DELETE /api/admin/services/[id]` return **410 Gone** with `portalAdminUrl` in the body. `GET` stays.
4. **brikdesigns retains write authority on `service_lines` and `offerings` until portal ships admin UIs for them.** Flip those tabs to read-only in the same way once portal-side issues close.
5. **Webflow CSVs (`content/csv/*`) are a one-time migration source.** Portal Supabase is canon. Drift findings from `audit:cms-drift` on `services` / `offerings` against the CSV are **legacy artifacts, not reconciliation backlog**.

## Where to point users

| Question | Answer |
| --- | --- |
| "How do I edit a service?" | Portal admin → `portal.brikdesigns.com/admin/services` (staging: `staging.portal.brikdesigns.com/admin/services`) |
| "How do I add a new service line?" | brikdesigns `/admin/services?tab=lines` (interim) |
| "How do I edit an offering / pricing?" | brikdesigns `/admin/services?tab=offerings` (interim) |
| "How do I publish a customer story?" | brikdesigns `/admin/stories` |
| "How do I publish a blog post?" | brikdesigns `/admin/blog` |
| "Service marketing copy isn't editable in portal admin." | File a portal-side issue to extend its form. Don't restore writes in brikdesigns. |

## Final-collapse trigger

When brikdesigns.com Next.js replaces Webflow publicly, `blog_posts` + `customer_stories` admin moves to portal and brikdesigns `/login` is removed. Until that condition is met, this matrix is the stable boundary.

## Environment

The portal admin URL is selected via `NEXT_PUBLIC_PORTAL_URL` (see [`src/lib/portal-url.ts`](../../src/lib/portal-url.ts)). Default is prod portal; set per Netlify context for staging + deploy-preview to point at `staging.portal.brikdesigns.com`.

## History

- 2026-05-15 — boundary decided (#178). Verified via deep inspection of `brik-client-portal/supabase/migrations/00048_marketing_tables.sql` (origin) + `src/app/(auth)/admin/services/` (existing portal admin).
- Pre-decision pain points: portal migration 00182 (`service_tag_category`) added in response to brikdesigns#129; recurring agent confusion on whose validation rules apply; `audit:cms-drift` surfacing legacy CSV artifacts as actionable drift.
