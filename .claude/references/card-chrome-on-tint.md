# Card chrome on a tinted surface — the two-tier standard

**Ratified:** 2026-06-21 (BACKLOG-336 / brikdesigns#558). Owner-approved.
**Implementation:** `src/app/(marketing)/shared-sections.css` — "Card chrome on a
tinted surface" block.

## The rule

A *tinted surface* is any band that is not the default page background:
- a service-line tint — `.service-surface` (`--surface-service-{line}-light`)
- `.page-section--secondary` (`--surface-secondary`)
- `.page-section--accent` (`--surface-accent`)

On a tinted surface, cards **drop the outlined gray border ring**. The
border ring reads as visual noise on a tint (the staging-review complaint behind
#333 / #367 / #368). Two treatments replace it, by card role:

| Card role | Treatment | Border | Shadow | Fill |
|---|---|---|---|---|
| Browse / listing **grid** (peers the user scans) | **flat** | none | none | `--surface-primary` |
| **Focal** decision card or **lone** feature card | **elevated** | none | `--box-shadow-md` | `--surface-primary` |

Both keep the **`--surface-primary` fill** — it is load-bearing for legibility on
the tint. **Never** use the BDS `borderless` variant here: it is transparent
(`background: transparent`), so the card would dissolve into the band.

The elevated tier generalizes the #427 precedent (a single row-card on a service
tint uses fill + shadow for containment, *not* borderless).

## Why two tiers (not "drop all borders → flat")

A flat grid of equivalent browse cards reads as one calm field — correct for
listings. A lone or focal card on a tint needs a shadow to feel *contained*
rather than floating; flattening it makes it look like a layout mistake. So the
axis is **role**, not component: grids of peers → flat; a card that is a focal
decision (pricing tiers) or the only card in its band (a single feature) →
elevated.

## Current consumers (#558)

- **Flat:** blog related-posts grid (`.page-section--accent .blog-card`).
  Scoped to the accent section because `.blog-card` also renders on the white
  blog index, where the outlined border is correct.
- **Elevated:** "Latest Customer Story" single card
  (`.page-section--secondary .story-card`).
- **Elevated:** service pricing tiers
  (`.service-surface .bds-pricing-card`). The featured tier
  (`--highlighted`) keeps its **brand-colored** ring as intentional emphasis —
  that is not the noisy gray border the standard removes — so the selector
  excludes it with `:not(.bds-pricing-card--highlighted)`.

## Specificity note

`.bds-card.<element-class>` (or `.service-surface .bds-pricing-card`) is a
two/three-class selector, so it beats the single-class BDS variant rule
(`.bds-card--outlined`, `.bds-pricing-card`) without `!important`.

## What this is NOT

- Not a token change. Card fills stay neutral `--surface-primary`; no card
  background references a service-line / page color token. (The service-line
  color lives on the **section band**, and — for CTAs — the
  `--background-brand-primary` cascade variable, never the card fill.)
- Not a default-surface rule. On the white page background, the BDS `outlined`
  default stands.
