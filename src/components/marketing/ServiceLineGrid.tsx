'use client';

import Link from 'next/link';
import { Card } from '@bds/components/ui/Card/Card';
import { ServiceBadge } from '@bds/components/ui/ServiceBadge/ServiceBadge';
import { Button } from '@bds/components/ui/Button/Button';

type ServiceCategory = 'brand' | 'marketing' | 'information' | 'product' | 'service';

interface ServiceLine {
  name: string;
  slug: string;
  category: ServiceCategory;
  tagline: string;
}

export function ServiceLineGrid({ items }: { items: ServiceLine[] }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
        gap: 'var(--gap-lg)',
      }}
    >
      {items.map((line) => (
        <Card key={line.slug} variant="outlined" padding="lg">
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--gap-lg)',
              height: '100%',
              alignItems: 'flex-start',
              textAlign: 'left',
            }}
          >
            <ServiceBadge category={line.category} mode="badge" size="lg" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap-md)' }}>
              <h3
                style={{
                  fontFamily: 'var(--font-family-heading)',
                  fontSize: 'var(--heading-sm)',
                  fontWeight: 'var(--font-weight-bold)',
                  lineHeight: 'var(--font-line-height-snug)',
                  color: 'var(--text-primary)',
                  margin: 0,
                }}
              >
                {line.name}
              </h3>
              <p
                style={{
                  fontFamily: 'var(--font-family-body)',
                  fontSize: 'var(--body-sm)',
                  fontWeight: 'var(--font-weight-regular)',
                  lineHeight: 'var(--font-line-height-normal)',
                  color: 'var(--text-secondary)',
                  margin: 0,
                }}
              >
                {line.tagline}
              </p>
            </div>
            <div style={{ marginTop: 'auto', paddingTop: 'var(--gap-md)' }}>
              <Link href={`/services/${line.slug}`}>
                <Button variant="ghost" size="sm">
                  Learn more
                </Button>
              </Link>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
