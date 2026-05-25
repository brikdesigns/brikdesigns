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

- **Branch flow** — PRs target `staging` (the repo default branch). Promote `staging → main` via PR after sign-off on the staging Netlify preview. **Repo settings enforce merge-commits**: `allow_squash_merge` and `allow_rebase_merge` are both `false`, so "Create a merge commit" is the only available merge button. Do not flip these back without reading [#125](https://github.com/brikdesigns/brikdesigns/issues/125) and [#184](https://github.com/brikdesigns/brikdesigns/pull/184) — squash/rebase on a promote or reconcile PR orphans history and produces structurally false conflicts (and three reconcile attempts to clean up). **Post-merge verification** (run after merging any promote or reconcile PR): `git fetch origin && git log -1 --pretty=%P origin/<branch>` — two SHAs = correct merge-commit, one SHA = drift, revert immediately. Hotfixes may PR direct to `main`, but MUST be back-merged into `staging` in the same session. NEVER force-push or amend either branch.
- **Surface filter** — marketing site, USE only `surface-web` + `surface-shared` BDS components. NEVER import `surface-product`; query Storybook MCP or `bds-find` to verify a component's surface tag before importing.
- **Staging dev tools** — `BrikDevBar` + feedback widget mount via [`DevTools.tsx`](src/components/DevTools.tsx), gated on `NEXT_PUBLIC_ENABLE_DEV_TOOLS` in staging Netlify only.
- **Staging tools scope** — NEVER extend the exception to other `surface-product` components — see [decision context](https://github.com/brikdesigns/brik-llm/issues/352).
- **CSS layer order** — `src/app/globals.css` MUST declare `@layer bds-tokens, bds-components, client-theme, client-overrides;` BEFORE any imports — Tailwind preflight clobbers BDS link colors otherwise.
- **Tokens in TS/TSX** — IMPORT from [`src/lib/tokens.ts`](src/lib/tokens.ts) + [`src/lib/styles.ts`](src/lib/styles.ts). NEVER write raw `var(--...)` strings.
- **Service-line tokens** — READ [`.claude/references/service-token-decision-tree.md`](.claude/references/service-token-decision-tree.md) before writing any `--{surface,background,border,text}-service-*` CSS. `surface-*` = sections/cards, `background-*` = badges/tags/buttons — same ramp, different intent.
- **Service URL & slug convention** — READ [`.claude/references/service-url-slug-convention.md`](.claude/references/service-url-slug-convention.md) before constructing any `/services/*` URL, adding a redirect, or touching `service_lines.slug`. Five canonical short-form line slugs (`brand` / `marketing` / `information` / `product` / `service`); Webflow long-form is legacy via 30+ redirects. Never build a route from a raw DB slug — pass through `mapCategorySlug()`.
- **Service-data source-of-truth** — READ [`.claude/references/service-data-sot.md`](.claude/references/service-data-sot.md) before touching any `/services/*` surface or adding a query against `services` / `service_lines` / `offerings`. Five hard-coded TS-side arrays (Footer, NAV_COLUMNS, MAIN_LINES/CALLOUT_LINES, CATEGORY_MAP, next.config redirects) bypass `mapCategorySlug` and must be grepped before any slug rename. Implicit cross-row FKs (`related_service_slug`, `support_plan_slug`, `customer_stories.service_slug`) are not DB-enforced.
- **Services CMS write-ownership** — READ [`.claude/references/services-cms-ownership.md`](.claude/references/services-cms-ownership.md) before adding/restoring any admin write on shared tables. Portal owns the schema (all migrations) and writes for `services` / `service_lines` / `offerings`; brikdesigns admin is read-only on all three (links to portal `/settings/*`) and still owns writes for `blog_posts` + `customer_stories`. Webflow CSVs are migration-source, not canon — drift findings on services / service_lines / offerings are legacy artifacts, not backlog.
- **Install** — `op run --env-file=.env.op -- npm install` (resolves `PACKAGES_READ_TOKEN` from 1Password via [`.env.op`](.env.op) — see [README § Install dependencies](README.md#install-dependencies)). CI: `${{ secrets.GITHUB_TOKEN }}`; Netlify: one-time site env. Shell-env fallback via `~/.secrets/brik-packages.env` still works during the [brik-llm#570](https://github.com/brikdesigns/brik-llm/issues/570) cutover but is being retired.
- **Pre-implementation** — READ [`COMPONENT-MAP.md`](COMPONENT-MAP.md) before building any section. Every visual element comes from BDS.
- **Visual ground truth** — READ [`.claude/references/visual-ground-truth-workflow.md`](.claude/references/visual-ground-truth-workflow.md) before writing CSS or layout for any page section. Use Playwright MCP to read live Webflow computed styles. Never guess padding, spacing, or color values.
- **Pre-push** — RUN `npm run build` locally before pushing. NEVER push to `staging` or `main` without user confirmation.
- **Reasoning model** — DEFAULT to Sonnet 4.6 (`claude-sonnet-4-6`) for section / content / theming work. ESCALATE to Opus for IA / navigation taxonomy, cross-cutting refactors (>5 files), or launch-gate judgment.
- **Brand** — Brik Designs company brand (not a numbered BDS template). Poppy red (`var(--color-poppy-dark)` → #B0351B), Poppins (300–700 weights), ThemeProvider `applyToBody={false}`. The brand primitive was darkened from poppy-light (#E35335) to poppy-dark in [#219](https://github.com/brikdesigns/brikdesigns/pull/219) so white text on the primary button surface clears WCAG 2.1 AA (3.78:1 → 6.23:1). The lighter shade still exists as `--color-poppy-light` / `--poppy--light-base` and is pinned for dark-mode text where the darker shade fails AA on the black page bg.

## Where deeper context lives

- **Canon retrieval** (tokens / components / theming / a11y) → `brik-rag query "..."` or invoke the `brik-rag-query` skill
- **Content + voice** — `/blog-rewrite` skill (StoryBrand + Sandler + SEO); Brik Voice at [content-system/brand/Brik](https://design.brikdesigns.com/docs/content-system/brand/Brik)
- **Storybook MCP** (BDS component props) — see BDS CLAUDE.md § Storybook; autostarts via [`scripts/session-guard.sh`](scripts/session-guard.sh)
- **Component map** → [`COMPONENT-MAP.md`](COMPONENT-MAP.md)
- **CSS cascade rationale** — inline comments in [`src/app/globals.css`](src/app/globals.css)
- **Meganav coverage** — `netlify dev:exec --context=branch-deploy -- npm run audit:meganav` diffs [`src/lib/meganav-columns.ts`](src/lib/meganav-columns.ts) against live Supabase `service_lines` + `services`. Run after CMS edits that touch service slugs.
