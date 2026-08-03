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

See also: [naming-conventions.md](./naming-conventions.md) (slot/role names), [card-chrome-on-tint.md](./card-chrome-on-tint.md) (Card surfaces on tinted Sections).