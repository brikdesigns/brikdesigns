# Surface — `/value`

**last-verified:** 2026-09-10 · **source:** `src/app/(marketing)/value/page.tsx` · **class floor:** `class:component`

"Why Design? In 4 steps" — a long-scroll editorial page. **The most structurally isolated surface in
the repo.** It shares no section vocabulary, no band classes, and no card rules with any other page.
Do not carry assumptions here from `/plans`, `/about`, or the home.

## Stylesheets

| Import | Owns | Note |
|---|---|---|
| `./value.css` | **everything** — `.vband`, `.vband__inner`, 8 `.vband--*` colour variants, `.value-*` blocks | |

**There is no `../shared-sections.css` import.** So none of the sitewide rules reach this page: not
`.page-section`, not `.container-lg`, and **not the card-chrome-by-band rule**. A card added here
would get no band-derived chrome, because the selector chain that supplies it is not in this route's
bundle. → [`marketing-section-reuse.md`](../marketing-section-reuse.md) (CSS is bundled per route)

## Sections — 18, all identified

Every section carries `data-section`; four also carry an `id` (`value-01`…`value-04`) as in-page
anchor targets for the pillar nav. No entry in `scripts/section-id-baseline.json`.

The page is a repeating pillar pattern, not 18 unique sections:

| Group | Sections | Pattern |
|---|---|---|
| Opening | `hero`, `pillar-nav`, `editorial`, `transition` | title → 4-tile nav → editorial lines → transition |
| Pillar 01 | `pillar-01-title` (`#value-01`), `pillar-01-callout`, `pillar-01-stats` | title / big-number callout / stat band |
| Pillar 02 | `pillar-02-title` (`#value-02`), `pillar-02-intro`, `pillar-02-stats` | title / intro prose / stat band |
| Pillar 03 | `pillar-03-title` (`#value-03`), `pillar-03-intro`, `pillar-03-stats` | same |
| Pillar 04 | `pillar-04-title` (`#value-04`), `pillar-04-intro`, `pillar-04-stats` | same |
| Closing | `pre-cta`, `cta` | |

Pillar 01 uses a **callout** where 02–04 use an **intro** — that asymmetry is in the design, not a
gap to normalise.

## Bands — a bespoke 8-colour set

`vband--coral` ×5 · `vband--gold` ×4 · `vband--blue` ×2 · `vband--lavender` ×2 · `vband--pink` ×2 ·
`vband--green` ×1 · `vband--dark-green` ×1 · `vband--salmon` ×1 (`value.css:60-91`)

These are page-local band classes, **not** the sitewide `--surface-*` band vocabulary and not
service tints. Adding a colour means adding a `.vband--*` rule here; it does not come from
`shared-sections.css` and it is not a token-family choice.
→ [`service-token-decision-tree.md`](../service-token-decision-tree.md) explains what *isn't* in play here

## Motion

Every section wraps its content in `<Reveal className="vband__inner">`, and inner elements carry
`.rise`. Scroll-reveal is the page's core behaviour, applied uniformly — 18 of 18 sections.
→ [`band-animation.md`](../band-animation.md)

## Data

None. No CMS read, no Supabase, **no `revalidate` export**. All copy, all statistics, and the eight
inline SVG icons (`Glasses`, `PieChart`, `Presentation`, `Briefcase`, `Timer`, `Eye`, `Crown`) are
hard-coded in the file. `CARDS` (`page.tsx:77`) drives the four pillar-nav tiles.

The icons are **inline SVG components**, not `ph:*` via `@/lib/icon`. Unlike `/how-we-work`, which
states its reason in the file, no reason is recorded here — see below.

## ⚠ Unsourced third-party statistics

The stat bands assert checkable claims about the world — `75%`, `42%`, `50%`, `0.05 seconds`
(`page.tsx:158-180`) and more in pillars 02–04. **No source is cited anywhere in the file:**

```
$ rg -in 'source|cite|citation|study|according|http' 'src/app/(marketing)/value/page.tsx'
$ echo $?
1
```

This is public marketing copy making numeric claims with no provenance. Recording it here, not
fixing it: sourcing or removing them is a content decision for the operator, and inventing a
citation would be worse than the gap. If you touch this copy, do not restate a number you cannot
source, and do not add a source you have not read.

## Known inconsistencies (not ratified constraints)

| Observation | Why it matters |
|---|---|
| Icons are inline SVG with **no stated reason** | CLAUDE.md § ICONS routes glyphs to `ph:*` via `@/lib/icon`. `/how-we-work` takes the same exception but records why (`page.tsx:25-26` there); this page does not. Reads as an omission, not a decision — verify before matching either side |
| No `shared-sections.css` import | intentional-looking (the page has its own vocabulary) but nowhere stated. Treat the isolation as load-bearing until a ticket says otherwise |
| `value-card` is grandfathered in `card-class-baseline.json` | "a numbered pillar tile … no card chrome to inherit; the colored fill IS the affordance" — so the `*-card` name is allowed here by an explicit reasoned entry |

## Governing references

- [`marketing-section-reuse.md`](../marketing-section-reuse.md) — why a class here resolves only here
- [`band-animation.md`](../band-animation.md) — the `Reveal` / `.rise` pattern on all 18 sections
- [`section-identification.md`](../section-identification.md) — 18 of 18 identified, no baseline entry
- [`naming-conventions.md`](../naming-conventions.md) — `__title` / `__subtitle` / `__description` used throughout
- [`card-treatment.md`](../card-treatment.md) — for what does **not** apply: the band rule is absent from this bundle
