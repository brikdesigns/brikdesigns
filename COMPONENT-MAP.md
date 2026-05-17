# brikdesigns Component Map

**Rule: NEVER write custom CSS for something BDS already provides.**
Check this file BEFORE building any section.

## Layout Components

| Pattern | BDS Component | Import | Example |
|---------|---------------|--------|---------|
| Multi-col responsive grid | `Grid` | `@brikdesigns/bds` | `<Grid columns="auto-fit" minColumnWidth="360px" gap="md">` |
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

## Pre-Build Checklist

Before writing ANY new CSS class:
1. Is there a BDS component for this? → Use it
2. Is it a multi-col grid? → Use `<Grid>`. Is it a flex row/column? → Use `<Stack>`. Both from `@brikdesigns/bds`.
3. Is it a layout wrapper/button row? → Use `.button-wrapper`, `.content-wrapper` from shared-sections.css
4. Only if none of the above → Write section-specific CSS
