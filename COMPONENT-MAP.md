# brikdesigns Component Map

**Rule: NEVER write custom CSS for something BDS already provides.**
Check this file BEFORE building any section.

## Layout Components

| Pattern | BDS Component | Import | Example |
|---------|---------------|--------|---------|
| Multi-col responsive grid | `Grid` | `@brikdesigns/bds` | `<Grid columns={4} gap="lg">` or `<Grid columns="auto-fit" minColumnWidth="280px">` |
| Section with header + card grid | `CardGrid` (blueprint) | `@brikdesigns/bds` | `<CardGrid sectionKey="services" title="..."><Grid columns={3}>...</Grid></CardGrid>` |
| Flex row/column with gap | `Stack` | `@brikdesigns/bds` | `<Stack direction="horizontal" gap="lg" align="center">` |
| Image/media with aspect ratio | `Frame` | `@brikdesigns/bds` | `<Frame ratio="wide" fit="cover">` |
| Breadcrumb trail | `Breadcrumb` | `@brikdesigns/bds` | `<Breadcrumb items={[{label: 'Home', href: '/'}, {label: 'Page'}]} />` |

## Content & Interactive Components

| Webflow Pattern | BDS Component | Import | Example |
|----------------|---------------|--------|---------|
| Any button/CTA | `Button` / `LinkButton` | `@brikdesigns/bds` | `<Button href="/x" variant="primary" size="lg">Text</Button>` |
| Service line badge/icon | `ServiceTag` | `@brikdesigns/bds` | `<ServiceTag category="brand" variant="icon-text" label="Brand Design" size="sm" />` |
| Image card (image+title+desc+tag+CTA) | `Card preset="display"` | `@brikdesigns/bds` | `<Card preset="display" title="Name" description="..." image={<Frame ratio="square">...</Frame>} tag={<ServiceTag />} action={<Button>Go</Button>} />` |
| Card sub-components | `CardTitle` `CardDescription` `CardFooter` | `@brikdesigns/bds` | Used inside `<Card>` when not using `preset="display"` |
| Testimonial/quote card | `CardTestimonial` | `@brikdesigns/bds` | `<CardTestimonial quote="..." authorName="Nick" rating={5} />` |
| Pricing tier card | `PricingCard` | `@brikdesigns/bds` | `<PricingCard title="Pro" price="$49" features={[...]} highlighted />` |
| Generic bordered card | `Card variant="outlined"` | `@brikdesigns/bds` | `<Card variant="outlined" padding="md"><CardTitle>...</CardTitle></Card>` |
| Page header with metadata | `PageHeader` | `@brikdesigns/bds` | `<PageHeader title="Service" subtitle="..." />` |
| FAQ / collapsible content | `Accordion` | `@brikdesigns/bds` | `<Accordion items={[{id: '1', title: 'Q', content: 'A'}]} />` |
| Footer | `Footer` | `@brikdesigns/bds` | `<Footer logo={...} columns={[...]} copyright="2026 Brik" />` |
| Status pill/label | `Badge` | `@brikdesigns/bds` | `<Badge status="positive">Active</Badge>` |
| Inline text link | `TextLink` | `@brikdesigns/bds` | `<TextLink href="/about">Learn More</TextLink>` |
| Section divider | `Divider` | `@brikdesigns/bds` | `<Divider spacing="lg" />` |
| Announcement bar | `Banner` | `@brikdesigns/bds` | `<Banner title="New!" action={<TextLink>See</TextLink>} />` |

## Button Variants

All buttons at a given size share: same padding, same border-radius, same font-size, same font-weight.
Only color properties change per variant.

| Variant | Use for | Visual |
|---------|---------|--------|
| `primary` | Main CTA | Brand fill, white text |
| `on-color` | CTA on brand-color (orange) backgrounds | White fill, dark text |
| `inverse` | CTA on dark (near-black) backgrounds | White fill, dark text |
| `outline` | Secondary emphasis | Transparent, brand border |
| `secondary` | Tertiary/subtle | Surface fill, subtle |
| `ghost` | Minimal emphasis | No background |

Sizes: `sm`, `md`, `lg`, `xl`

## What is NOT in BDS (write section-specific CSS for these)

- Section backgrounds and min-heights
- Section-specific layouts (hero split, audit 2-col, customer story row, etc.)
- Container max-widths
- Animation/scroll effects
- CMS-specific data layouts

## CSS naming conventions

### Media-container frames — `[block]__media`

Image / illustration / video frames use the BEM element `__media`. The frame owns `aspect-ratio`, `overflow: hidden`, and `border-radius`; the inner `<img>` / `<Image>` inherits `object-fit` (apply via descendant selector when needed). Example:

```css
.svc-detail-hero__media {
  aspect-ratio: 1;
  overflow: hidden;
  border-radius: var(--border-radius-lg);
}
.svc-detail-hero__media img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}
```

Prefer BDS `<Frame ratio="…" fit="…">` for new sections (lives in [Layout Components](#layout-components) above). Hand-rolled `[block]__media` is the fallback for sections that need behaviour `<Frame>` doesn't yet cover — pinned by [brik-bds#486](https://github.com/brikdesigns/brik-bds/issues/486) (canonical aspect-ratio tokens) and [brik-bds#681](https://github.com/brikdesigns/brik-bds/issues/681) (Media category umbrella).

### Webflow-flat media names — resolved ([brikdesigns#197](https://github.com/brikdesigns/brikdesigns/issues/197))

The pre-BEM frame classes from the Webflow port have been renamed to `[block]__media`. Block names were taken from the actual parent block in the markup (a few earlier suggestions referenced blocks that didn't exist):

| File | Old class | New class |
|---|---|---|
| `src/app/homepage.css` | `.audit-image-frame` | `.audit__media` |
| `src/app/homepage.css` | `.story-image-frame` | `.section-story__media` (distinct from `customer-stories.css`'s `.story-card__media`) |
| `src/app/about/about.css` | `.about-value-image` | `.about-value-card__media` |
| `src/app/plans/plans.css` | `.plans-card-image` | `.plans-card-wrapper__media` |

Layout-column wrappers (`.audit-image`, `.story-image-wrapper`) were left as-is — they aren't media frames. `.about-service-image` no longer exists. `<Frame>` adoption + aspect-ratio tokens remain deferred to [brik-bds#486](https://github.com/brikdesigns/brik-bds/issues/486).

## Pre-Build Checklist

Before writing ANY new CSS class:
1. Is there a BDS component for this? → Use it
2. Is it a multi-col grid? → Use `<Grid>`. Is it a flex row/column? → Use `<Stack>`. Both from `@brikdesigns/bds`.
3. Is it a layout wrapper/button row? → Use `.button-wrapper`, `.content-wrapper` from shared-sections.css
4. Is it an image/illustration frame? → Use BDS `<Frame>` (or fall back to `[block]__media` per [CSS naming conventions](#css-naming-conventions))
5. Only if none of the above → Write section-specific CSS
