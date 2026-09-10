# Surface — `/terms`

**last-verified:** 2026-09-10 · **source:** `src/app/(marketing)/terms/page.tsx` · **class floor:** `class:content` (copy) / `class:component` (structure)

Website Terms and Conditions. Same shape as [`privacy-policy.md`](./privacy-policy.md) — a legal
document that shares nothing with the site's section vocabulary.

## Stylesheets

**None.** No `.css` import. Styles are inline object literals in the file (`containerStyle`,
`h1Style`, `linkStyle`, `metaStyle`, `backLinkStyle`) plus a file-local `Section` helper component.

## Sections

| # | id | Element | Band surface | Notes |
|---|---|---|---|---|
| 1 | **none** — 1 grandfathered | one `<article>` wrapping N local `<Section>` helpers | inherited page background | `<h1>Website Terms and Conditions</h1>` is a bare heading, not a `SectionHeader` |

`section-id-baseline.json` grandfathers **1** for this file.
→ [`section-identification.md`](../section-identification.md)

## Data

None. No CMS read, no `revalidate` export. Unlike `/privacy-policy` there is **no `LAST_UPDATED`
constant** — this page shows no effective date at all. If one is required, that is a content
decision for the operator, not something to invent.

Contact details are hard-coded in two places: `hello@brikdesigns.com` (`page.tsx:64`, `page.tsx:86`)
and `(561) 490-8714` / `tel:+15614908714` (`page.tsx:87`). The same phone number is hard-coded on
`/contact` (`page.tsx:77`). There is no single source for it.

## Known inconsistency (not a ratified constraint)

**20 raw `var(--…)` strings** in inline style objects, against CLAUDE.md § "When writing CSS or TSX
styles", and this file is not in `scripts/hardcoded-allowlist.txt` or
`scripts/tokens-allowlist.txt`. `node scripts/lint-tokens.mjs` passes because it checks invented
token *names*, not raw-`var()` usage. Pre-existing debt — don't add to it, don't refactor it here.

## When you change this page

- **Copy edits** are `class:content`.
- **Anything structural** escalates to `class:component` and raises the same open question as
  `/privacy-policy`: keep the inline-style world or move onto the shared vocabulary. Needs a ticket.
- Changing the phone number means grepping for it, not editing this file — it appears here and on
  `/contact`.

## Governing references

- [`change-class.md`](../change-class.md) — copy vs structure
- [`section-identification.md`](../section-identification.md) — 1 grandfathered
- Sibling surface: [`privacy-policy.md`](./privacy-policy.md) (linked from this page's footer)