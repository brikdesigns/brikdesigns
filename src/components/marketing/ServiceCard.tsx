'use client';

import Link from 'next/link';
import { ServiceBadge } from '@bds/components/ui/ServiceBadge/ServiceBadge';
import type { ServiceCategory } from '@bds/components/ui/ServiceBadge/ServiceBadge';

interface ServiceCardProps {
  name: string;
  slug: string;
  categorySlug: string;
  category: ServiceCategory;
  tagline?: string | null;
}

export function ServiceCard({ name, slug, categorySlug, category, tagline }: ServiceCardProps) {
  return (
    <Link
      href={`/services/${categorySlug}/${slug}`}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 'var(--gap-md)',
        padding: 'var(--padding-lg)',
        backgroundColor: 'var(--surface-primary)',
        border: '1px solid var(--border-secondary)',
        borderRadius: 'var(--border-radius-md)',
        textDecoration: 'none',
        transition: 'border-color 0.15s',
      }}
    >
      <ServiceBadge category={category} size="md" serviceName={name} />
      <div>
        <h3 style={{ fontFamily: 'var(--font-family-heading)', fontSize: 'var(--heading-sm)', color: 'var(--text-primary)', margin: 0 }}>
          {name}
        </h3>
        {tagline && (
          <p style={{ fontFamily: 'var(--font-family-body)', fontSize: 'var(--body-sm)', color: 'var(--text-secondary)', marginTop: 'var(--gap-xs)', margin: 0 }}>
            {tagline}
          </p>
        )}
      </div>
    </Link>
  );
}
