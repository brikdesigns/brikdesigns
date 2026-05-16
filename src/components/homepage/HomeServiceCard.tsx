'use client';

import Image from 'next/image';
import { Card, ServiceTag, LinkButton } from '@brikdesigns/bds';
import type { ServiceCategory } from '@brikdesigns/bds';

interface HomeServiceCardProps {
  name: string;
  slug: string;
  category: ServiceCategory;
  tagline: string;
  imageUrl?: string | null;
}

export function HomeServiceCard({ name, slug, category, tagline, imageUrl }: HomeServiceCardProps) {
  return (
    <Card
      preset="display"
      image={
        imageUrl ? (
          <div style={{ position: 'relative', width: '100%', aspectRatio: '1 / 1' }}>
            <Image src={imageUrl} alt={name} fill style={{ objectFit: 'cover' }} />
          </div>
        ) : (
          <div style={{
            width: '100%',
            aspectRatio: '1 / 1',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'var(--surface-secondary)',
          }}>
            <ServiceTag category={category} variant="icon" size="lg" />
          </div>
        )
      }
      tag={<ServiceTag category={category} variant="icon" size="md" />}
      title={name}
      description={tagline}
      action={
        <LinkButton href={`/services/${slug}`} variant="primary" size="md">
          Learn more
        </LinkButton>
      }
    />
  );
}
