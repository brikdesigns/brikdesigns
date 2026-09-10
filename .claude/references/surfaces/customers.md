# Surface — `/customers`

**last-verified:** 2026-09-10 · **source:** `src/app/(marketing)/customers/page.tsx` · **class floor:** `class:component`

The industries index. `/customers/[slug]` is the industry detail (e.g. `/customers/dental`) — a
different file.

## Stylesheets

| Import | Owns | Note |
|---|---|---|
| `../shared-sections.css` | `.page-hero`, `.page-section`, `.page-section--accent`, `.page-section--secondary`, `.service-surface`, `.container-lg`, `.cta-section-brand` / `.cta-card-brand`, card-chrome-by-band | sitewide |
| `./customers.css` | `.industry-know-card*`, `.customers-segments`, `.segment-card*`, `.customers-segment-list*`, `.industries-cms-card`, `.challenge-card*`, `.illustration-media-bg` | layout only |

## Sections, in render order

None carry a stable id; `section-id-baseline.json` grandfathers **6** for this file — the joint
largest count in the repo alongside `/blog/[slug]`.
→ [`section-identification.md`](../section-identification.md)

| # | Element / class | Band surface | Card chrome | BDS / local in use |
|---|---|---|---|---|
| 1 | `section.page-hero` | `--surface-primary` | — | `ScrollDownCta`* |
| 2 | `section.page-section.page-section--accent` | `--surface-accent` tan | **shadow, no border** — tinted-band list (`shared-sections.css:841`) | `SectionHeader`, `Grid columns={3}`, `Card variant="elevated"` ⚠ |
| 3 | `section.page-section.page-section--secondary` | `--surface-secondary` | **shadow, no border** — tinted-band list (`shared-sections.css:840`) | `Icon` (`ph:check-bold`) |
| 4 | `section.page-section` — **conditional** on the CMS list | `--surface-primary` | untinted → cards keep border, 3px (`shared-sections.css:859`) | `Grid columns={4}`, `Frame ratio="square"`, `Card` |
| 5 | `section.page-section.page-section--secondary` | `--surface-secondary` | **shadow, no border** — tinted-band list | `Grid columns={2}`, `Card className="challenge-card service-surface"` |
| 6 | `section.cta-section-brand` > `.cta-card-brand` | brand panel, shared and reused | — | `SectionHeader`, `Button` / `LinkButton` |

\* local component, not BDS.

**Section 5 puts `.service-surface` on the Card, not the Section.** Everywhere else in the repo
(`/plans` §3, `/services` §3–4) `.service-surface` is a Section-layer band class. Here it is used as
a Container-layer fill. Both reach the same chrome rule (`shared-sections.css:842`), so it works —
but the class name reads as a band and is not one on this page. Identify by layer, not by name.
→ [`page-anatomy.md`](../page-anatomy.md)

## ⚠ Section 2 carries `variant="elevated"` — non-conforming, currently harmless

[`card-treatment.md:50`](../card-treatment.md) says do **not** set `variant="raised"` or
`variant="elevated"`; chrome comes from the band's luminance. `page.tsx:107` sets it anyway.

Statically verified this session: `.industry-know-card` in `customers.css:7-12` carries **no** chrome
override (flex layout only), and the section sits on `.page-section--accent`, whose band rule sets
`border: none; box-shadow: var(--box-shadow-md)` at specificity (0,3,0) — which
[`card-treatment.md:73-75`](../card-treatment.md) states beats any BDS variant border without
`!important`. So the rendered chrome agrees with the band rule and the prop is redundant.
`/customers` is in `tests/a11y/card-treatment.spec.ts`'s route list; that gate was **not re-run this
session**, so treat "renders correctly today" as gate-covered rather than as re-measured here.

**Why it still matters:** if that section ever moves to a white band, the variant forces elevation
where the band rule wants a border — the exact drift that ran #360 → #558 → #799 → #970 for a year.
Drop the prop when touching this section; don't file a separate cleanup for it.

## Data

`revalidate = 86400` (24h) — the longest window of any marketing route (`/blog` is 600, most others
3600).

| Source | Feeds | Rule |
|---|---|---|
| `INDUSTRIES` (page-local) | section 2's 3 cards | literal array |
| `SEGMENTS` (page-local) | section 3 | literal array |
| `getIndustryPages()` | section 4's cards | CMS — the only Supabase read on this page |
| `CHALLENGES` (page-local) | section 5's 2 cards | literal array, each with its own `quoteMark` colour |

**`Grid columns={4}` in section 4 is fed by the CMS row count.** An unpublished industry page drops
it to 3 in a 4-column rule — the exact failure #1004 shipped on the nav. Sections 2, 3 and 5 are fed
by page-local literals, so their counts move only when the file does.
→ [`page-anatomy.md`](../page-anatomy.md) § collection counts · gated by `tests/a11y/grid-column-fit.spec.ts`

## Ratified constraints — do not undo these

| Constraint | Why | Evidence |
|---|---|---|
| Section 4 is conditional on the CMS list | no published industry pages → no band, rather than an empty 4-column grid | `page.tsx:169` |
| Section 4's illustrations use `Frame ratio="square" fit="contain"` with `.illustration-media-bg` | transparent illustration art needs a well to read against; `contain` not `cover` so the art is not cropped | `page.tsx:183` |
| Section 5's quote mark is `aria-hidden` and coloured per challenge | decorative typographic mark, not content | `page.tsx:218` |
| Section 3's list checks are `ph:check-bold` via `@/lib/icon`, `aria-hidden` | Phosphor through the bundled subset, per CLAUDE.md § ICONS | `page.tsx:148` |

## Governing references

- [`card-treatment.md`](../card-treatment.md) — four of six sections are tinted; the `variant="elevated"` trap above
- [`page-anatomy.md`](../page-anatomy.md) — `.service-surface` as a Container here, and the CMS collection count in section 4
- [`card-media.md`](../card-media.md) — section 4's `Frame` + illustration well
- [`service-data-sot.md`](../service-data-sot.md) — `getIndustryPages()`
- [`section-identification.md`](../section-identification.md) — 6 grandfathered
- [`image-optimization.md`](../image-optimization.md) — CMS illustration budgets
