# brikdesigns.com

Next.js 16 marketing site for Brik Designs. Deployed on Netlify.

@../../brik/brik-bds/CLAUDE.md

## Stack

- Next.js 16 + React 19 + TypeScript (App Router)
- BDS via `@brikdesigns/bds` npm package (GitHub Packages — same architecture as portal / renew-pms)
- Supabase: shared project with `brik-client-portal` staging
- Netlify (ISR)
- Themes: light/dark only (numbered BDS theme variants reserved for template marketplace)

## brikdesigns specifics

- **Branch flow** — PRs target `staging` (the repo default branch). Promote `staging → main` via PR after sign-off on the staging Netlify preview, and merge that promote PR with **"Create a merge commit"** — NEVER "Squash and merge". Squash-merging the promote PR orphans staging's commit history from main and produces structurally false conflicts in the next cycle (see [#125](https://github.com/brikdesigns/brikdesigns/issues/125)). Hotfixes may PR direct to `main`, but MUST be back-merged into `staging` in the same session to prevent drift. NEVER force-push or amend either branch.
- **Surface filter** — marketing site, USE only `surface-web` + `surface-shared` BDS components. NEVER import `surface-product`; query Storybook MCP or `bds-find` to verify a component's surface tag before importing.
- **Staging dev tools** — `BrikDevBar` + feedback widget mount via [`DevTools.tsx`](src/components/DevTools.tsx), gated on `NEXT_PUBLIC_ENABLE_DEV_TOOLS` in staging Netlify only.
- **Staging tools scope** — NEVER extend the exception to other `surface-product` components — see [decision context](https://github.com/brikdesigns/brik-llm/issues/352).
- **CSS layer order** — `src/app/globals.css` MUST declare `@layer bds-tokens, bds-components, client-theme, client-overrides;` BEFORE any imports — Tailwind preflight clobbers BDS link colors otherwise.
- **Tokens in TS/TSX** — IMPORT from [`src/lib/tokens.ts`](src/lib/tokens.ts) + [`src/lib/styles.ts`](src/lib/styles.ts). NEVER write raw `var(--...)` strings.
- **Service-line tokens** — READ [`.claude/references/service-token-decision-tree.md`](.claude/references/service-token-decision-tree.md) before writing any `--{surface,background,border,text}-service-*` CSS. `surface-*` = sections/cards, `background-*` = badges/tags/buttons — same ramp, different intent.
- **Service URL & slug convention** — READ [`.claude/references/service-url-slug-convention.md`](.claude/references/service-url-slug-convention.md) before constructing any `/services/*` URL, adding a redirect, or touching `service_lines.slug`. Five canonical short-form line slugs (`brand` / `marketing` / `information` / `product` / `service`); Webflow long-form is legacy via 30+ redirects. Never build a route from a raw DB slug — pass through `mapCategorySlug()`.
- **Service-data source-of-truth** — READ [`.claude/references/service-data-sot.md`](.claude/references/service-data-sot.md) before touching any `/services/*` surface or adding a query against `services` / `service_lines` / `offerings`. Five hard-coded TS-side arrays (Footer, NAV_COLUMNS, MAIN_LINES/CALLOUT_LINES, CATEGORY_MAP, next.config redirects) bypass `mapCategorySlug` and must be grepped before any slug rename. Implicit cross-row FKs (`related_service_slug`, `support_plan_slug`, `customer_stories.service_slug`) are not DB-enforced.
- **Services CMS write-ownership** — READ [`.claude/references/services-cms-ownership.md`](.claude/references/services-cms-ownership.md) before adding/restoring any admin write on shared tables. Portal owns the schema (all migrations) + `services` writes; brikdesigns is read-only on `services` (links to portal admin), interim-writable on `service_lines` + `offerings`, owns `blog_posts` + `customer_stories`. Webflow CSVs are migration-source, not canon — drift findings on services/offerings are legacy artifacts, not backlog.
- **Install** — `PACKAGES_READ_TOKEN` required (local: `~/.secrets/brik-packages.env`; CI: `${{ secrets.GITHUB_TOKEN }}`; Netlify: one-time site env).
- **Pre-implementation** — READ [`COMPONENT-MAP.md`](COMPONENT-MAP.md) before building any section. Every visual element comes from BDS.
- **Pre-push** — RUN `npm run build` locally before pushing. NEVER push to `staging` or `main` without user confirmation.
- **Reasoning model** — DEFAULT to Sonnet 4.6 (`claude-sonnet-4-6`) for section / content / theming work. ESCALATE to Opus for IA / navigation taxonomy, cross-cutting refactors (>5 files), or launch-gate judgment.
- **Brand** — Brik Designs company brand (not a numbered BDS template). Poppy red (`var(--color-poppy-light)` → #E35335), Poppins (300–700 weights), ThemeProvider `applyToBody={false}`.

## Where deeper context lives

- **Canon retrieval** (tokens / components / theming / a11y) → `brik-rag query "..."` or invoke the `brik-rag-query` skill
- **Content + voice** — `/blog-rewrite` skill (StoryBrand + Sandler + SEO); Brik Voice at [content-system/brand/Brik](https://design.brikdesigns.com/docs/content-system/brand/Brik)
- **Storybook MCP** (BDS component props) — see BDS CLAUDE.md § Storybook; autostarts via [`scripts/session-guard.sh`](scripts/session-guard.sh)
- **Component map** → [`COMPONENT-MAP.md`](COMPONENT-MAP.md)
- **CSS cascade rationale** — inline comments in [`src/app/globals.css`](src/app/globals.css)
- **Meganav coverage** — `netlify dev:exec --context=branch-deploy -- npm run audit:meganav` diffs [`src/lib/meganav-columns.ts`](src/lib/meganav-columns.ts) against live Supabase `service_lines` + `services`. Run after CMS edits that touch service slugs.
