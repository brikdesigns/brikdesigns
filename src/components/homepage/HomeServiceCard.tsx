'use client';

import Image from 'next/image';
import { ServiceBadge } from '@bds/components/ui/ServiceBadge/ServiceBadge';
import { LinkButton } from '@bds/components/ui/Button/LinkButton';
import type { ServiceCategory } from '@bds/components/ui/ServiceBadge/ServiceBadge';

interface HomeServiceCardProps {
  name: string;
  slug: string;
  category: ServiceCategory;
  tagline: string;
  imageUrl?: string | null;
}

/**
 * Homepage service line card — uses BDS CardDisplay pattern.
 * Webflow: .cms-item.stacked.border
 */
export function HomeServiceCard({ name, slug, category, tagline, imageUrl }: HomeServiceCardProps) {
  return (
    <div className="service-card">
      {/* Webflow: .img-frame-service.accent */}
      <div className="service-card__image-frame">
        {imageUrl ? (
          <Image src={imageUrl} alt={name} width={400} height={400} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ServiceBadge category={category} size="lg" />
          </div>
        )}
      </div>

      <div className="service-card__header">
        <ServiceBadge category={category} size="md" />
        <div className="service-card__content">
          <h3 className="service-card__title">{name}</h3>
          <p className="service-card__description">{tagline}</p>
        </div>
      </div>

      <LinkButton href={`/services/${slug}`} variant="primary" size="md">
        Learn more
      </LinkButton>
    </div>
  );
}
