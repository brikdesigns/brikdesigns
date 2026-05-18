---
name: Services CMS write-ownership
description: Which CMS write surface owns which shared Supabase table — brikdesigns vs brik-client-portal. Governs every "where do I edit X?" question. Sibling to service-data-sot.md and service-url-slug-convention.md.
last-verified: 2026-05-18
---

# Services CMS write-ownership

brik-client-portal and brikdesigns share **one Supabase project** (staging `lmhzpzobdkstzpvsqest`, prod `rnspxmrkpoukccahggli`). Both apps have admin UIs. To stop the back-and-forth, write authority on each table is fixed below.

**End-state direction (decided 2026-05-15):** portal becomes the only write surface for shared CMS data; brikdesigns becomes a pure read consumer with `(admin)/admin/*` deleted entirely. The matrix below shows the *current* state plus the gated path to that end state.

**Tracking umbrellas:**

- This repo (receiving side): [#178](https://github.com/brikdesigns/brikdesigns/issues/178)
- Portal (driving side): [brik-client-portal#767](https://github.com/brikdesigns/brik-client-portal/issues/767) — Settings IA migration, canonical plan + phase table

## Ownership matrix

| Table | Schema owner | Write authority | brikdesigns admin state | Gated migration |
| --- | --- | --- | --- | --- |
| `services` | portal | **portal** (`portal.brikdesigns.com/settings/services`) | **read-only** — links to portal admin | done (#179) |
| `service_lines` | portal | **portal** (`portal.brikdesigns.com/settings/service-lines`) | **read-only** — links to portal admin | done (#188) |
| `offerings` | portal | **portal** (`portal.brikdesigns.com/settings/offerings`) | **read-only** — links to portal admin | done (#189) |
| `plans` | portal | **portal** (SQL-only today; admin lands via portal#769) | not present (read-only consumer via `/plans/[slug]`) | portal#769 (parallel-safe) |
| `customer_stories` | portal | brikdesigns | writable | portal#770 → flips via #191 (Webflow-gated) |
| `blog_posts` | portal | brikdesigns | writable | portal#771 → flips via #190 (Webflow-gated) |
| `industry_pages` | portal | brikdesigns | writable | out of scope of #767 — file separately if needed |
| `engagements` | portal | **portal** | not present | unchanged |
| `companies` / `contacts` / `users` / etc. | portal | **portal** | not present | unchanged |

"Schema owner" = the repo whose `supabase/migrations/` directory contains the canonical `CREATE TABLE` / `ALTER TABLE` for that table. Portal owns 100% of these — brikdesigns has zero migrations.

"Gated migration" = the issue tracking the move to portal write-ownership. When the portal-side admin ships, the corresponding brikdesigns flip issue executes (read-only UI + 410 on `/api/admin/*` writes), following the same pattern as #179.

## Rules

1. **Schema migrations always land in portal.** Never add a `supabase/migrations/` directory to brikdesigns. If brikdesigns needs a new column or constraint, file a portal-side issue and consume the column read-only here once it ships.
2. **Marketing-only columns are still owned by portal.** `service_tag_category`, `card_image_url`, `tagline`, etc. were added via portal migrations (00177, 00178, 00180, 00182) even though brikdesigns is the primary consumer. Same rule applies to future marketing columns — they're portal migrations.
3. **brikdesigns is read-only on `services`, `service_lines`, and `offerings`.** UI: each tab links to the portal `/settings/*` admin. API: `POST`/`PATCH`/`DELETE` on `/api/admin/services`, `/api/admin/service-lines`, and `/api/admin/offerings` return **410 Gone** with `portalAdminUrl` in the body. `GET` stays on all three.
4. **The only remaining writable brikdesigns admin surfaces are `customer_stories` and `blog_posts`**, gated on Webflow retirement (portal#770, portal#771 respectively).
5. **Webflow CSVs (`content/csv/*`) are a one-time migration source.** Portal Supabase is canon. Drift findings from `audit:cms-drift` on `services` / `offerings` against the CSV are **legacy artifacts, not reconciliation backlog**.

## Where to point users

| Question | Answer |
| --- | --- |
| "How do I edit a service?" | Portal `/settings/services` (staging: `staging.portal.brikdesigns.com/settings/services`) |
| "How do I add or edit a service line?" | Portal `/settings/service-lines` |
| "How do I edit an offering / pricing?" | Portal `/settings/offerings` |
| "How do I edit a plan?" | Portal `/settings/plans` |
| "How do I publish a customer story?" | brikdesigns `/admin/stories` — moves to portal `/settings/customer-stories` (portal#770) when Webflow retires |
| "How do I publish a blog post?" | brikdesigns `/admin/blog` — moves to portal `/settings/blog-posts` (portal#771) when Webflow retires |
| "Service marketing copy isn't editable in portal admin." | File a portal-side issue to extend its form. Don't restore writes in brikdesigns. |

## End state

Once all phases of portal#767 land and the receiving-side flips (#188, #189, #190, #191) ship + clear one stable cycle, the terminal cleanup (#192) deletes brikdesigns `(admin)/admin/*` entirely:

- No `src/app/(admin)/` route group
- No `src/app/api/admin/*` routes
- Brikdesigns becomes a pure read consumer; marketing pages render from shared Supabase via Next.js server components only

This matrix exists as a stable boundary *until* that end state. At cleanup, this doc shrinks to "brikdesigns is read-only on all shared tables; portal `/settings/*` is canonical for editing."

## Final-collapse trigger (long-form content)

`blog_posts` + `customer_stories` admin moves to portal as Phase 7 of portal#767, gated on brikdesigns.com Next.js fully replacing Webflow publicly. Until then, brikdesigns `/admin/blog` + `/admin/stories` remain the active write surfaces.

## Environment

The portal admin URL is selected via `NEXT_PUBLIC_PORTAL_URL` (see [`src/lib/portal-url.ts`](../../src/lib/portal-url.ts)). Default is prod portal; set per Netlify context for staging + deploy-preview to point at `staging.portal.brikdesigns.com`.

## History

- 2026-05-15 — boundary decided (#178). Verified via deep inspection of `brik-client-portal/supabase/migrations/00048_marketing_tables.sql` (origin) + `src/app/(auth)/admin/services/` (existing portal admin).
- 2026-05-15 — Phase 1 shipped (#179): `services` tab read-only + `/api/admin/services` 410.
- 2026-05-15 — full migration plan locked in portal#767 (Settings IA umbrella). New `/settings/*` route group in portal owns all shared CMS writes; brikdesigns `(admin)/admin/*` slated for terminal deletion. Children filed: portal#768/#769/#770/#771/#772 (portal-side admins + collapse); brikdesigns #188/#189/#190/#191/#192 (receiving-side flips + terminal cleanup). `plans` table verified SQL-only today (no existing write UI), making portal#769 net-new.
- 2026-05-18 — Phases 3 + 4 shipped (#188 + #189): `service_lines` + `offerings` tabs flipped read-only. `/api/admin/service-lines` and `/api/admin/offerings` write methods (POST/PATCH/DELETE) return 410. `portal-url.ts` updated: `PORTAL_SERVICES_ADMIN_URL` corrected to `/settings/services`, new `PORTAL_SERVICE_LINES_ADMIN_URL` + `PORTAL_OFFERINGS_ADMIN_URL` constants added.
- Pre-decision pain points: portal migration 00182 (`service_tag_category`) added in response to brikdesigns#129; recurring agent confusion on whose validation rules apply; `audit:cms-drift` surfacing legacy CSV artifacts as actionable drift.
