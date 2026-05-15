'use client';

import Image from 'next/image';
import { ServiceTag } from '@brikdesigns/bds';
import { Button } from '@brikdesigns/bds';
import type { ServiceCategory } from '@brikdesigns/bds';

interface HomeServiceCardProps {
  name: string;
  slug: string;
  category: ServiceCategory;
  tagline: string;
  imageUrl?: string | null;
  /** Per-category brand color used to tint the "Learn more" CTA. Falls back to the BDS primary variant when undefined. */
  brandColorBase?: string | null;
}

/**
 * Homepage service line card — uses BDS CardDisplay pattern.
 * Webflow: .cms-item.stacked.border
 */
export function HomeServiceCard({ name, slug, category, tagline, imageUrl, brandColorBase }: HomeServiceCardProps) {
  return (
    <div className="service-card">
      {/* Webflow: .img-frame-service.accent */}
      <div className="service-card__image-frame">
        {imageUrl ? (
          <Image src={imageUrl} alt={name} width={400} height={400} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ServiceTag category={category} variant="icon" size="lg" />
          </div>
        )}
      </div>

      <div className="service-card__header">
        <ServiceTag category={category} variant="icon" size="md" />
        <div className="service-card__content">
          <h3 className="service-card__title">{name}</h3>
          <p className="service-card__description">{tagline}</p>
        </div>
      </div>

      <Button
        href={`/services/${slug}`}
        variant="primary"
        size="md"
        style={brandColorBase ? { backgroundColor: brandColorBase, borderColor: brandColorBase } : undefined}
      >
        Learn more
      </Button>
    </div>
  );
}
