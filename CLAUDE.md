# brikdesigns.com

Next.js 16 marketing site for Brik Designs. Deployed on Netlify.

@../../brik/brik-bds/CLAUDE.md

## Stack

Next.js 16 · React 19 · TypeScript (App Router) · BDS via `@brikdesigns/bds` · Supabase (shared staging with `brik-client-portal`) · Netlify ISR · Themes: light/dark.

## When importing BDS components

Use surface-web or surface-shared. surface-product is product-app scope.

## When writing CSS or TSX styles

Import tokens from `@/lib/tokens` and `@/lib/styles`. No raw `var(--...)` strings.

## When locating the element to change on a page (surface, appearance, layout)

Read `.claude/references/page-anatomy.md`. Short form: identify the target by its **layer** in the page anatomy (Section → Layout → Container → Block → Component), read top-down from the DOM tree — never by selector-name resemblance. A BEM block name containing "card" (e.g. `bp-hero-img-card`) does **not** make it the card; that's a `<section>` (Section layer). The card is the nested Container element (`aside.bp-hero-img-card__media-card`). When a ticket says "card," it means the Container layer. Canonical: [build-standards/page-structure](https://design.brikdesigns.com/docs/build-standards/page-structure) + [composition-layers](https://design.brikdesigns.com/docs/build-standards/composition-layers).

## When naming CSS classes or TS data-object keys for text roles

Read `.claude/references/naming-conventions.md`. Short form: `__title` and `__description` are canonical; `__heading`, `__subtext`, and `__body` are banned. `heading` is a typography token scale — correct as an import from `styles.ts`, wrong as a class name or data-object key.

## When modifying `src/app/globals.css`

Declare `@layer bds-tokens, bds-components, client-theme, client-overrides;` before any imports.

## When opening a PR

PRs target `staging`. Promote `staging → main` after Netlify preview sign-off. Repo enforces merge-commit only — never squash or rebase. Query brik-rag for `brikdesigns merge-commit invariant` before any promote-PR action.

## When installing or running locally

`op run --env-file=.env.op -- npm install`

## Before pushing

Run `npm run build`. Never push to `staging` or `main` without user confirmation.

## Before building a section

Read `COMPONENT-MAP.md`. Pull live layout values from Webflow via Playwright MCP (workflow: `.claude/references/visual-ground-truth-workflow.md`).

## When touching `/services/*` URLs or service_lines slugs

See `.claude/references/service-url-slug-convention.md`.

## When writing service-tier CSS

See `.claude/references/service-token-decision-tree.md`.

## When placing a card on a tinted surface (service tint, `--surface-secondary`, `--surface-accent`)

See `.claude/references/card-chrome-on-tint.md`. Short form: drop the gray border ring; browse grids → flat (no border/shadow), focal/lone cards → elevated (no border, `--box-shadow-md`); keep the `--surface-primary` fill, never the transparent `borderless` variant.

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
