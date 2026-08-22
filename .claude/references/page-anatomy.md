# Page Anatomy — locate change targets by layer, not by selector name

Canonical source: **[Build Standards](https://design.brikdesigns.com/docs/build-standards)** — read [Page Structure](https://design.brikdesigns.com/docs/build-standards/page-structure) and [Composition Layers](https://design.brikdesigns.com/docs/build-standards/composition-layers) first. This file is the consumer-side application + the one antipattern that has bitten us; it does not restate the canon.

## The five layers (canonical)

A page is composed in five layers, each knowing only the layer below it:

| Layer | Role | Carries | Examples |
|-------|------|---------|----------|
| **Section** | Page role + surrounding structure | vertical rhythm, container, **page-role background surface** | `Hero`, `Content`, `CTA` — the `bp-*` / `bds-*` blueprint `<section>` |
| **Layout** | Pure composition primitive | nothing but structure | `Stack`, `Cluster`, `Grid`, `Split`, `Row` |
| **Container** | Styled, self-contained holder | border / padding / elevation / radius / **its own surface** | **`Card`**, `List`, `Form`, `Accordion` |
| **Block** | Composed content unit (slots + atoms) | a fixed slot shape | `ContentBlock`, `MediaBlock`, `Stat`, `FormField` |
| **Component** | Single primitive atom | one thing | `Button`, `Input`, `Image`, `Badge` |

Two different layers own a "background surface": the **Section** owns the *band/page-role* tint; a **Container (Card)** owns its *own bounded* surface. They are not interchangeable.

## The rule

**Locate the element to change by its layer/role in the page anatomy — read the DOM tree top-down (Section → Layout → Container → Block → Component) — never by selector-name resemblance.**

A BEM **block name** describes the blueprint family; it does **not** define the element's layer. `bds-hero--with-pricing-card` has "card" in the name but is a **Section** (`<section>`). The **Container/Card** is the nested `bds-hero__media-card` element. When a ticket says "card," it means the Container layer — the bounded thing — not the section whose block name happens to contain "card."

## Worked example — the one that bit us (BRIK-WEB-52 / #633, #637)

`HeroSplitImageCardOverlay` DOM:

```
section.bds-hero--with-pricing-card[data-audience]   ← SECTION  (page-role surface / band)
  div.bds-hero__container                             ← container div (layout)
    div.bds-hero__content                             ← Block: breadcrumb, h1, lead, CTA
    aside.bds-hero__media-card                        ← CONTAINER (Card)  ← "the card"
      div.bds-hero__image-frame > img                ← Block/Component
      div.bds-hero__price > label / value / Button   ← Block/Components
```

| Ticket said | Means (layer) | Element | Surface lever |
|---|---|---|---|
| "the card" | Container (Card) | `aside.bds-hero__media-card` | `--bds-hero-media-bg` (set via `serviceColor().inverse`) |
| NOT this | Section | `section.bds-hero--with-pricing-card[data-audience]` | the page-role band tint; kept `transparent` here (#408/#389) |

**WRONG** — removed the section's `transparent` override, repainting the whole **Section** with the inverse surface (reintroduced the two-tone seam #408/#389 deliberately removed):
```css
/* repaints the SECTION — wrong layer */
.page-hero-blueprint .bds-hero--with-pricing-card[data-audience] { background: /* inverse */ }
```

**RIGHT** — leave the Section transparent; route the surface to the **Container** via its hook, from the page's hero wrapper:
```tsx
// hero wrapper style — scopes the inverse to the card only
'--bds-hero-media-bg': serviceColor(audience).inverse,
```

## Before you change an element's surface/appearance

1. **Open the component's DOM tree** (the blueprint `.astro`/`.css`, or `browser_snapshot`) and name each node's layer. Don't infer from a selector that "looks right."
2. **Match the ticket's noun to a layer.** "card" → Container; "section/band/hero" → Section; "button/badge" → Component.
3. **Find the lever for that layer** — a Container usually exposes a `--*-card-bg`/`--*-bg` custom-property hook; prefer it over overriding a parent.
4. **Confirm against Figma** (the visual ground truth — [visual-ground-truth-workflow.md](./visual-ground-truth-workflow.md)) before building. The frame shows *which* box gets the surface.
5. **Distrust inherited comments + upstream code that conflate layers** — the prior `shared-sections.css` comment called the Section "the card," and BDS painted the Section; neither made the Section the card.

## When you change how many items a collection renders

**An item-count change is a Layout-layer change.** The Layout layer (`Grid`, `Split`, a `repeat(N, 1fr)` rule) is positioned by a *count*; the items are supplied by data. Those two live in different files, so "remove one card" reads as a one-file edit and isn't.

**The rule: a `repeat(N, …)` grid must render ≥ N children.** Fewer leaves a permanently empty trailing column — dead space no viewport width can fill.

Worked example (#1004 → #1008): filtering SaaS out of the nav dropped the industries panel to 3 cards while `.mega-nav__customers-grid` stayed `repeat(4, 1fr)`. It shipped. The same sweep found `.mega-nav__about-grid` and `.mega-nav__plans-grid` already wrong the same way — the plans rule's own comment said "3 cols … dropping the grid back to 3" while the value stayed 4.

So: when a CMS filter, unpublished row, or removed array entry changes the count, grep the container's layout rule **in the same change** — and read the whole container in the screenshot, not just the element you touched.

Gated by [`tests/a11y/grid-column-fit.spec.ts`](../../tests/a11y/grid-column-fit.spec.ts) (computed columns vs laid-out children, nav panels + main routes).

See also: [naming-conventions.md](./naming-conventions.md) (slot/role names).