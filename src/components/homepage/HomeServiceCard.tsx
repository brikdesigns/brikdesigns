'use client';

import Image from 'next/image';
import { ServiceBadge } from '@brikdesigns/bds';
import { LinkButton } from '@brikdesigns/bds';
import type { ServiceCategory } from '@brikdesigns/bds';
import { text, heading } from '@/lib/styles';
import { color } from '@/lib/tokens';

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
    <div className="card-bordered card-bordered--centered">
      {/* Webflow: .img-frame-service.accent */}
      <div className="img-frame">
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
          <h3 style={heading.sm}>{name}</h3>
          <p style={{ ...text.bodyLg, color: color.text.secondary }}>{tagline}</p>
        </div>
      </div>

      <LinkButton href={`/services/${slug}`} variant="primary" size="md">
        Learn more
      </LinkButton>
    </div>
  );
}
