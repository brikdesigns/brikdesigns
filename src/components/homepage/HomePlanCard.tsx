'use client';

import Image from 'next/image';
import { Card, Badge, LinkButton } from '@brikdesigns/bds';

interface HomePlanCardProps {
  name: string;
  slug: string;
  price: string;
  description: string;
  imageUrl?: string | null;
}

export function HomePlanCard({ name, slug, price, description, imageUrl }: HomePlanCardProps) {
  return (
    <Card
      preset="display"
      image={
        imageUrl ? (
          <div style={{ position: 'relative', width: '100%', aspectRatio: '4 / 3' }}>
            <Image src={imageUrl} alt={name} fill style={{ objectFit: 'cover' }} />
          </div>
        ) : undefined
      }
      tag={<Badge status="info" size="sm">{price}</Badge>}
      title={name}
      description={description}
      action={
        <LinkButton href={`/plans/${slug}`} variant="primary" size="md">
          Learn More
        </LinkButton>
      }
    />
  );
}
