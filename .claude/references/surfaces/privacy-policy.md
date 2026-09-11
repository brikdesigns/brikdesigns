# Surface — `/privacy-policy`

**last-verified:** 2026-09-10 · **source:** `src/app/(marketing)/privacy-policy/page.tsx` · **class floor:** `class:content` (copy) / `class:component` (structure)

A legal document, not a marketing surface. It shares **nothing** with the rest of the site's
section vocabulary — do not reach for `.page-section`, `SectionHeader`, or the shared bands here.

## Stylesheets

**None.** No `.css` import at all. Every style is an inline object literal in the file
(`containerStyle`, `h1Style`, `listStyle`, `linkStyle`, `metaStyle`, `backLinkStyle`) plus a local
`Section` helper component at the bottom of the file.

## Sections

| # | id | Element | Band surface | Notes |
|---|---|---|---|---|
| 1 | **none** — 1 grandfathered | one `<article>` wrapping N local `<Section>` helpers | inherited page background | the `<section>` elements come from the file-local `Section` component, not from the shared vocabulary |

`section-id-baseline.json` grandfathers **1** for this file.
→ [`section-identification.md`](../section-identification.md)

## Data

None. No CMS read, no Supabase, and **no `revalidate` export** — the content is a hard-coded
document. `LAST_UPDATED = '2026-05-07'` (`page.tsx:11`) is a page-local constant and is the only
date shown to visitors; it does not update itself.

## Known inconsistency (not a ratified constraint)

The page carries **23 raw `var(--…)` strings** in inline style objects. CLAUDE.md § "When writing
CSS or TSX styles" requires tokens to come from `@/lib/tokens` / `@/lib/styles` with no raw
`var(--…)` strings, and this file is **not** in `scripts/hardcoded-allowlist.txt` or
`scripts/tokens-allowlist.txt`. `node scripts/lint-tokens.mjs` passes (159 files, clean) because it
checks for *invented* token names, not raw-`var()` usage — so nothing gates this.

Treat it as pre-existing debt, not permission. Don't add more; don't refactor it as a side quest
either. `/terms` has the same shape (20 occurrences).

## When you change this page

- **Copy edits** are `class:content` — no CSS, no structure. Bump `LAST_UPDATED` in the same change
  if the substance of the policy changed, and leave it alone if it did not.
- **Anything structural** escalates to `class:component`, and the honest first question is whether
  this page should keep its own inline-style world or move onto the shared vocabulary. That is a
  decision, not a cleanup — it needs a ticket.

## Governing references

- [`change-class.md`](../change-class.md) — copy vs structure on this page
- [`section-identification.md`](../section-identification.md) — 1 grandfathered
- [`naming-conventions.md`](../naming-conventions.md) — applies if this page ever gets real classes
