'use client';

import { ServiceBadge } from '@bds/components/ui/ServiceBadge/ServiceBadge';
import type { ServiceCategory } from '@bds/components/ui/ServiceBadge/ServiceBadge';

interface ServiceBadgeLabelProps {
  category: ServiceCategory;
  serviceName?: string;
}

/**
 * Thin client wrapper around BDS ServiceBadge for use in server components.
 * Renders the badge in "badge" mode (icon on colored background).
 */
export function ServiceBadgeLabel({ category, serviceName }: ServiceBadgeLabelProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--gap-sm)' }}>
      <ServiceBadge category={category} size="lg" serviceName={serviceName} />
      <ServiceBadge category={category} mode="label" size="md" />
    </div>
  );
}
