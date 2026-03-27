'use client';

import Image from 'next/image';
import { LinkButton } from '@bds/components/ui/Button/LinkButton';

interface HomePlanCardProps {
  name: string;
  slug: string;
  price: string;
  description: string;
  imageUrl?: string | null;
}

/**
 * Homepage support plan card — Webflow: .cms-item.stacked
 * structure: image frame → price → name → description → CTA
 */
export function HomePlanCard({ name, slug, price, description, imageUrl }: HomePlanCardProps) {
  return (
    <div className="plan-card">
      <div className="plan-card__image-frame">
        {imageUrl ? (
          <Image src={imageUrl} alt={name} width={400} height={400} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <div style={{ width: '100%', height: '100%', backgroundColor: 'var(--surface-accent)' }} />
        )}
      </div>

      <div className="plan-card__content">
        <p className="plan-card__price">{price}</p>
        <h3 className="plan-card__name">{name}</h3>
        <p className="plan-card__description">{description}</p>
      </div>

      <LinkButton href={`/plans#${slug}`} variant="primary" size="md">
        Learn More
      </LinkButton>
    </div>
  );
}
