# Accessibility tests

Automated WCAG 2.1 AA audit using `@axe-core/playwright`. Runs against every
PR's Netlify deploy-preview, and locally via `npm run test:a11y`.

## Hard rules (per cross-repo CLAUDE.md § Accessibility)

1. **Locked to WCAG 2.1 AA tags** (`wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`).
   Don't silently bump to 2.2 or AAA without a decisions-log entry.
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

## Healthcare clients

If brikdesigns ever hosts a healthcare client surface, the elevated rules
in `@brikdesigns/bds/content-system/compliance/healthcare-ada.md` apply on
top of the base WCAG 2.1 AA gate. Today, brikdesigns.com is general-business
marketing, so base AA is the standard.
