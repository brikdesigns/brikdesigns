# Slot & Role Naming Conventions

Canonical reference for naming CSS classes, BEM slots, and TypeScript data-object properties that represent text roles on this site. Grounded in [design.brikdesigns.com/docs/primitives/naming-conventions](https://design.brikdesigns.com/docs/primitives/naming-conventions).

## Canonical slot names

| Slot | Purpose | Canonical CSS class |
|------|---------|---------------------|
| `__title` | Primary heading/identifying text | `.section__title`, `.hero-title` |
| `__subtitle` | Secondary line paired with the title | `.section__subtitle` |
| `__description` | Explanatory prose below the title | `.hero-description`, `.section-description` |
| `__label` | Text naming/identifying a discrete item | `.card__label` |
| `__content` | Container slot holding mixed child content | `.blog-card__content` |

## Banned names and their replacements

| Banned | Use instead | Why |
|--------|-------------|-----|
| `__heading` | `__title` | `heading` is a typography token scale, not a BEM role |
| `__headline` | `__title` | Same reason |
| `__subtext` | `__description` | Not a defined slot — invented alias for description |
| `__body` | `__description` (prose) or `__content` (container) | `body` is a typography token scale, not a slot |
| `eyebrow`, `kicker`, `overline`, `pre-title` | `__subtitle` | Marketing vocabulary — translate before coding |

## Typography tokens vs. slot names — the critical distinction

`heading` and `body` are **token scale names** (`--heading-lg`, `--body-md`, `--font-family-heading`). They describe visual size/weight, not semantic role.

```tsx
// CORRECT — `heading` as a token-scale import from styles.ts
import { heading } from '@/lib/styles';
<h2 style={heading.lg}>Section Title</h2>

// WRONG — `heading` as a CSS class or data-object key
<h2 className="section-heading">...</h2>
const data = { heading: 'Title', subheading: 'Subtitle' };

// CORRECT — canonical role names
<h2 className="section-title">...</h2>
const data = { title: 'Title', subtitle: 'Subtitle' };
```

## Heading scale by structural role

`heading.lg` and `heading.md` are token scales — pick by the heading's place in the document, not by eye. Canonical rule for `<h2>`:

- **Section heading** — heads a top-level page `<section>` → `heading.lg`. Examples: "Our Services", "The Value of Design", the service-page CTA.
- **Sub-head** — a form-panel title or in-article sub-heading nested *inside* a section → `heading.md`. Examples: "Send us a message" (contact form), "The Challenge / Results" (story body).

When in doubt: if the heading introduces a full page section it is `heading.lg`; if it labels a widget or block *within* a section it is `heading.md`. Standardized site-wide in #318.

## TypeScript data objects

When defining a local array or record that feeds into rendered text, use canonical role names as property keys:

```ts
// Wrong
const ITEMS = [{ heading: 'Card title', subheading: 'Secondary line' }];

// Correct
const ITEMS = [{ title: 'Card title', subtitle: 'Secondary line' }];
```

## BDS upstream exceptions (do not work around at call site)

The following BDS-typed interfaces currently use non-canonical names. These **cannot** be renamed in site call sites without breaking TypeScript. File a BDS issue when encountered instead of renaming locally.

| Interface | Non-canonical field | Canonical target | BDS issue |
|-----------|--------------------|--------------------|-----------|
| `FooterColumn` | `heading: string` | should be `title` | needs BDS PR |
| `BlueprintSection` | `heading: string \| null` | should be `title` | needs BDS PR |
| `BlueprintSection` | `subheading: string \| null` | should be `subtitle` | needs BDS PR |

## Single legitimate exception

`.bds-sheet-section__heading` — the BDS Sheet component uses `__heading` for sheet section labels (`<h3>`). This is a frozen legacy exception in BDS. Do **not** generalize it to new site classes.
