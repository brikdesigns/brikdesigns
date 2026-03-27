# brikdesigns.com

Next.js 16 marketing site for Brik Designs. Deployed on Netlify.

## Architecture

- **Framework:** Next.js 16, React 19, TypeScript, App Router
- **Styling:** BDS design tokens (CSS custom properties) + Tailwind CSS for utilities
- **Design System:** BDS via git submodule at `./brik-bds/` — aliased as `@bds/components` and `@bds/tokens`
- **Data:** Supabase (same project as brik-client-portal)
- **Deployment:** Netlify with ISR
- **Themes:** Light/dark only (other BDS themes reserved for template marketplace)

## Key Commands

```bash
npm run dev          # Dev server (http://localhost:3000)
npm run build        # Production build
npm run lint         # ESLint
```

## BDS Usage — MANDATORY

**Read `COMPONENT-MAP.md` before building ANY section.** This is non-negotiable.

### BDS-First Rule (STRICT — NO EXCEPTIONS)

Every visual element on this site MUST come from BDS. If you find yourself writing
CSS for something BDS already provides, you are doing it wrong. Stop and use the component.

**NEVER do these things:**
- NEVER write custom button CSS — use `<LinkButton>` or `<Button>` with a variant
- NEVER use emoji as icons — use Font Awesome via BDS font tokens (`font-family: 'Font Awesome 6 Pro Solid 900'`)
- NEVER hardcode border-radius — use `var(--border-radius-md)` etc. from BDS tokens
- NEVER hardcode colors — use BDS semantic tokens (`--text-primary`, `--surface-brand-primary`, etc.)
- NEVER hardcode font properties — use shared text utility classes (`text-heading-lg`, `text-body-sm`)
- NEVER use inline styles for layout — write a CSS class in the page's CSS file
- NEVER invent token names — if it's not in BDS `figma-tokens.css`, flag it

**ALWAYS do these things:**
- ALWAYS check `brik-bds/components/ui/` for an existing component before building anything
- ALWAYS use BDS button variants (primary, outline, secondary, inverse, ghost) — they share padding, radius, font
- ALWAYS use BDS tokens for spacing, colors, typography, borders, shadows
- ALWAYS reference Storybook as the source of truth for component appearance
- ALWAYS write section-specific CSS as layout only (flex/grid arrangement, gaps, widths)

### Pre-Build Checklist (ENFORCED)

Before writing ANY new CSS class, check in this order:

1. **BDS component?** → `ls brik-bds/components/ui/` — if it exists, USE IT
2. **Button?** → `<LinkButton>` or `<Button>` from `@bds/components/ui/Button` — NEVER write button CSS
3. **Icon?** → Use Font Awesome codepoints with BDS icon font-family — NEVER use emoji
4. **Layout wrapper?** → Use shared classes from `shared-sections.css`
5. **Typography?** → Use `.text-heading-lg`, `.text-body-md` etc. from `shared-sections.css`
6. **Only if none of the above** → Write section-specific CSS (and document why)

### Imports

Components: `import { LinkButton } from '@bds/components/ui/Button/LinkButton';`
Token cascade in `globals.css` (order matters):

1. `brik-bds/tokens/fonts.css` — font-face declarations
2. `brik-bds/tokens/figma-tokens.css` — generated light mode tokens (DO NOT EDIT)
3. `brik-bds/tokens/figma-tokens-dark.css` — generated dark mode tokens (DO NOT EDIT)
4. `brik-bds/tokens/overrides.css` — theme palettes + gap-fill
5. `:root` block — Brik brand overrides only (poppy red, Poppins)

Brand overrides (Brik poppy red, Poppins) are in `globals.css` `:root` block.
Dark mode semantic tokens are generated from Figma — NEVER hand-write `[data-theme="dark"]` token values. Only brand-specific dark overrides (swapping BDS blue → Brik poppy) belong in the hand-written block.

**Do NOT use BDS ThemeProvider from `@bds/components/providers`.** This site uses a custom `ThemeProvider` at `src/components/providers/ThemeProvider.tsx` that only supports light/dark.

### Key BDS Components for Marketing Pages

| Need | Component | Import |
|------|-----------|--------|
| Button/CTA | `LinkButton` / `Button` | `@bds/components/ui/Button` |
| Service icon | `ServiceBadge` | `@bds/components/ui/ServiceBadge` |
| Image card | `CardDisplay` | `@bds/components/ui/CardDisplay` |
| Feature card | `CardFeature` | `@bds/components/ui/CardFeature` |
| Testimonial | `CardTestimonial` | `@bds/components/ui/CardTestimonial` |
| Pricing tier | `PricingCard` | `@bds/components/ui/PricingCard` |
| FAQ | `Accordion` | `@bds/components/ui/Accordion` |
| Page header | `PageHeader` | `@bds/components/ui/PageHeader` |
| Footer | `Footer` | `@bds/components/ui/Footer` |

Full mapping: see `COMPONENT-MAP.md`

## Webflow Reference (Visual Only)

Archived Webflow export is at `../brikdesigns-legacy/_reference/webflow-export/`.
Do NOT import CSS, JS, or tokens from these files.

**Source of truth:** BDS Storybook (components + tokens), NOT the Webflow export.
**Visual reference:** `WebFetch` the live site at brikdesigns.com when needed.

## Supabase

- **Browser client:** `src/lib/supabase/client.ts`
- **Server client:** `src/lib/supabase/server.ts` (anon key for reads)
- **Service client:** `createServiceClient()` in server.ts (service role key for lead creation)
- **Queries:** `src/lib/supabase/queries.ts` (typed marketing content queries)

Marketing tables use RLS: public read for `is_public = true`, admin write via `is_brik_admin()`.

**WARNING: This site connects to Brik Portal — Staging (`lmhzpzobdkstzpvsqest`).** The live portal (portal.brikdesigns.com) connects to Brik Portal — Production (`rnspxmrkpoukccahggli`). These are DIFFERENT databases. See global CLAUDE.md "Supabase Safety Rules" for details. Never touch production without explicit confirmation.

## Page Rendering Strategy

| Route | Strategy |
|-------|----------|
| `/` (homepage) | ISR (1 hour) |
| `/services`, `/plans` | ISR (1 hour) |
| `/services/[category]/[service]` | SSG + ISR (24 hours) |
| `/customer-stories/[slug]` | SSG + ISR (24 hours) |
| `/blog/[slug]` | SSG (MDX, build-time) |
| `/get-started` | SSR (reads URL params) |
| `/contact`, `/about`, `/free-marketing-analysis` | Static |

## Lead Capture Pipeline

Marketing site captures leads via `POST /api/leads`:
1. Creates `companies` row (type: 'lead', status: 'new')
2. Creates `contacts` row (is_primary: true)
3. Brik admin sees lead in portal → qualifies → sends proposal
4. Client accepts → agreement → welcome flow → portal access

**No self-serve Stripe checkout on this site.** Sales flow is consultative.

## Netlify

- Config: `netlify.toml`
- Webflow→new URL redirects are configured there
- ISR revalidation: `POST /api/revalidate` (secret-protected, called by portal)

## File Structure

```
src/
  app/              Page routes (App Router)
  components/
    layout/         Header, Footer, ThemeToggle
    providers/      ThemeProvider (light/dark only)
    marketing/      ServiceCard, PlanCard, etc. (TODO)
    animations/     GSAP components (TODO)
  lib/
    supabase/       Client, server, queries
  content/
    blog/           MDX blog posts (TODO)
brik-bds/           Git submodule (design system)
netlify.toml        Netlify config + redirects
```
