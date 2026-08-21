'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Card, CardTitle, CardDescription, CardFooter, Stack, Frame, ServiceTag, Button } from '@brikdesigns/bds';
import { composeButtonClasses } from '@/lib/bds-button-classes';
import type { ServiceLine } from '@brikdesigns/bds';
import { text, heading } from '@/lib/styles';
import { color, serviceCtaVars } from '@/lib/tokens';
import { routeSlugForServiceLine } from '@/lib/service-line-routes';

interface ServiceLineCardProps {
  name: string;
  slug: string;
  category: ServiceLine;
  tagline: string;
  imageUrl?: string | null;
}

/** Service line card — ServiceTag is always shown as the primary visual.
 *
 * Card chrome (border / surface / hover affordance) comes from the BDS `Card`
 * primitive — same pattern as `ServiceCallout` below. The outer `<Link>`
 * preserves Next.js client-side navigation + prefetching (Card with `href`
 * would render a plain `<a>` and regress both).
 */
export function ServiceLineCard({ name, slug, category, tagline, imageUrl }: ServiceLineCardProps) {
  // Audience-tinted CTA — the canonical service-CTA pairing (brikdesigns#1001):
  // deep `onLight` fill + the BDS primary's default white label, under a
  // `service-themed` ancestor. Emitted via `serviceCtaVars` so every service CTA
  // shares one source (8.48–16.34:1 AA on all five lines, both themes).
  return (
    <Link href={`/services/${routeSlugForServiceLine(slug)}`} className="services-card-link">
      <Card variant="outlined" padding="md" interactive className="services-card service-themed">
        <div className="services-card__media">
          {imageUrl ? (
            <Image src={imageUrl} alt={name} width={400} height={400} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <ServiceTag category={category} variant="icon" size="lg" />
          )}
        </div>
        <div className="services-card__content">
          <ServiceTag category={category} variant="icon" size="lg" serviceName={name} />
          <h3 style={{ ...heading.card }}>{name}</h3>
          <p style={{ ...text.body, color: color.text.secondary }}>{tagline}</p>
        </div>
        <span
          className={composeButtonClasses({ variant: 'primary', size: 'md' })}
          style={serviceCtaVars(category)}
        >
          Learn more
        </span>
      </Card>
    </Link>
  );
}

interface ServiceCalloutProps {
  name: string;
  slug: string;
  category: ServiceLine;
  description: string;
  imageUrl?: string | null;
}

/** Row-card callout — image + content inside a single BDS Card. Used for the
 * Product and Information service lines on /services.
 *
 * Mirrors the Recommended Add-On pattern on service detail pages (#107):
 * `<Card padding="lg">` wraps a horizontal `<Stack>` with image-left + content-right.
 *
 * The Card sits on the section's `--surface-service-{slug}` tinted background;
 * the audience-tinted CTA (`--background-service-{audience}`) contrasts
 * against Card's `--surface-primary` instead of disappearing into the section
 * tint (#103). `variant="elevated"` supplies that `--surface-primary` fill +
 * shadow with no border — borderless left the card transparent on the tint,
 * which broke the #103 contrast intent (#427; regression from #360).
 */
export function ServiceCallout({ name, slug, category, description, imageUrl }: ServiceCalloutProps) {
  return (
    <Card variant="elevated" padding="lg" className="services-callout-card service-themed">
      <Stack direction="horizontal" gap="lg" align="center">
        <div className="services-callout-card__media">
          <Frame ratio="square" fit="cover">
            {imageUrl ? (
              <Image src={imageUrl} alt={name} width={600} height={600} />
            ) : (
              <ServiceTag category={category} variant="icon" size="lg" />
            )}
          </Frame>
        </div>
        <Stack direction="vertical" gap="sm" className="services-callout-card__content">
          <ServiceTag category={category} variant="icon" size="lg" />
          <CardTitle>{name}</CardTitle>
          <CardDescription>{description}</CardDescription>
          <CardFooter>
            <Button
              href={`/services/${routeSlugForServiceLine(slug)}`}
              variant="primary"
              size="md"
              style={serviceCtaVars(category)}
            >
              Learn more
            </Button>
          </CardFooter>
        </Stack>
      </Stack>
    </Card>
  );
}
