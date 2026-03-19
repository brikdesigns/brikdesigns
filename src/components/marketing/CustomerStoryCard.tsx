'use client';

import Link from 'next/link';
import { Card } from '@bds/components/ui/Card/Card';
import { Badge } from '@bds/components/ui/Badge/Badge';
import { Button } from '@bds/components/ui/Button/Button';

interface CustomerStoryCardProps {
  name: string;
  slug: string;
  clientName: string;
  shortDescription: string;
  industry?: string;
  heroImageUrl?: string;
}

export function CustomerStoryCard({
  name,
  slug,
  clientName,
  shortDescription,
  industry,
}: CustomerStoryCardProps) {
  return (
    <Card>
      <div style={{ padding: 'var(--padding-lg)', display: 'flex', flexDirection: 'column', gap: 'var(--gap-md)' }}>
        {industry && (
          <Badge status="info" size="sm">
            {industry}
          </Badge>
        )}
        <h3 style={{ fontFamily: 'var(--font-family-heading)', fontSize: 'var(--heading-sm)', color: 'var(--text-primary)', margin: 0 }}>
          {name}
        </h3>
        <p style={{ fontFamily: 'var(--font-family-label)', fontSize: 'var(--label-sm)', color: 'var(--text-brand-primary)', margin: 0 }}>
          {clientName}
        </p>
        <p style={{ fontFamily: 'var(--font-family-body)', fontSize: 'var(--body-sm)', color: 'var(--text-secondary)', margin: 0 }}>
          {shortDescription}
        </p>
        <Link href={`/customer-stories/${slug}`}>
          <Button variant="ghost" size="sm">
            Read Story
          </Button>
        </Link>
      </div>
    </Card>
  );
}
