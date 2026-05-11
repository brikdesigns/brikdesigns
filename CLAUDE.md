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

- **Surface filter** — marketing site, USE only `surface-web` + `surface-shared` BDS components. NEVER import `surface-product`; query Storybook MCP or `bds-find` to verify a component's surface tag before importing.
- **Staging dev tools** — `BrikDevBar` + feedback widget mount via [`DevTools.tsx`](src/components/DevTools.tsx), gated on `NEXT_PUBLIC_ENABLE_DEV_TOOLS` in staging Netlify only.
- **Staging tools scope** — NEVER extend the exception to other `surface-product` components — see [decision context](https://github.com/brikdesigns/brik-llm/issues/352).
- **CSS layer order** — `src/app/globals.css` MUST declare `@layer bds-tokens, bds-components, client-theme, client-overrides;` BEFORE any imports — Tailwind preflight clobbers BDS link colors otherwise.
- **Tokens in TS/TSX** — IMPORT from [`src/lib/tokens.ts`](src/lib/tokens.ts) + [`src/lib/styles.ts`](src/lib/styles.ts). NEVER write raw `var(--...)` strings.
- **Install** — `PACKAGES_READ_TOKEN` required (local: `~/.secrets/brik-packages.env`; CI: `${{ secrets.GITHUB_TOKEN }}`; Netlify: one-time site env).
- **Pre-implementation** — READ [`COMPONENT-MAP.md`](COMPONENT-MAP.md) before building any section. Every visual element comes from BDS.
- **Pre-push** — RUN `npm run build` locally before pushing. NEVER push to `main` without user confirmation.
- **Reasoning model** — DEFAULT to Sonnet 4.6 (`claude-sonnet-4-6`) for section / content / theming work. ESCALATE to Opus for IA / navigation taxonomy, cross-cutting refactors (>5 files), or launch-gate judgment.
- **Brand** — Brik Designs company brand (not a numbered BDS template). Poppy red (`var(--color-poppy-light)` → #E35335), Poppins (300–700 weights), ThemeProvider `applyToBody={false}`.

## Where deeper context lives

- **Canon retrieval** (tokens / components / theming / a11y) → `brik-rag query "..."` or invoke the `brik-rag-query` skill
- **Content + voice** — `/blog-rewrite` skill (StoryBrand + Sandler + SEO); Brik Voice at [content-system/brand/Brik](https://design.brikdesigns.com/docs/content-system/brand/Brik)
- **Storybook MCP** (BDS component props) — see BDS CLAUDE.md § Storybook; autostarts via [`scripts/session-guard.sh`](scripts/session-guard.sh)
- **Component map** → [`COMPONENT-MAP.md`](COMPONENT-MAP.md)
- **CSS cascade rationale** — inline comments in [`src/app/globals.css`](src/app/globals.css)
