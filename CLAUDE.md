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
| Design System | BDS submodule at `./brik-bds/` — aliased `@bds/components`, `@bds/tokens` |
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

Token layer: `src/lib/tokens.ts` + `src/lib/styles.ts`. Path aliases: `@bds/components` → `./brik-bds/components`.

**Read `COMPONENT-MAP.md` before building any section.** Every visual element must come from BDS.

### Storybook MCP — query before writing UI

Always query the Storybook MCP for BDS component props before writing JSX. Endpoint, tool list, autostart helper, and unreachable-fallback are documented in BDS CLAUDE.md (`@-imported` above) § Storybook MCP addon. Local autostart fires on first `.tsx`/`.css`/`.stories.*` edit via `scripts/session-guard.sh`; no manual start needed.

**brikdesigns-specific surface filter.** brikdesigns.com is a marketing site — filter to `surface-web` + `surface-shared`. **Never use `surface-product` components** (`AddableEntryList`, `Board`, `BrikDevBar`, `CatalogPicker`, `DataSection`, `FieldGrid`, `FilterBar`, `NotificationList`, `PageHeader`, `Sheet*`, `SidebarNavigation`, `Stepper`, `TaskConsole`, etc.) — they belong in product apps and will misfit a marketing surface.

## Brand

This site represents **Brik Designs company brand** — not any numbered BDS template theme.

- Primary: poppy red (`var(--color-poppy-light)` → #E35335)
- Font: Poppins (all roles, weights 300–700)
- ThemeProvider: `applyToBody={false}` — no `theme-X` class on `<body>`

## Content & Notion

Blog posts and marketing copy sourced from Notion. Use `/blog-rewrite` skill for StoryBrand + Sandler + SEO optimization. Brik Voice guide: `brik-llm/foundations/BRIK-VOICE.md`.

## Rules

- Follow global CLAUDE.md (parent directory)
- Never push to main without user confirmation
- Always build locally before pushing
- BDS development in `GitHub/brik/brik-bds/`, not in the submodule
