# brikdesigns.com

Next.js 16 marketing site for Brik Designs. Deployed on Netlify.

---

## STOP — Worktree Rules (Non-Negotiable)

**The primary worktree at `/Documents/GitHub/brik/brikdesigns` stays on `main`.** Task work always lives in `../brikdesigns-worktrees/{slug}`. Never `git switch` the primary worktree to a `task/*` branch — it cross-contaminates work between concurrent agents. See the 2026-04-21 BDS Phase B incident for the class of bug this prevents.

**How to start a task:**

```bash
# From the primary worktree (on main), create an isolated worktree:
./scripts/new-task.sh {scope}-{name}
# e.g. ./scripts/new-task.sh marketing-hero-rework
```

The `new-task.sh` script refuses to run from anywhere but the primary on `main`, so this rule is enforced automatically. When the work is ready:

```bash
./scripts/pr-task.sh   # sync base, push, open PR — all in one step
```

**If you discover the primary is on a task branch:**

1. `cd /Users/nickstanerson/Documents/GitHub/brik/brikdesigns`
2. `git status` — inspect any uncommitted work
3. If the work belongs to a real task, move it: `git worktree add ../brikdesigns-worktrees/<slug> -b <existing-branch>` and stash/apply
4. `git switch main`

A SessionStart + PreToolUse hook (`.claude/hooks/worktree-check.sh`) warns on every session and edit when this rule is violated. Set `BDS_WORKTREE_GUARD=strict` in your environment to make it blocking.

---

@../brik-bds/CLAUDE.md

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
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

The BDS component library is exposed as a Storybook MCP server. **Always query it for component props, examples, and guidance before writing any JSX in this site.** Don't read source files in `brik-bds/components/ui/` to guess.

**Two endpoints, in priority order:**

1. **Local (preferred when available):** `http://localhost:6006/mcp` — reflects in-flight BDS changes. Autostarted by `scripts/session-guard.sh` on the first `.tsx`/`.css`/`.stories.*` edit; no manual step needed.
2. **Stable hosted (fallback):** `https://main--69b8918cac3056b39424d5d3.chromatic.com/mcp` — tracks the latest build on BDS `main`, never goes stale. Use when local Storybook isn't running.

⚠ Never use a per-build Chromatic URL (`<appid>-<random>.chromatic.com`) — those freeze on the build that produced them.

**Tools:** `list-all-documentation`, `get-documentation`, `get-documentation-for-story`, `preview-stories`, `get-storybook-story-instructions`.

**Filter by surface.** Every BDS story carries one of `surface-web`, `surface-shared`, or `surface-product`. brikdesigns.com is a marketing site, so when listing components filter to `surface-web` + `surface-shared`. **Do not use `surface-product` components** (`AddableEntryList`, `Board`, `BrikDevBar`, `CatalogPicker`, `DataSection`, `FieldGrid`, `FilterBar`, `NotificationList`, `PageHeader`, `Sheet*`, `SidebarNavigation`, `Stepper`, `TaskConsole`, etc.) — those belong in product apps and will misfit a marketing surface.

**Manual start:** `cd ~/Documents/GitHub/brik/brik-bds && npm run storybook &`

**MCP unreachable?** Read the cached fallback at [`brik-bds/docs/STORYBOOK-WRITING-GUIDE.md`](brik-bds/docs/STORYBOOK-WRITING-GUIDE.md).

## Brand

This site represents **Brik Designs company brand** — not any numbered BDS template theme.

- Primary: poppy red (`var(--color-poppy-light)` → #E35335)
- Font: Poppins (all roles, weights 300–700)
- ThemeProvider: `applyToBody={false}` — no `theme-X` class on `<body>`

## Content & Notion

Blog posts and marketing copy sourced from Notion. Use `/blog-rewrite` skill for StoryBrand + Sandler + SEO optimization. Brik Voice guide: `brik-llm/foundations/BRIK-VOICE.md`.

## LLM stack

If you add any Claude-powered feature here (blog rewrites, SEO content generation, any workflow that calls Anthropic), route through `@brikdesigns/claude-client` — not the raw `@anthropic-ai/sdk`. Every call is Helicone-traced that way, tagged with a `workflow_type` so outputs land in the same dashboard as the rest of Brik's Claude traffic. See `~/Documents/GitHub/CLAUDE.md` (cross-repo rules) + [ADR-001](../brik-llm/software/docs/adr/ADR-001-llm-enrichment-architecture.md) for the reasoning.

## Rules

- Follow global CLAUDE.md (parent directory)
- Never push to main without user confirmation
- Always build locally before pushing
- BDS development in `GitHub/brik/brik-bds/`, not in the submodule
