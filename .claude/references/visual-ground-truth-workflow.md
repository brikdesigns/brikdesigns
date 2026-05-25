---
name: visual-ground-truth-workflow
description: Step-by-step protocol for agents reading live Webflow pages before writing any section code. Prevents CSS-from-memory failures. READ before building any page section.
---

# Visual Ground-Truth Workflow

**Rule: agents must read the live Webflow page before writing a single line of CSS or layout code.**

Every past layout failure in the brikdesigns rebuild came from agents guessing or improvising visual values. This workflow fixes that by making the live site the authoritative input.

---

## Step 1 — Read the live DOM with Playwright MCP

Before writing any section, use the `playwright` MCP server to inspect the target page.

```
playwright_navigate → https://www.brikdesigns.com/[page]
playwright_screenshot → full-page, save reference
playwright_evaluate →
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

The `playwright` MCP server is configured in `.claude/settings.json`. Available tools:

| Tool | What it does |
|------|-------------|
| `playwright_navigate` | Navigate to a URL |
| `playwright_screenshot` | Full-page screenshot |
| `playwright_evaluate` | Run JS in page context — returns computed styles, DOM structure |
| `playwright_get_visible_text` | Extract text content |
| `playwright_click` / `playwright_hover` | Trigger interactive states |

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

## What this prevents

| Past failure | How this workflow stops it |
|---|---|
| CSS from memory (wrong padding, wrong colors) | Step 1 gives exact computed values |
| Stale Webflow export (3 months old) | Always reading the live site |
| Interpreting screenshots instead of HTML | Step 1 reads DOM + computed styles, not pixels |
| Layout bugs found after PR merge | Step 3 diffs before opening PR |
| Multiple layout issues accumulating across sessions | One-section-per-PR gate at Step 4 |
