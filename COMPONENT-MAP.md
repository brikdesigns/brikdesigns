# brik-marketing Component Map

**Rule: NEVER write custom CSS for something BDS already provides.**
Check this file BEFORE building any section.

## Webflow Section → BDS Component

| Webflow Pattern | BDS Component | Import | Example |
|----------------|---------------|--------|---------|
| Any button/CTA | `LinkButton` / `Button` | `@bds/components/ui/Button` | `<LinkButton href="/x" variant="primary" size="lg">Text</LinkButton>` |
| Service badge icon | `ServiceBadge` | `@bds/components/ui/ServiceBadge` | `<ServiceBadge category="brand" size="sm" serviceName="Logo Design" />` |
| Feature card (icon + title + desc) | `CardFeature` | `@bds/components/ui/CardFeature` | `<CardFeature icon={<Icon />} title="Fast" description="..." />` |
| Blog/product card with image | `CardDisplay` | `@bds/components/ui/CardDisplay` | `<CardDisplay imageSrc="/img.jpg" title="Post" action={<LinkButton>Read</LinkButton>} />` |
| Testimonial/quote card | `CardTestimonial` | `@bds/components/ui/CardTestimonial` | `<CardTestimonial quote="..." authorName="Nick" rating={5} />` |
| Pricing tier card | `PricingCard` | `@bds/components/ui/PricingCard` | `<PricingCard title="Pro" price="$49" features={[...]} highlighted />` |
| Generic bordered card | `Card` (variant="outlined") | `@bds/components/ui/Card` | `<Card variant="outlined" padding="md"><CardTitle>...</CardTitle></Card>` |
| Page header with metadata | `PageHeader` | `@bds/components/ui/PageHeader` | `<PageHeader title="Service" subtitle="..." badge={<ServiceBadge />} />` |
| FAQ / collapsible content | `Accordion` | `@bds/components/ui/Accordion` | `<Accordion items={[{id: '1', title: 'Q', content: 'A'}]} />` |
| Footer | `Footer` | `@bds/components/ui/Footer` | `<Footer logo={...} columns={[...]} copyright="2026 Brik" />` |
| Status pill/label | `Badge` | `@bds/components/ui/Badge` | `<Badge status="positive">Active</Badge>` |
| Inline text link | `TextLink` | `@bds/components/ui/TextLink` | `<TextLink href="/about" iconAfter={<Arrow />}>Learn More</TextLink>` |
| Section divider | `Divider` | `@bds/components/ui/Divider` | `<Divider spacing="lg" />` |
| Announcement bar | `Banner` | `@bds/components/ui/Banner` | `<Banner title="New!" action={<TextLink>See</TextLink>} />` |

## Button Variants (MEMORIZE THIS)

All buttons at a given size share: same padding, same border-radius, same font-size, same font-weight.
Only color properties change per variant.

| Variant | Use for | Visual |
|---------|---------|--------|
| `primary` | Main CTA | Brand fill, white text |
| `inverse` | CTA on dark backgrounds | White fill, dark text |
| `outline` | Secondary emphasis | Transparent, brand border |
| `secondary` | Tertiary/subtle | Surface fill, subtle |
| `ghost` | Minimal emphasis | No background |

Sizes: `sm`, `md`, `lg`, `xl`

## What is NOT in BDS (write section-specific CSS for these)

- Section backgrounds and min-heights
- Section-specific layouts (hero grid, audit 2-col, etc.)
- Container max-widths
- Animation/scroll effects
- CMS-specific data layouts

## Pre-Build Checklist

Before writing ANY new CSS class:
1. Is there a BDS component for this? → Use it
2. Is it a layout wrapper? → Use `.button-wrapper`, `.content-wrapper` from shared-sections.css
3. Is it typography? → Use `.text-heading-lg`, `.text-body-md` etc. from shared-sections.css
4. Only if none of the above → Write section-specific CSS
