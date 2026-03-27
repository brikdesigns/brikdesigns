'use client';

import Link from 'next/link';
import Image from 'next/image';
import { ServiceBadge } from '@bds/components/ui/ServiceBadge/ServiceBadge';
import { LinkButton } from '@bds/components/ui/Button/LinkButton';
import type { ServiceCategory } from '@bds/components/ui/ServiceBadge/ServiceBadge';

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
    <Link href={`/services/${slug}`} className="services-card">
      <div className="services-card__image">
        {imageUrl ? (
          <Image src={imageUrl} alt={name} width={400} height={400} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <ServiceBadge category={category} size="lg" />
        )}
      </div>
      <div className="services-card__content">
        <ServiceBadge category={category} size="md" />
        <h3 className="text-heading-sm">{name}</h3>
        <p className="text-body-sm text--secondary">{tagline}</p>
      </div>
      <span className="bds-button bds-button--primary bds-button--sm">Learn more</span>
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
        <h2 className="text-heading-lg">{name}</h2>
        <p className="text-body-md text--secondary">{description}</p>
        <LinkButton href={`/services/${slug}`} variant="primary" size="md">
          Learn more
        </LinkButton>
      </div>
    </div>
  );
}
