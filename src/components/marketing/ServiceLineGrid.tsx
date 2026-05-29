'use client';

import Link from 'next/link';
import { Card } from '@brikdesigns/bds';
import { ServiceTag } from '@brikdesigns/bds';
import { Button } from '@brikdesigns/bds';
import type { ServiceLine } from '@brikdesigns/bds';
import { routeSlugForServiceLine } from '@/lib/service-line-routes';

interface ServiceLineItem {
  name: string;
  slug: string;
  category: ServiceLine;
  tagline: string;
}

export function ServiceLineGrid({ items }: { items: ServiceLineItem[] }) {
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
            <ServiceTag category={line.category} variant="icon" size="lg" />
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
              <Link href={`/services/${routeSlugForServiceLine(line.slug)}`}>
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
