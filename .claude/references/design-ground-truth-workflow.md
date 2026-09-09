---
name: design-ground-truth-workflow
description: Protocol for choosing a section's ground truth (live page vs Figma spec) and reading it with the right tool before writing code. Prevents CSS-from-memory, the redesign browser-loop failure, AND building a section from a screenshot. READ before building any page section.
last-verified: 2026-09-09
---

# Design Ground-Truth Workflow

**First decide the work type — it decides where truth lives. Guessing the wrong one is what makes builds slow.**

| Work type | Ground truth | Playwright's role |
|---|---|---|
| **Reproducing an existing live page** (Webflow/legacy) | The **live page**. Steps 1–3 below. | Read computed values (Step 1); one final parity diff (Step 3). |
| **Redesign or DS-native new build** (Figma → BDS: this is now the default for new Astro/Next sites) | The **Figma spec + BDS tokens**. There is NO live page to converge on. | **One** final parity screenshot only. NOT a per-tweak `navigate`/`evaluate` loop. |

**The token rule (both types):** if the value you need is a token — a background, radius, gap, band rule — **grep the CSS**. Never open a browser to read a value that lives in the file you're editing (e.g. "does this match the Problem card bg?" is one grep of `homepage.css`, not a `browser_evaluate`).

**Why this branch exists:** the reproduction protocol below was built for pixel-faithful Webflow rebuilds, where the browser *is* the spec and the loop converges. Applied to a **redesign**, the live page isn't the spec, so the browser loop has nothing to converge on and degenerates into subjective live eyeballing — one `browser_evaluate` per taste call. For a redesign, transcribe the Figma spec to named tokens **once, up front**, build deterministically, and let the a11y gates (`card-treatment`, `band-animation`, `grid-column-fit`, `section-id`) verify — they already read computed values on every route.

---

## Figma protocol (redesign / DS-native work) — READ THE SPEC WITH A TOOL

The branch above tells you the Figma spec is the ground truth. This section tells you **how to read
it**, which is the part that was missing when brikdesigns#1287 rebuilt `/plans` (#1303).

**`get_design_context` is the design-read path.** Not `get_screenshot`.

```text
1. get_metadata      on the PAGE frame      → section node ids + names
2. get_design_context per SECTION node      → slot structure, every text string,
                                              bound token names, reference code
3. get_screenshot                           → corroboration ONLY, never the spec
```

**Load the guidance first.** `get_design_context` has a mandatory prerequisite skill —
`/figma-design-to-code`, or the MCP resource `skill://figma/figma-design-to-code/SKILL.md`. It carries
the G1–G5 gates, including **G5 asset fidelity**: *"never author, redraw, omit, or replace [an asset]
with a placeholder."* G5 is the gate that catches a dropped slot. Pass
`skillNames: "resource:figma-design-to-code"` when you loaded it as a resource.

**Per section node, never the page frame.** A page frame returns no useful per-slot detail. And a
whole-page screenshot is not a substitute at any resolution: `maxDimension` caps the **longer** edge,
so a 1440×4128 marketing frame requested at 1600 comes back **559×1600** — but the real problem is that
a raster carries no slot names and no token bindings, so anything you drop from it is invisible to
every downstream gate.

**The returned React + Tailwind is a REFERENCE, not code to paste.** Adapt it to this repo's stack, and
map every Figma variable to a real name in `dist/tokens.css` — the names are similar but not identical
(`text/service-brand-on-light` → `--text-service-brand-on-light`), and some have no code equivalent.
Run `validate-token-names` and **surface a gap rather than inventing a plausible name** (ADR-013).

Watch for mis-scoped names on the Figma side: node `26103:10991` paints a card *fill* with a variable
named `text/service-brand-on-dark`. Flag it and pick the correct surface token — don't replicate the
mistake into code.

