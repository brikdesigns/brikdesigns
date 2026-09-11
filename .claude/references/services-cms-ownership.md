---
name: Services CMS write-ownership
description: brikdesigns is a pure read consumer of shared Supabase tables. Portal is the only write surface. All /admin/* routes deleted. Governs every "where do I edit X?" question.
last-verified: 2026-09-11
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
| `plans` (54 rows) | portal | **unverified** — see note below | not consumed |
| `service_plans` + `service_plan_tiers` | portal | `portal.brikdesigns.com/settings/plans` | read-only — **except** tier prices, see rule 3 |
| `customer_stories` | portal | `portal.brikdesigns.com/settings/customer-stories` | read-only |
| `blog_posts` | portal | `portal.brikdesigns.com/settings/blog-posts` | read-only |
| `industry_pages` | portal | `portal.brikdesigns.com/settings/industries` | read-only |
| `events` | portal | `portal.brikdesigns.com/settings/events` | read-only |
| `engagements` | portal | portal | not present |
| `companies` / `contacts` / `users` / etc. | portal | portal | not present |

> **Three tables have "plan" in the name and they are not the same thing** — this row used to read just `plans`, which cost a session working out which one backs the public `/plans` page (brikdesigns#1287):
>
> - **`service_plans`** (4 rows) — the support plans: Full Stack, Marketing, Back Office, Product. This is what `/plans` renders.
> - **`service_plan_tiers`** (8 rows) — the Advisory / Managed split per support plan, via `lens` + `service_plan_id`.
> - **`plans`** (54 rows) — a different, offering-scoped table (`offering_id`, `plan_type`, `is_tier_option`, `related_service_slug`). Verified 2026-09-08: **no code in brikdesigns or portal reads or writes it** — the only hits are FK `referencedRelation` entries in generated `src/types/supabase.ts`. It is presumed legacy, but its owning surface was not established, so it is marked unverified rather than guessed. Do not consume it without checking.
>
> ```bash
> rg -n "from\('plans'\)" portal/src brikdesigns/src   # → no matches
> ```

## Rules

1. **Schema migrations always land in portal.** Never add a `supabase/migrations/` directory to brikdesigns.
2. **Marketing-only columns are still owned by portal.** File a portal-side issue for any new column; consume read-only once it ships.
3. **brikdesigns has no write API routes.** `src/app/api/admin/` has been deleted entirely. If a POST/PATCH/DELETE to a shared table is needed, it belongs in portal.

   **Exception — `events` content edits, via the brik-llm CLI.** `events` is the only shared table whose rows render a *public, live* marketing page, and the only portal admin domain with no scriptable write path: `/settings/events` saves through a Next.js **server action** (`brik-client-portal/src/app/(auth)/settings/events/actions.ts:255`), which is bound to the build and uncallable from a script, and every `/api/admin/*` sibling authenticates a session user from cookies. So a live-page defect — empty image `alt`, a wrong role, a missing `og:image` — had no non-browser fix, and sessions reached for a raw Supabase PATCH instead.

   The danger in that bypass is not the rule: the server action **also** fires `revalidateBrikdesigns()` on every write, and a hand-rolled PATCH silently skips it. The row changes, the page does not, nothing errors, and the stale page serves until the 1h ISR window lapses. Use the CLI, which does both in one command:

   ```bash
   set -a; . ~/.secrets/supabase-staging.env; set +a
   node ~/Documents/Github/brik/brik-llm/scripts/cms-event-write.mjs \
     --slug grind-after-graduation --show            # inspect, no write
   node ~/Documents/Github/brik/brik-llm/scripts/cms-event-write.mjs \
     --slug grind-after-graduation --patch '{"hero_image_url":"https://…/hero.webp"}'
   ```

   It mirrors the action's path set per `template` (including the old path on a rename) and always sends the `cms-events` tag, without which `unstable_cache` keeps serving the stale read. `--dry-run` prints the write and the purge without doing either; a production purge requires `--yes`. **Never hand-roll the PATCH** — that is the path that forgets the revalidation. Anything structural (new columns, new block types, schema) still belongs in portal. Contract + rationale: brik-client-portal#3032.

   **Exception — `service_plan_tiers` pricing, via the brik-llm CLI.** The same gap for the same reason: `/settings/plans` saves through a server action (`brik-client-portal/src/app/(auth)/settings/plans/actions.ts:1`, `'use server'`), and no `/api/admin/*` sibling covers plan pricing — so a wrong price on the public `/plans` page had no non-browser fix.

   A raw PATCH here breaks **two** invariants, both silent. It skips the `revalidateBrikdesigns(BRIKDESIGNS_PATHS, ['cms-service-plans'])` the action fires (`actions.ts:43`, `:234`) — and `revalidatePath` alone does not bust a tagged `unstable_cache` entry, only `revalidateTag` does. It also lets `*_price_display` disagree with `*_price_cents`, which are **not** two fields: display is a pure function of cents (`actions.ts:167-181`). They drifted once already — a Managed row reading `$12,500.00` against `124992` cents, and annual rows reading `$13,500.00` against `13500` (dollars typed into a cents field), brik-client-portal#3438. `db-health.sh` § 10c catches a bypass, but only after the fact.

   ```bash
   set -a; . ~/.secrets/supabase-staging.env; set +a
   node ~/Documents/Github/brik/brik-llm/scripts/cms-plan-write.mjs --show   # inspect, no write
   node ~/Documents/Github/brik/brik-llm/scripts/cms-plan-write.mjs \
     --set 'full-stack-support:advisory=1500' --set 'full-stack-support:managed=2750'
   ```

   The value is **dollars**; cents and the display string are both derived from that one number, so there is no input shape that can set a display value — the invariant is structurally unreachable rather than merely validated. `--dry-run` and the `--yes`-for-prod gate match the events CLI. Contract + tests: brik-llm#3205 (gated by `cms-event-write-contract.yml`, which covers both scripts).

   Still portal-only: creating a plan, editing its copy, its services, or anything structural. This CLI sets tier **prices** and nothing else.

   **Exception — `services` / `offerings` VISIBILITY, via the brik-llm CLI.** The same gap a third time: both `/settings/services` and `/settings/offerings` save through server actions (`brik-client-portal/src/app/(auth)/settings/services/actions.ts:1`, `.../offerings/actions.ts`, `'use server'`), and no `/api/admin/*` sibling covers either table —

   ```bash
   find src/app/api/admin -name route.ts | grep -E 'services|offerings'   # → no matches
   ```

   A raw PATCH here breaks **two** invariants, both silent. It skips the `revalidateBrikdesigns(PATHS, ['cms-services'])` both actions fire (`services/actions.ts:37,102`; `offerings/actions.ts:62,207`) — and `revalidatePath` alone does not bust a tagged `unstable_cache` entry. It also bypasses the **strand guard**: hiding a service that still holds public offerings makes them unreachable (`/services/*` resolves the *public* service slug) while they stay sellable in the portal. The action refuses that write outright (`services/actions.ts:191-207`) and portal `scripts/qa-check.sh:382` hard-FAILs on the state; a direct write has neither, which is how `one-pager`, `sales-pitch-deck` and `sales-proposal` sat stranded for months (brik-client-portal#2790), then went public empty (brikdesigns#769).

   ```bash
   set -a; . ~/.secrets/supabase-staging.env; set +a
   node ~/Documents/Github/brik/brik-llm/scripts/cms-service-write.mjs --show   # inspect, no write
   node ~/Documents/Github/brik/brik-llm/scripts/cms-service-write.mjs \
     --hide one-pager --hide sales-pitch-deck
   ```

   `--hide` cascades **offerings first, then the service** — the only order that never passes through the stranded state, so an interrupted run leaves a hidden offering under a public service (invisible, recoverable) rather than the reverse. `--show` reports empty public cards and strands across the whole table. `--dry-run` and the `--yes`-for-prod gate match the other two scripts.

   **There is deliberately no `--publish`, and that is structural, not unfinished.** A service card needs an `image_url`, which rule 5 below establishes is upload-only — so a publish flag here could only ever produce the empty card this script exists to remove. Publish from portal `/settings/services`, where the uploader is. Contract + tests: brik-llm#3371 (same `cms-event-write-contract.yml` job as the other two).
4. **Webflow CSVs (`content/csv/*`) are a one-time migration source.** Portal Supabase is canon.
5. **CMS images live in Supabase storage, never in `public/`.** Every `*_image_url` / `image_url` field in portal renders as an upload widget (`ImageField` → `FileUploader`), which writes into the `marketing-media` bucket and stores that URL. There is **no text input**, so a repo-relative path like `/images/foo.webp` cannot be entered through the owning surface — setting one requires a direct DB write, which rule 3 forbids.

   A relative value is also ambiguous across the two surfaces: portal's `resolveCmsAssetUrl()` treats any non-absolute value as a **storage key** inside `marketing-media`, while brikdesigns consumes `image_url` **raw** (so it would resolve as a repo path). The same string renders two different things. Committing a CMS image to `public/` produces an orphaned file, not a usable asset — `*.supabase.co` is already allowlisted in `next.config.mjs` `images.remotePatterns`, so upload it and be done. (Cost this a full round-trip on [#745](https://github.com/brikdesigns/brikdesigns/issues/745).)

## Where to point users

| Question | Answer |
| --- | --- |
| "How do I edit a service?" | Portal `/settings/services` |
| "How do I add or edit a service line?" | Portal `/settings/service-lines` |
| "How do I edit an offering / pricing?" | Portal `/settings/offerings` |
| "How do I edit a plan?" | Portal `/settings/plans` |
| "How do I fix content on a live event page from a script?" | `brik-llm/scripts/cms-event-write.mjs` — writes **and** revalidates (see rule 3). Authoring still belongs in Portal `/settings/events` |
| "How do I correct a support-plan tier price from a script?" | `brik-llm/scripts/cms-plan-write.mjs --set '<slug>:<advisory\|managed>=<dollars>'` — writes **and** revalidates (see rule 3). Everything else about a plan belongs in Portal `/settings/plans` |
| "How do I take a service off the public site from a script?" | `brik-llm/scripts/cms-service-write.mjs --hide '<slug>'` — cascades its offerings, writes **and** revalidates (see rule 3). **Publishing is not there**; it needs the `image_url` uploader in Portal `/settings/services` (rule 5) |
| "Which services render an empty card, or strand a public offering?" | `brik-llm/scripts/cms-service-write.mjs --show` — reports both states across the whole table, read-only. Invariant: [`service-data-sot.md`](./service-data-sot.md) rule 6 |
| "How do I publish a customer story?" | Portal `/settings/customer-stories` |
| "How do I publish a blog post?" | Portal `/settings/blog-posts` |
| "How do I edit an industry / customer page?" | Portal `/settings/industries` — note the three different nouns for one thing: table `industry_pages`, portal route `/settings/industries`, public URL `/customers/[slug]`. |
| "How do I edit an event?" | Portal `/settings/events` |
| "How do I set a service / line / industry image?" | Portal, via the field's uploader — **you cannot paste a path**. See rule 5. |
| "Service marketing copy isn't editable in portal admin." | File a portal-side issue to extend its form. |

## History

- 2026-05-15 — boundary decided (#178). Phase 1: `services` read-only (#179).
- 2026-05-15 — full migration plan locked in portal#767. Children filed: portal#768–772; brikdesigns #188–192.
- 2026-05-18 — Phases 3 + 4: `service_lines` + `offerings` read-only (#188 + #189).
- 2026-05-29 — Terminal cleanup (#192): all `/admin/*` routes and `api/admin/*` deleted. brikdesigns is now a pure read consumer.
- 2026-09-08 — Added the `service_plan_tiers` pricing exception to rule 3 (`cms-plan-write.mjs`, brik-llm#3205), after brikdesigns#1287 found Advisory == Managed on every plan with no non-browser way to fix it. Split the single `plans` matrix row into the three distinct plan-named tables and added the disambiguation note above it: `service_plans` (4) backs `/plans`, `service_plan_tiers` (8) holds the Advisory/Managed split, and `plans` (54) is a separate offering-scoped table with no reader in either repo. The one ambiguous row cost this session real time working out which table `/plans` renders from.
- 2026-09-11 — Added the `services` / `offerings` **visibility** exception to rule 3 (`cms-service-write.mjs`, brik-llm#3371), after brikdesigns#769 found three information services flipped public with every content column NULL, rendering empty cards, and no non-browser way to take them back down. Publishing stays portal-only because rule 5 makes `image_url` unauthorable outside the uploader.
- 2026-07-28 — Matrix reconciled against portal's live `/settings/*` routes. `industry_pages` gained a write UI (`/settings/industries`, portal#850) — the "file issue if write UI needed" note was stale and had already misrouted #731. Added the missing `events` row. Added rule 5 (CMS images are upload-only → storage) after #745.
