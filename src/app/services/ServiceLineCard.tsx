'use client';

import Link from 'next/link';
import Image from 'next/image';
import { ServiceBadge } from '@brikdesigns/bds';
import { LinkButton } from '@brikdesigns/bds';
import { composeButtonClasses } from '@/lib/bds-button-classes';
import type { ServiceCategory } from '@brikdesigns/bds';
import { text, heading } from '@/lib/styles';
import { color } from '@/lib/tokens';

interface ServiceLineCardProps {
  name: string;
  slug: string;
  category: ServiceCategory;
  tagline: string;
  imageUrl?: string | null;
}

/** Service line card — badge is always shown as the primary visual */
export function ServiceLineCard({ name, slug, category, tagline, imageUrl }: ServiceLineCardProps) {
  return (
    <Link href={`/services/${slug}`} className="card-bordered card-bordered--centered">
      <div className="img-frame">
        {imageUrl ? (
          <Image src={imageUrl} alt={name} width={400} height={400} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <ServiceBadge category={category} size="lg" />
        )}
      </div>
      <div className="stack stack--sm" style={{ width: '100%' }}>
        <ServiceBadge category={category} size="md" />
        <h3 style={heading.sm}>{name}</h3>
        <p style={{ ...text.bodySm, color: color.text.secondary }}>{tagline}</p>
      </div>
      <span className={composeButtonClasses({ variant: 'primary', size: 'sm' })}>Learn more</span>
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

/** Side-by-side callout — badge + image for Product and Information design */
export function ServiceCallout({ name, slug, category, description, imageUrl }: ServiceCalloutProps) {
  return (
    <div className="services-callout">
      <div className="services-callout__image">
        {imageUrl ? (
          <Image src={imageUrl} alt={name} width={600} height={600} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <ServiceBadge category={category} size="lg" />
        )}
      </div>
      <div className="services-callout__content">
        <ServiceBadge category={category} size="md" />
        <h2 style={heading.lg}>{name}</h2>
        <p style={{ ...text.body, color: color.text.secondary }}>{description}</p>
        <LinkButton href={`/services/${slug}`} variant="primary" size="md">
          Learn more
        </LinkButton>
      </div>
    </div>
  );
}
