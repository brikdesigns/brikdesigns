# Accessibility tests

Automated WCAG 2.1 AA audit using `@axe-core/playwright`. Runs against every
PR's Netlify deploy-preview, and locally via `npm run test:a11y`.

## Hard rules (per cross-repo CLAUDE.md § Accessibility)

1. **Conformance level locked to WCAG 2.1 AA** (`wcag2a`, `wcag2aa`, `wcag21a`,
   `wcag21aa`). Don't silently bump the level to 2.2 or AAA without a
   decisions-log entry. The tag set also includes **`best-practice`** — not a
   level bump, but the only way to enable axe's landmark rules (`region`,
   `landmark-one-main`, `landmark-unique`, `heading-order`), which carry no WCAG
   tag. These are `moderate` impact → advisory, never block. This is the
   `build-standards/page-structure` landmark gate (brik-bds #824), mirroring
   brik-client-portal #961.
2. **Per-selector baseline only.** Never `disableRules` whole-app — partial
   disable weakens the ADA defense story ("we run WCAG 2.1 AA").
3. **CI runs against the Netlify deploy-preview**, not a CI-side rebuild.
   Avoids exposing Supabase secrets to GitHub Actions for a low-risk gate.
4. **`reducedMotion: 'reduce'`** in the Playwright config — bypasses
   scroll-reveal opacity:0 false-positives that would otherwise spam
   contrast violations on first paint.

## Files

| File | Purpose |
|------|---------|
| `public-routes.spec.ts` | Iterates the public route list, runs axe on each, fails on new serious/critical |
| `baseline.json` | Per-(route, rule, selector) allowlist for pre-existing debt. Empty initially; populated only when something is too expensive to fix immediately and burned down monthly |
| `README.md` | This file |

## Adding a route

Add it to `PUBLIC_ROUTES` in `public-routes.spec.ts`. Dynamic routes are
covered by one representative slug per family (`/services/brand`, `/blog/<slug>`,
etc.) — pick a route that's representative of the layout, not edge cases.

## When axe finds something on a new PR

**Default**: fix it. The blocking rule set (serious + critical) is small;
most fixes are 1-line CSS changes.

**Escape hatch**: if the fix is genuinely too expensive for the current PR,
add the (route, rule-id, selector) tuple to `baseline.json`:

```json
{
  "routes": {
    "/services/brand": {
      "color-contrast": [
        ".some-class .some-child"
      ]
    }
  }
}
```

Open a follow-up issue in the same commit and link it from a comment in
`baseline.json`. Burn-down expectation: first Monday of every month, ship
a PR removing the cheapest-to-fix selectors. Don't accumulate.

### Selector matching: positional indices are stripped

The matcher in `public-routes.spec.ts` normalizes both sides by stripping
`:nth-child(N)` and `:nth-of-type(N)` before comparing. Five service
cards with the same low-contrast subtext register as one baseline entry,
not five. Write baseline entries in the canonical (un-indexed) form:

```json
".service-card > .service-card__content > .service-card__description"
```

…not `:nth-child(1)`, `:nth-child(2)`, etc. Axe will emit the indexed
form at audit time, but the matcher absorbs it. See issue #40 for the
underlying motivation.

## Excluded from the audit

The axe run excludes two environment-only overlays that aren't production
content:

- `iframe[title="Netlify Drawer"]` — Netlify deploy-preview admin UI.
- `.bdb-bar` — the **Brik Dev Bar** (`BrikDevBar`), injected client-side when
  `NEXT_PUBLIC_ENABLE_DEV_TOOLS=true` (see `src/components/DevTools.tsx`). It's
  absent in production. Before it was excluded it produced a **flaky blocking**
  white-on-poppy `color-contrast` finding (`.bdb-logo`, 3.78:1) and a spurious
  `region` finding — flaky because it mounts after `load`. `.bdb-logo` is inside
  `.bdb-bar`, so the one exclude covers the whole subtree.

## Landmark audit findings (captured 2026-06-04, staging)

Surfaced once the landmark rules were enabled (brik-bds #824). All `moderate`
→ advisory, never block; none baselined (baseline is serious/critical only).
Captured against `staging--brikdesigns.netlify.app` — the Next.js rebuild.
(`www.brikdesigns.com` is still the legacy Webflow site and is **not** a valid
target for this gate.)

| Rule | Selector | Routes | Owner |
|------|----------|--------|-------|
| `heading-order` | `.bds-footer__column > h6` | all standard-layout routes | BDS Footer — `h6` follows higher headings |
| `heading-order` | card headings (`.story-card`, `.about-team-name`, `.bds-pricing-card__title`, `.customer-topic-grid h3`) | /customer-stories, /about, /plans, /customers/dental | brikdesigns page components |
| `landmark-complementary-is-top-level` | `aside` | /services/brand/logo-design | `aside` nested inside another landmark |
| `landmark-unique` | `.mega-nav__main` | /value | nav landmark needs a distinct accessible name |

**Needs in-browser investigation (not yet triaged):** `/value`, `/get-started`,
`/contact`, `/free-marketing-analysis`, `/privacy-policy` *intermittently*
report no `<main>` + loose `region` findings (`.branding`, `.footer`), but their
**server-rendered HTML has a proper `<main>`** — pointing to a client-side error
boundary on staging (flaky CMS call), not a real structure violation. Confirm in
a headed browser before baselining or filing.

## Healthcare clients

If brikdesigns ever hosts a healthcare client surface, the elevated rules
in `@brikdesigns/bds/content-system/compliance/healthcare-ada.md` apply on
top of the base WCAG 2.1 AA gate. Today, brikdesigns.com is general-business
marketing, so base AA is the standard.
