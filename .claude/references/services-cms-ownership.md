---
name: Services CMS write-ownership
description: brikdesigns is a pure read consumer of shared Supabase tables. Portal is the only write surface. All /admin/* routes deleted. Governs every "where do I edit X?" question.
last-verified: 2026-05-29
---

# Services CMS write-ownership — Terminal State

brikdesigns is a **pure read consumer** of all shared Supabase tables. All `/admin/*` write and read UI has been deleted (#192). Marketing pages render from Supabase via Next.js server components only.

Portal (`portal.brikdesigns.com/settings/*`) is the canonical write surface for all shared CMS data.

**Tracking umbrellas:**

- This repo (receiving side): [#178](https://github.com/brikdesigns/brikdesigns/issues/178) — closed
- Portal (driving side): [brik-client-portal#767](https://github.com/brikdesigns/brik-client-portal/issues/767) — Settings IA migration

## Ownership matrix

| Table | Schema owner | Write surface | brikdesigns role |
| --- | --- | --- | --- |
| `services` | portal | `portal.brikdesigns.com/settings/services` | read-only |
| `service_lines` | portal | `portal.brikdesigns.com/settings/service-lines` | read-only |
| `offerings` | portal | `portal.brikdesigns.com/settings/offerings` | read-only |
| `plans` | portal | `portal.brikdesigns.com/settings/plans` | read-only |
| `customer_stories` | portal | `portal.brikdesigns.com/settings/customer-stories` | read-only |
| `blog_posts` | portal | `portal.brikdesigns.com/settings/blog-posts` | read-only |
| `industry_pages` | portal | portal (file issue if write UI needed) | read-only |
| `engagements` | portal | portal | not present |
| `companies` / `contacts` / `users` / etc. | portal | portal | not present |

## Rules

1. **Schema migrations always land in portal.** Never add a `supabase/migrations/` directory to brikdesigns.
2. **Marketing-only columns are still owned by portal.** File a portal-side issue for any new column; consume read-only once it ships.
3. **brikdesigns has no write API routes.** `src/app/api/admin/` has been deleted entirely. If a POST/PATCH/DELETE to a shared table is needed, it belongs in portal.
4. **Webflow CSVs (`content/csv/*`) are a one-time migration source.** Portal Supabase is canon.

## Where to point users

| Question | Answer |
| --- | --- |
| "How do I edit a service?" | Portal `/settings/services` |
| "How do I add or edit a service line?" | Portal `/settings/service-lines` |
| "How do I edit an offering / pricing?" | Portal `/settings/offerings` |
| "How do I edit a plan?" | Portal `/settings/plans` |
| "How do I publish a customer story?" | Portal `/settings/customer-stories` |
| "How do I publish a blog post?" | Portal `/settings/blog-posts` |
| "Service marketing copy isn't editable in portal admin." | File a portal-side issue to extend its form. |

## History

- 2026-05-15 — boundary decided (#178). Phase 1: `services` read-only (#179).
- 2026-05-15 — full migration plan locked in portal#767. Children filed: portal#768–772; brikdesigns #188–192.
- 2026-05-18 — Phases 3 + 4: `service_lines` + `offerings` read-only (#188 + #189).
- 2026-05-29 — Terminal cleanup (#192): all `/admin/*` routes and `api/admin/*` deleted. brikdesigns is now a pure read consumer.
