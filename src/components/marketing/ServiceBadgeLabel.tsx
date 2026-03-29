'use client';

import { ServiceBadge } from '@bds/components/ui/ServiceBadge/ServiceBadge';
import { ServiceTag } from '@bds/components/ui/ServiceBadge/ServiceTag';
import type { ServiceCategory } from '@bds/components/ui/ServiceBadge/ServiceBadge';

interface ServiceBadgeLabelProps {
  category: ServiceCategory;
  serviceName?: string;
}

/**
 * Hero-scale service category display — large icon badge + text tag side by side.
 * Used in service category and service detail hero sections.
 */
export function ServiceBadgeLabel({ category, serviceName }: ServiceBadgeLabelProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--gap-sm)' }}>
      <ServiceBadge category={category} size="lg" serviceName={serviceName} />
      <ServiceTag category={category} size="md" />
    </div>
  );
}
