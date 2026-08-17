# brikdesigns.com

Next.js 16 marketing site for Brik Designs. Deployed on Netlify.

@../../brik/brik-bds/BDS-CONSUMER.md

## Stack

Next.js 16 · React 19 · TypeScript (App Router) · BDS via `@brikdesigns/bds` · Supabase (shared staging with `brik-client-portal`) · Netlify ISR · Themes: light/dark.

## When importing BDS components

Use surface-web or surface-shared. surface-product is product-app scope.

## When writing CSS or TSX styles

Import tokens from `@/lib/tokens` and `@/lib/styles`. No raw `var(--...)` strings.

## When locating the element to change on a page (surface, appearance, layout)

Read `.claude/references/page-anatomy.md`. Short form: identify the target by its **layer** in the page anatomy (Section → Layout → Container → Block → Component), read top-down from the DOM tree — never by selector-name resemblance. A BEM block name containing "card" (e.g. `bds-hero--with-pricing-card`) does **not** make it the card; that's a `<section>` (Section layer). The card is the nested Container element (`aside.bds-hero__media-card`). When a ticket says "card," it means the Container layer. Canonical: [build-standards/page-structure](https://design.brikdesigns.com/docs/build-standards/page-structure) + [composition-layers](https://design.brikdesigns.com/docs/build-standards/composition-layers).

## When adding a top-level `<section>` on a marketing page

Read `.claude/references/section-identification.md`. Short form: every top-level `<section>` in `src/app/(marketing)` carries a stable identifier — `data-section="<key>"` (default; derive mapped keys from the loop's stable key, not its index) or `aria-labelledby` when a heading `id` already exists. Not `bds-*` block names — these are hand-built, not BDS blueprints. Gated by `scripts/lint-section-id.mjs` (pre-commit + `verify.yml`), a ratchet against `scripts/section-id-baseline.json`.

## When naming CSS classes or TS data-object keys for text roles

Read `.claude/references/naming-conventions.md`. Short form: `__title` and `__description` are canonical; `__heading`, `__subtext`, and `__body` are banned. `heading` is a typography token scale — correct as an import from `styles.ts`, wrong as a class name or data-object key.

## When modifying `src/app/globals.css`

Declare `@layer bds-tokens, bds-components, client-theme, client-overrides;` before any imports.

## When opening a PR

PRs target `staging`. Promote `staging → main` after Netlify preview sign-off. Repo enforces merge-commit only — never squash or rebase. Query brik-rag for `brikdesigns merge-commit invariant` before any promote-PR action.

## When installing or running locally

Install: `op run --env-file=.env.op -- npm install`

Run dev: `./scripts/dev-restart.sh` — always, never a bare `npm run dev`. It injects `.env.op` secrets (without them every CMS route 500s on a missing Supabase client), self-sources the service-account token on headless machines, kills the existing server on the port, and picks a stable per-worktree port. Restart after every code change.

After editing a CMS row in Supabase: `./scripts/dev-restart.sh --fresh`. The Next data cache survives a plain restart and keeps serving the previous payload.

## Before pushing

Run `op run --env-file=.env.op -- npm run build` — never a bare `npm run build`. Without the injected secrets, page-data collection fails against a missing Supabase client and surfaces as `Failed to collect page data for <some CMS route>` (which route depends on build order), reading like a broken route rather than a missing credential.

Never push to `staging` or `main` without user confirmation.

## Before building a section

Read `COMPONENT-MAP.md`. Pull live layout values from Webflow via Playwright MCP (workflow: `.claude/references/visual-ground-truth-workflow.md`).

## When touching `/services/*` URLs or service_lines slugs

See `.claude/references/service-url-slug-convention.md`.

## When writing service-tier CSS

See `.claude/references/service-token-decision-tree.md`.

## When querying `services` / `service_lines` / `offerings`

See `.claude/references/service-data-sot.md`.

## When changing CMS writes on shared tables

See `.claude/references/services-cms-ownership.md`.

## When adding or replacing images in `public/`

See `.claude/references/image-optimization.md`. Short form: WebP for photos/illustrations, size source to ~2× the render slot, keep each raster file under 300 KB (CI-gated by `scripts/lint-images.mjs`).

## When extending staging-only dev tools

Query brik-rag: `brikdesigns staging dev tools scope`.

## Reasoning model

Default Sonnet 4.6. Escalate to Opus for IA / nav taxonomy / refactors >5 files / launch-gate judgment.

## Brand

Font: Poppins 300–700. ThemeProvider: `applyToBody={false}`. Color rationale (poppy-dark vs poppy-light): brik-rag `brikdesigns brand poppy color rationale`.