Routing canon lives upstream in [`figma-workflow`](../../../brik-llm/.claude/skills/figma-workflow/SKILL.md)
(brikdesigns/brik-llm#3247).

### Placeholder content is a question, not a licence to drop the slot

A mockup often carries un-swapped placeholder values from the component it was instanced from. That
tells you the **value** isn't final. It never tells you the **slot** is absent.

If a slot's content is placeholder and you have no real content for it: **flag it and ask.** Never
render an invented value, and never quietly ship a card with fewer slots than the design.

> brikdesigns#1287 built `/plans` from one full-page Figma screenshot. All six cards in the mockup
> carried an identical `$750` and the same design-service lorem, so the agent read them as placeholder
> — correctly — then dropped the icon chip, price, period and button **slots** along with the values.
> The section shipped with 2 of 6 designed slots and every gate passed, because no gate compared the
> built page to the design. Fix: #1304.

---

## Reproduction protocol (live-page work only)

Every past layout failure in the brikdesigns Webflow rebuild came from agents guessing or improvising visual values. Steps 1–4 fix that by making the live site the authoritative input. **Skip this whole section for redesign / DS-native work** — use the Figma spec + tokens instead.

---

## Step 1 — Read the live DOM with Playwright MCP

Before writing any section, use the `playwright` MCP server to inspect the target page.

```
browser_navigate → https://www.brikdesigns.com/[page]
browser_take_screenshot → full-page, save reference
browser_evaluate →
  Array.from(document.querySelectorAll('[class*="section"], .section, section')).map(el => ({
    class: el.className,
    tag: el.tagName,
    computed: {
      padding: getComputedStyle(el).padding,
      margin: getComputedStyle(el).margin,
      background: getComputedStyle(el).backgroundColor,
      gap: getComputedStyle(el).gap,
      display: getComputedStyle(el).display,
      gridTemplateColumns: getComputedStyle(el).gridTemplateColumns,
      maxWidth: getComputedStyle(el).maxWidth,
    }
  }))
```

Extract exact values — pixel dimensions, hex colors, font sizes — from the `computedStyle` output. **Do not guess. Do not round.**

For individual elements (headings, cards, buttons):

```js
const el = document.querySelector('.your-target-class');
const s = getComputedStyle(el);
({
  fontSize: s.fontSize, fontWeight: s.fontWeight, lineHeight: s.lineHeight,
  color: s.color, padding: s.padding, borderRadius: s.borderRadius,
  letterSpacing: s.letterSpacing, textTransform: s.textTransform,
})
```

---

## Step 2 — Transcribe, don't interpret

Write down exact values before opening any editor:

```
Section: .hero-section
  padding: 120px 0px
  background: rgb(255, 255, 255)
  display: grid
  grid-template-columns: 1fr 1fr
  gap: 64px

Heading .hero__title
  font-size: 56px
  font-weight: 700
  line-height: 1.1
  color: rgb(17, 17, 17)
```

Map each Webflow class to the closest BDS component (see `COMPONENT-MAP.md`). Only write custom CSS for what BDS doesn't cover.

---

## Step 3 — Screenshot before/after

After building the section locally (`npm run dev`), take a second Playwright screenshot of your localhost and compare side-by-side against the reference from Step 1 before opening a PR.

Quick CLI check:
```bash
# Start dev server, then:
NETLIFY_URL=http://localhost:3000 npm run visual-parity
open tests/visual-parity/screenshots/index.html
```

The report now shows a third **Diff** column with pixel-level mismatch %. Target < 2% for any finished section. Red (> 5%) means something structural is wrong — don't open the PR.

---

## Step 4 — One section per PR

- One page section (hero, services grid, CTA, etc.) per PR.
- Visual gate before opening: diff % confirmed < 2% at desktop viewport.
- Human sign-off on the visual report before merge.

This is slower per PR but faster overall — rework drops dramatically.

---

## Playwright MCP quick reference

The `playwright` MCP server (`@playwright/mcp@latest`) is configured in `.claude/settings.json`. Tools are exposed with the `mcp__playwright__` prefix (e.g. `mcp__playwright__browser_navigate`). Available tools:

| Tool | What it does |
|------|-------------|
| `browser_navigate` | Navigate to a URL |
| `browser_take_screenshot` | Full-page screenshot |
| `browser_evaluate` | Run JS in page context — returns computed styles, DOM structure |
| `browser_snapshot` | Accessibility-tree snapshot (text + structure) |
| `browser_click` / `browser_hover` | Trigger interactive states |

**Common patterns:**

```js
// Get all text content for copy accuracy check
document.body.innerText

// Measure a specific element's box model
const r = document.querySelector('.hero').getBoundingClientRect();
({ width: r.width, height: r.height, top: r.top })

// Extract CSS custom property values used on an element
const s = getComputedStyle(document.querySelector('.section'));
['--surface-brand-default', '--text-primary', '--spacing-xl'].map(v => [v, s.getPropertyValue(v)])
```

---

## What this prevents (reproduction work)

| Past failure | How this workflow stops it |
|---|---|
| CSS from memory (wrong padding, wrong colors) | Step 1 gives exact computed values |
| Stale Webflow export (3 months old) | Always reading the live site |
| Interpreting screenshots instead of HTML | Step 1 reads DOM + computed styles, not pixels |
| Layout bugs found after PR merge | Step 3 diffs before opening PR |
| Multiple layout issues accumulating across sessions | One-section-per-PR gate at Step 4 |
