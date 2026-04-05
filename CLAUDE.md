# brikdesigns.com

Next.js 16 marketing site for Brik Designs. Deployed on Netlify.

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

Token layer: `src/app/globals.css` imports BDS tokens via `@layer` cascade. Path aliases: `@bds/components` → `./brik-bds/components`, `@bds/tokens` → `./brik-bds/tokens`.

**Read `COMPONENT-MAP.md` before building any section.** Every visual element must come from BDS.

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
