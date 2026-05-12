'use client';

import Link from 'next/link';
import Image from 'next/image';
import { ServiceTag } from '@brikdesigns/bds';
import { LinkButton } from '@brikdesigns/bds';
import { composeButtonClasses } from '@/lib/bds-button-classes';
import type { ServiceCategory } from '@brikdesigns/bds';
import { text, heading } from '@/lib/styles';
import { color, serviceColor } from '@/lib/tokens';

interface ServiceLineCardProps {
  name: string;
  slug: string;
  category: ServiceCategory;
  tagline: string;
  imageUrl?: string | null;
}

/** Service line card — ServiceTag is always shown as the primary visual */
export function ServiceLineCard({ name, slug, category, tagline, imageUrl }: ServiceLineCardProps) {
  // Audience-tinted CTA: canonical service-line text token (--text-service-*),
  // AA-pairs with white text. Replaces raw `cat.brand_color_base` hex
  // (brikdesigns#99).
  const ctaTint = serviceColor(category).text;
  return (
    <Link href={`/services/${slug}`} className="services-card">
      <div className="services-card__image">
        {imageUrl ? (
          <Image src={imageUrl} alt={name} width={400} height={400} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <ServiceTag category={category} variant="icon" size="lg" />
        )}
      </div>
      <div className="services-card__content">
        <ServiceTag category={category} variant="icon" size="md" />
        <h3 style={heading.sm}>{name}</h3>
        <p style={{ ...text.bodySm, color: color.text.secondary }}>{tagline}</p>
      </div>
      <span
        className={composeButtonClasses({ variant: 'primary', size: 'sm' })}
        style={{ backgroundColor: ctaTint, borderColor: ctaTint }}
      >
        Learn more
      </span>
    </Link>
  );
}

interface ServiceCalloutProps {
  name: string;
  slug: string;
  category: ServiceCategory;
  description: string;
  imageUrl?: string | null;
}

/** Side-by-side callout — ServiceTag + image for Product and Information design */
export function ServiceCallout({ name, slug, category, description, imageUrl }: ServiceCalloutProps) {
  const ctaTint = serviceColor(category).text;
  return (
    <div className="services-callout">
      <div className="services-callout__image">
        {imageUrl ? (
          <Image src={imageUrl} alt={name} width={600} height={600} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <ServiceTag category={category} variant="icon" size="lg" />
        )}
      </div>
      <div className="services-callout__content">
        <ServiceTag category={category} variant="icon" size="md" />
        <h2 style={heading.lg}>{name}</h2>
        <p style={{ ...text.body, color: color.text.primary }}>{description}</p>
        <LinkButton
          href={`/services/${slug}`}
          variant="primary"
          size="md"
          style={{ backgroundColor: ctaTint, borderColor: ctaTint }}
        >
          Learn more
        </LinkButton>
      </div>
    </div>
  );
}
