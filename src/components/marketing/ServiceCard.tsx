'use client';

import Link from 'next/link';
import Image from 'next/image';
import { ServiceBadge } from '@bds/components/ui/ServiceBadge/ServiceBadge';
import type { ServiceCategory } from '@bds/components/ui/ServiceBadge/ServiceBadge';
interface ServiceCardProps {
  name: string;
  slug: string;
  categorySlug: string;
  category: ServiceCategory;
  tagline?: string | null;
  imageUrl?: string | null;
  description?: string | null;
  showCta?: boolean;
}

/** Individual service card — badge icon + name + tagline, optionally with image and CTA */
export function ServiceCard({
  name, slug, categorySlug, category, tagline, imageUrl, description, showCta,
}: ServiceCardProps) {
  const href = `/services/${categorySlug}/${slug}`;
  const isRich = !!imageUrl;

  return (
    <Link href={href} className={`svc-card${isRich ? ' svc-card--rich' : ''}`}>
      {imageUrl && (
        <div className="svc-card__image">
          <Image src={imageUrl} alt={name} width={400} height={267} />
        </div>
      )}
      {!isRich && <ServiceBadge category={category} size="md" serviceName={name} />}
      <div className="svc-card__content">
        {isRich && <ServiceBadge category={category} size="sm" serviceName={name} />}
        <h3 className="text-heading-sm">{name}</h3>
        {tagline && <p className="text-body-sm text--secondary">{tagline}</p>}
        {description && <p className="text-body-sm text--secondary">{description}</p>}
        {showCta && (
          <span className="bds-button bds-button--primary bds-button--sm">Learn More</span>
        )}
      </div>
    </Link>
  );
}
