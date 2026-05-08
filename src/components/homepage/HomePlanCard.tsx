'use client';

import Image from 'next/image';
import { LinkButton } from '@brikdesigns/bds';
import { text, heading } from '@/lib/styles';

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
    <div className="card-plain card-bordered--centered">
      <div className="img-frame">
        {imageUrl ? (
          <Image src={imageUrl} alt={name} width={400} height={400} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <div style={{ width: '100%', height: '100%', backgroundColor: 'var(--surface-accent)' }} />
        )}
      </div>

      <div className="plan-card__content">
        <p style={heading.lg}>{price}</p>
        <h3 style={heading.sm}>{name}</h3>
        <p style={text.bodySmall}>{description}</p>
      </div>

      <LinkButton href={`/plans#${slug}`} variant="primary" size="md">
        Learn More
      </LinkButton>
    </div>
  );
}
