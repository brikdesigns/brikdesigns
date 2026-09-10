# Surface — `/about`

**last-verified:** 2026-09-10 · **source:** `src/app/(marketing)/about/page.tsx` · **class floor:** `class:component`

What this page is built from. Read this before changing a section here. It cites the
cross-cutting canon rather than restating it.

## Stylesheets (import order matters)

| Import | Owns | Note |
|---|---|---|
| `../shared-sections.css` | `.page-hero`, `.page-section`, `.page-section--accent`, `.container-lg`, `.cta-section-brand` / `.cta-card-brand`, card-chrome-by-band | sitewide |
| `./about.css` | layout only — hero container + decorative block placement, `about-why__inner`, `about-hww__blocks`, `about-believe__inner`, CTA type | no `../homepage.css` import; this page shares no home scaffolding |

## Sections, in render order

All six carry `data-section`; five also carry `aria-labelledby` (every section with a heading
`id`). This file has **no** entry in `scripts/section-id-baseline.json`, so a new un-identified
section fails the gate.

| # | id | Element / class | Band surface | Card chrome | BDS / local in use |
|---|---|---|---|---|---|
| 1 | `hero` | `section.page-hero.about-hero` | `--surface-primary` (`shared-sections.css:15-17`) | — | `BrikBlocks` ×2, `ScrollDownCta` |
| 2 | `team` | `section.page-section.about-team` | `--surface-primary` (shared default) | untinted band → cards keep border, 3px per `shared-sections.css:859` | `TeamMember` ×`TEAM` |
| 3 | `why-brik` | `section.page-section.about-why` + `aria-labelledby` | `--surface-primary` | — | `next/image`, `BrikBlocks` |
| 4 | `how-we-work` | `section.page-section.about-hww` + `aria-labelledby` | `--surface-primary` | — | `BrikBlocks` per block |
| 5 | `believe` | `section.page-section.page-section--accent.about-believe` + `aria-labelledby` | `--surface-accent` tan (`shared-sections.css:80-82`) | **shadow, no border** — `.page-section--accent` is on the tinted-band list (`shared-sections.css:841`) | `Accordion` |
| 6 | `cta` | `section.cta-section-brand.about-cta` > `.cta-card-brand` | brand panel, shared and reused | — | `Button variant="on-color"` |

Section 5 is the only tinted band on this page — it is the one place where card chrome flips.
→ [`card-treatment.md`](../card-treatment.md)

## Data

All page-local constants; no CMS, no Supabase read. `revalidate = 3600` is inherited boilerplate.

| Source | Feeds | Shape |
|---|---|---|
| `TEAM` (`@/lib/team`) | section 2 | one `TeamMember` per entry, `orientation="horizontal"` |
| `WHY_BRIK` (page-local) | section 3 | array of paragraph strings — **prose**, see constraints |
| `HOW_WE_WORK` (page-local) | section 4 | `{ title, body }` ×2 |
| `BELIEFS` (page-local) | section 5 | `{ id, title, body }` ×4 → `Accordion items` |

Section 2's card count is `TEAM.length` and section 4's block count is `HOW_WE_WORK.length`;
neither sits in a `repeat(N, …)` grid, so a count change here is safe from the collection-count
trap that bites the grid sections elsewhere. → [`page-anatomy.md`](../page-anatomy.md) § collection counts

## Ratified constraints — do not undo these

| Constraint | Why | Evidence |
|---|---|---|
| `BRIKDOWN_HREF` is `/offers/brikdown` | OPERATOR SAID 2026-09-09 (chat), superseding the 2026-09-06 `/offers/brikdown-analysis` call. The sibling `/offers/free-marketing-analysis` is live but legacy | `page.tsx:22-26` |
| Section 3 renders as **prose**, never an accordion | an accordion is a misfit for a linear story, and the Figma prototype never called for one | `page.tsx:28-31`, #1245 |
| Section 5 **does** use `Accordion`, with the numbered index in the `action` slot | that is what the Figma frame draws; the slot shipped in BDS 0.185.0 | `page.tsx:161-165`, brik-bds#2285 |
| `BrikBlocks` marks are decorative and `aria-hidden` | positional brand marks, no meaning | `page.tsx:83-84` |
| Section 1's title emphasis is a `<span class="about-hero__em">`, not a heading split | one `h1` per page; the brand-colored word is inline | `page.tsx:87-89` |

Section 3's "prose, not accordion" and section 5's "accordion, correct" sit two sections apart and
look contradictory out of context. They are not: the rule is that the **shape of the content**
decides, not the page. → [`design-decisions`](https://design.brikdesigns.com/docs/build-standards) skill

## Governing references

- [`card-treatment.md`](../card-treatment.md) — section 5 is the tinted band; sections 2–4 are not
- [`page-anatomy.md`](../page-anatomy.md) — layer identification, text-group rhythm
- [`section-identification.md`](../section-identification.md) — all 6 identified, no baseline entry
- [`naming-conventions.md`](../naming-conventions.md) — `__title` / `__description`, never `__heading`; note this page uses `__intro` / `__story` / `__block` for structural wrappers, which the convention permits
- [`image-optimization.md`](../image-optimization.md) — section 3's `/images/brik_designs_4x.webp`
