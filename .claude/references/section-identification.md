# Section Identification — make every marketing `<section>` addressable

**last-verified:** 2026-08-25

Hand-built marketing sections on this site carry generic utility classes
(`page-section`, `page-section service-surface`), not blueprint BEM block names.
On `/customers/[slug]` all three topic sections render as
`section.page-section.service-surface` — indistinguishable in devtools, so
"change the 2nd `section.page-section.service-surface`" was the only way to
reference one (brikdesigns#942).

## The convention

**Every top-level `<section>` in `src/app/(marketing)` carries a stable
identifier.** In priority order:

1. **`data-section="<key>"`** — the default. A short, stable, page-unique key
   describing the section's role: `data-section="hero"`, `data-section="cta"`,
   `data-section="other-industries"`. For a repeated/mapped section, derive the
   key from the loop's stable key, not its index:
   `data-section={`topic-${topic.topic_number}`}`.
2. **`aria-labelledby="<heading-id>`** — counts as an identifier too, when the
   section already has a single visible heading with a stable `id`. It doubles
   as an a11y win. Don't invent an `id` solely to satisfy this — reach for
   `data-section` instead.

### Why not blueprint BEM block names (`bds-hero`, `bds-cta`, …)?

The build standard
([page-structure](https://design.brikdesigns.com/docs/build-standards/page-structure))
describes sections as `<section>`s carrying a **BDS blueprint** block name. That
applies to sections rendered by a BDS blueprint component. These marketing
sections are **hand-built** — they are not BDS blueprints, and `page-section` is
a real, load-bearing CSS hook (`shared-sections.css`). Renaming them `bds-*`
would both lie about their origin and churn the CSS. `data-section` is additive:
it identifies without touching the class contract.

## The gate

`scripts/lint-section-id.mjs` (npm `lint:section-id`, pre-commit + `verify.yml`)
flags any top-level marketing `<section>` lacking an identifier.

It is a **ratchet against a per-file baseline**
(`scripts/section-id-baseline.json`), not a big-bang backfill:

- New un-identified `<section>` → file's count exceeds its baseline → **fail**.
- Convert a section (add an identifier) → count drops below baseline → **fail**
  until you lower that file's number in the baseline (keeps it from overstating
  the remaining debt).
- New files default to a baseline of `0` — they must ship identified.

Backfill existing pages going-forward, one file at a time: identify its
sections, drop its count in the baseline to `0`, remove the entry.

Escape hatch (rare — a genuinely un-addressable section such as a loading
skeleton): put `lint-section-id-ignore` in a comment inside the opening tag.

## Scope

Adopted for `src/app/(marketing)` (hand-built marketing sections). `/customers/[slug]`
is fully converted (baseline `0`); the other marketing pages are grandfathered
and paid down over time.

See also: [page-anatomy.md](./page-anatomy.md) (locate the *layer* to change),
[naming-conventions.md](./naming-conventions.md) (slot/role names).
