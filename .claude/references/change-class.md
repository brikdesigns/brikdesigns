# Change Class — pick the protocol weight a change earns

**last-verified:** 2026-09-08

Every change to this site pays the same intake → read → iterate → ratify → PR
ceremony regardless of risk. A 3-logo marquee data edit (#1266 — `home-tooling.ts`,
no CSS, no structure) ran ~2–4h. CI is not the cause — a prior fleet audit found
PR wall-clock ≤3.5 min because checks run in parallel; the cost is the *uniform*
protocol and the per-turn read-tax, not the gates.

`class:*` is a **7th orthogonal tagging axis** (alongside Type, Priority, Area,
Size, Severity, Theme — see brik-llm `issue-style.md` § Tagging axes). It names
the **change class**, which decides how much protocol a change earns. It is
distinct from Size (effort-hours) and Area (feature-set): a content edit on a
design-heavy page is `class:content`, `area:design`, `size:xs` all at once.

## The three classes

| Class | Label | What it covers |
|-------|-------|----------------|
| **Content** | `class:content` | Data, copy, assets, CMS rows only. No CSS, no section add/remove, no routing. |
| **Component** | `class:component` | Component CSS/props/tokens, or restructuring a **single** section on **one** page. No nav/IA. |
| **IA** | `class:ia` | Nav/routing/taxonomy, multi-section or multi-page structure, refactors >5 files. |

**Cardinality: exactly one `class:*` per issue** (like `size:*`). PRs inherit it
from the linked issue via `pr-task.sh`. Ticketless work (`--no-issue`) self-classifies
via the tree below.

## The decision tree

Evaluate **top-down; highest class that matches wins.** Check IA first, then
Component, then Content. The order encodes the safe default — a change that
touches both content and routing is `class:ia`, never `class:content`.

### 1. `class:ia` — if ANY of:
- Adds, removes, or reorders a route, page, nav, or meganav entry.
- Changes IA/taxonomy: `service_lines` slugs, URL structure, redirects, sitemap.
- Adds/removes/restructures sections across **more than one** page.
- Refactors shared layout or section scaffolding.
- Touches **more than 5 files** of structure/logic (assets don't count).

### 2. `class:component` — else if ANY of:
- Edits component CSS, `styles.ts`/`tokens` usage, or swaps a BDS component.
- Adds, removes, or restructures a **single** section on **one** page.
- Changes how many items a grid/list renders (a layout change — see
  [`page-anatomy.md`](page-anatomy.md) § collection counts).
- An image change that alters layout (aspect ratio, slot, media treatment).

### 3. `class:content` — else if ALL of:
- Touches only data (`src/lib/*.ts` data objects), copy strings, CMS/Supabase
  rows, or `public/` asset add/replace.
- **No** `.css` and **no** `styles.ts` edits.
- **No** section added/removed, **no** route/nav change.

**On doubt, escalate to the higher class.** The fast-path must never
under-protect a risky change; over-classifying only costs a little extra
protocol, under-classifying can ship a regression.

## Worked examples

| Change | Class | Why |
|--------|-------|-----|
| Add 3 logos to the tooling marquee (`home-tooling.ts` + `public/logos/`) | `class:content` | Data + assets only; no CSS, no structure. |
| Swap a section headline / body copy | `class:content` | Copy string only. |
| Restyle a `<Card>` border/shadow on one page | `class:component` | Component CSS. |
| Add a testimonials section to `/about` | `class:component` | Single section, one page. |
| Change a services grid from 3-up to 4-up | `class:component` | Layout/collection-count change. |
| Rename a `service_lines` slug + its route | `class:ia` | Taxonomy + routing. |
| Add a new top-level nav item + landing page | `class:ia` | Nav + route + new page. |
| Copy edit that also needs a **new** CSS class | `class:component` | Crosses the CSS line — escalate. |

## Out of scope for this axis
- **BDS version bumps** are not a content change — they carry their own freeze
  gate (`bds-unfreeze` label + `lint:bds-pin`). Class the *consuming* change, not
  the bump.
- **Secrets, infra, CI** changes route by `area:*` (`area:infra`, `area:security`),
  not by `class:*`.

## What the class selects (target protocol — not yet wired)

The per-class protocol (which references to read, which hooks run, which model)
is defined by the risk-tiered protocol ADR and is **not enforced yet** — this
file defines the axis and the classifier only. Intended shape:

| Class | Read before edit | Local iteration | Hooks |
|-------|------------------|-----------------|-------|
| `class:content` | none / this file | trust Netlify preview, skip local dev | diff-aware (skip CSS lints) |
| `class:component` | the relevant reference(s) | dev-restart loop | current stack |
| `class:ia` | full references + RAG | dev-restart loop | current stack + Opus |
