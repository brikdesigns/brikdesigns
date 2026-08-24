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

Read [`.claude/references/page-anatomy.md`](.claude/references/page-anatomy.md) — identify the target by its **layer** (Section → Layout → Container → Block → Component) read top-down from the DOM, never by selector-name resemblance (a `card` in a BEM name is still its layer; "card" in a ticket means the Container) → [build-standards/page-structure](https://design.brikdesigns.com/docs/build-standards/page-structure).

## When changing how many items a list or grid renders

Read [`page-anatomy.md`](.claude/references/page-anatomy.md) § "When you change how many items a collection renders" — an item-count change is a layout change, so a `repeat(N, …)` grid must render ≥N children; grep the container's layout rule in the same change (gated by `tests/a11y/grid-column-fit.spec.ts`).

## When adding a top-level `<section>` on a marketing page

Read [`section-identification.md`](.claude/references/section-identification.md) — every top-level `<section>` in `src/app/(marketing)` carries a stable id (`data-section="<key>"` by default, or `aria-labelledby` when a heading `id` exists), never a `bds-*` block name (gated by `scripts/lint-section-id.mjs`, a ratchet against `scripts/section-id-baseline.json`).

## When naming CSS classes or TS data-object keys for text roles

Read [`naming-conventions.md`](.claude/references/naming-conventions.md) — `__title` / `__description` are canonical, while `__heading` / `__subtext` / `__body` are banned (`heading` is a typography token to import from `styles.ts`, never a class name or data-object key).

## When modifying `src/app/globals.css`

Declare `@layer bds-tokens, bds-components, client-theme, client-overrides;` before any imports.

## When opening a PR

USE merge-commit only — NEVER squash or rebase; target `staging` for PRs and promote `staging → main` only after Netlify preview sign-off → `brik-rag query "brikdesigns merge-commit invariant"` before any promote-PR.

## When installing or running locally

Install: `op run --env-file=.env.op -- npm install`

RUN `./scripts/dev-restart.sh` for dev — ALWAYS, never a bare `npm run dev` (it injects `.env.op` secrets, self-sources the headless token, kills the port's server, and picks a stable per-worktree port); restart after every code change.

After editing a CMS row in Supabase: `./scripts/dev-restart.sh --fresh`. The Next data cache survives a plain restart and keeps serving the previous payload.

`dev-restart.sh` refuses to start when the installed `@brikdesigns/bds` does not satisfy `package.json` — a stale install 500s every route on `Export <Name> doesn't exist in target module`, which reads like a broken import rather than a missing `npm ci`. Fix with `op run --env-file=.env.op -- npm ci`; never work around the check.

## Before pushing

RUN `op run --env-file=.env.op -- npm run build` — never a bare `npm run build`; without the injected secrets, page-data collection fails as `Failed to collect page data for <CMS route>`, which reads like a broken route but is a missing credential.

Never push to `staging` or `main` without user confirmation.

## Before building a section

Read `COMPONENT-MAP.md`. Pull live layout values from Webflow via Playwright MCP (workflow: `.claude/references/visual-ground-truth-workflow.md`).

## When touching `/services/*` URLs or service_lines slugs

See `.claude/references/service-url-slug-convention.md`.

## When writing service-tier CSS

See `.claude/references/service-token-decision-tree.md`.

## When setting a card's border/shadow (any `<Card>`)

See [`card-treatment.md`](.claude/references/card-treatment.md) — card chrome is **band-derived**, never a `variant` prop (white/default band → border + no shadow; tinted band → shadow + no border); never `variant="raised"/"elevated"` or a per-page override, instead put the section on the "Card chrome by band" rule in `shared-sections.css` (gated by `tests/a11y/card-treatment.spec.ts`).

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

USE Poppins 300–700 and `ThemeProvider applyToBody={false}` → color rationale (poppy-dark vs poppy-light): `brik-rag query "brikdesigns brand poppy color rationale"`.
