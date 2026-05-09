# brikdesigns.com

Next.js 16 marketing site for Brik Designs. Deployed on Netlify.

---

## Worktree (brikdesigns specifics)

- **Base branch:** `main`
- **Worktree path:** `../brikdesigns-worktrees/{slug}`
- **Spawn:** `./scripts/new-task.sh {slug}` from the primary
- **Ship:** `./scripts/pr-task.sh` — sync base + push + open PR in one step
- **Hook:** `.claude/hooks/worktree-check.sh` warns on session start + first edit

Full rule shape, rationale, and the pre-action checklist live in cross-repo CLAUDE.md (`~/Documents/GitHub/CLAUDE.md`) § Agent scope discipline.

---

@../../brik/brik-bds/CLAUDE.md

---

## Tech Stack

| Layer | Technology |
| --- | --- |
| Framework | Next.js 16, React 19, TypeScript, App Router |
| Styling | BDS design tokens + Tailwind CSS utilities |
| Design System | `@brikdesigns/bds` (npm package via GitHub Packages — same as portal/renew-pms) |
| Data | Supabase (same project as brik-client-portal staging) |
| Deployment | Netlify with ISR |
| Themes | Light/dark only (other BDS themes reserved for template marketplace) |

## Key Commands

```bash
npm run dev          # Dev server (http://localhost:3000)
npm run build        # Production build
npm run lint         # ESLint
```

## BDS Usage

**brikdesigns consumes BDS via the `@brikdesigns/bds` npm package** (matches portal/renew-pms architecture). Imports are flat:

```tsx
import { Button, Card, ServiceBadge } from '@brikdesigns/bds';
import { type ServiceCategory } from '@brikdesigns/bds';
```

Token + styles cascade is wired in `src/app/globals.css`:

```css
@layer theme, base, components, utilities;
@layer bds-tokens, bds-components, client-theme, client-overrides;
@import '@brikdesigns/bds/tokens.css' layer(bds-tokens);
@import '@brikdesigns/bds/styles.css' layer(bds-components);
@import "tailwindcss";
```

The explicit `@layer ...;` order before any imports is **required** to put `bds-components` higher than Tailwind's `base` preflight (which contains `a { color: inherit; }`). Without this, BDS component link colors get clobbered by Tailwind. See globals.css comment block for full rationale.

Token layer (TypeScript wrappers): `src/lib/tokens.ts` + `src/lib/styles.ts`.

**Install requires `PACKAGES_READ_TOKEN` env var** — local dev sources from `~/.secrets/brik-packages.env`; CI uses `${{ secrets.GITHUB_TOKEN }}`; Netlify must have it set in site env (one-time ops).

**Read `COMPONENT-MAP.md` before building any section.** Every visual element must come from BDS.

### Storybook MCP — query before writing UI

Always query the Storybook MCP for BDS component props before writing JSX. Endpoint, tool list, autostart helper, and unreachable-fallback are documented in BDS CLAUDE.md (`@-imported` above) § Storybook MCP addon. Local autostart fires on first `.tsx`/`.css`/`.stories.*` edit via `scripts/session-guard.sh`; no manual start needed.

**brikdesigns-specific surface filter.** brikdesigns.com is a marketing site — filter to `surface-web` + `surface-shared`. **Never use `surface-product` components** (`AddableEntryList`, `Board`, `BrikDevBar`, `CatalogPicker`, `DataSection`, `FieldGrid`, `FilterBar`, `NotificationList`, `PageHeader`, `Sheet*`, `SidebarNavigation`, `Stepper`, `TaskConsole`, etc.) — they belong in product apps and will misfit a marketing surface.

**Staging-only exception (Phase 3 of brikdesigns/brik-llm#352, since #54).** `BrikDevBar` + the vanilla feedback widget (form-mode + user-auth) are mounted via `src/components/DevTools.tsx`, gated behind `NEXT_PUBLIC_ENABLE_DEV_TOOLS === 'true'`. The env var is set only on the staging Netlify context and the entire dynamic-import branch tree-shakes out of the production bundle. Don't extend this exception to other `surface-product` components without an updated decision in #352.

### Canon retrieval — `brik-rag` for design reasoning

The Storybook MCP above answers *"what props does `Card` take?"*. The `brik-rag` MCP answers *"which token / component / pattern fits this decision?"* — semantic retrieval over the canon corpus (tokens, components, theming, a11y) per [ADR-006](../../brik/brik-llm/software/docs/adr/ADR-006-design-vocabulary-corpus.md). Use both: `bds-find` to confirm a component exists, `brik-rag.query` to reason about which one fits.

**Pass `workflow_type: "brikdesigns-build"`** on every `mcp__brik-rag__query` call. This tags Helicone traces and the retrieval log so the rebuild's canon usage feeds [brik-llm#374](https://github.com/brikdesigns/brik-llm/issues/374) baseline measurement.

**Query before writing — pick the `source_type` filter to match the decision:**

| About to write… | `source_type` filter |
| --- | --- |
| CSS referencing tokens or theming patterns | `['canon-tokens', 'canon-theming']` |
| Section composed from BDS components | `['canon-components']` |
| Interactive surface (form, modal, nav, focus state) | `['canon-a11y', 'canon-components']` |
| Cross-cutting decision spanning multiple layers | `['canon']` (family-level) |

**Capture non-obvious lessons via `mcp__brik-rag__remember_lesson`** as the rebuild surfaces them ("picked Card variant X over Y because Z," "this content pattern needed a custom container because…"). Every solved problem becomes retrievable for future Brik work — the rebuild itself contributes to the corpus.

**Reasoning model.** Default to **Sonnet 4.6** (`claude-sonnet-4-6`) for this work — section composition, content drafts, theming decisions, responsive tuning are all pattern-following, retrieval-grounded work where Sonnet is sufficient *when canon is in context*. Reach for Opus only on (a) information-architecture / navigation-taxonomy decisions, (b) cross-cutting refactors touching >5 files, or (c) Phase 5 launch-gate go/no-go judgment. Without canon in context, Sonnet quality drops — the discipline is "ground first, then reason."

Opt-in per call. The auto-injection hook from [ADR-005](../../brik/brik-llm/software/docs/adr/ADR-005-three-tier-memory-model.md) Decision 4 is not deployed yet — you have to ask.

## Brand

This site represents **Brik Designs company brand** — not any numbered BDS template theme.

- Primary: poppy red (`var(--color-poppy-light)` → #E35335)
- Font: Poppins (all roles, weights 300–700)
- ThemeProvider: `applyToBody={false}` — no `theme-X` class on `<body>`

## Content & Notion

Blog posts and marketing copy sourced from Notion. Use `/blog-rewrite` skill for StoryBrand + Sandler + SEO optimization. Brik Voice substrate: [`brik-bds/content-system/brand/Brik.mdx`](https://design.brikdesigns.com/docs/content-system/brand/Brik).

## Rules

- Follow global CLAUDE.md (parent directory)
- Never push to main without user confirmation
- Always build locally before pushing
- BDS development in `GitHub/brik/brik-bds/`, not in the submodule
