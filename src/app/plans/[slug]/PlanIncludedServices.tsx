'use client';

import { useMemo, useState } from 'react';
import Image from 'next/image';
import {
  Card,
  CardGrid,
  Button,
  SegmentedControl,
  ServiceTag,
} from '@brikdesigns/bds';
import type { ServiceCategory } from '@brikdesigns/bds';
import { gap } from '@/lib/tokens';

// Category + icon resolution happen on the server (queries.ts pulls
// next/headers and can't be imported here); page.tsx pre-resolves both
// per service and passes them in.
export interface IncludedService {
  slug: string;
  name: string;
  description: string | null;
  image_url: string | null;
  service_lines: { slug: string; name: string } | null;
  category: ServiceCategory;
  hasIcon: boolean;
}

export function PlanIncludedServices({ services }: { services: IncludedService[] }) {
  const lines = useMemo(() => {
    const seen = new Map<string, { slug: string; name: string }>();
    for (const svc of services) {
      if (svc.service_lines && !seen.has(svc.service_lines.slug)) {
        seen.set(svc.service_lines.slug, svc.service_lines);
      }
    }
    return Array.from(seen.values());
  }, [services]);

  const [activeLine, setActiveLine] = useState<string>(lines[0]?.slug ?? '');

  const showSegments = lines.length > 1;
  const visibleServices = showSegments
    ? services.filter((s) => s.service_lines?.slug === activeLine)
    : services;

  return (
    <CardGrid sectionKey="what-you-get" title="What You Get">
      {showSegments && (
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: gap.xl }}>
          <SegmentedControl
            items={lines.map((l) => ({ label: l.name, value: l.slug }))}
            value={activeLine}
            onChange={setActiveLine}
            size="lg"
          />
        </div>
      )}
      <div className="plan-service-list">
        {visibleServices.map((svc) => {
          const lineSlug = svc.service_lines?.slug ?? '';
          return (
            <Card key={svc.slug} variant="outlined" padding="md">
              <div className="plan-service-list-item">
                {svc.image_url && (
                  <div className="plan-service-list-item__image">
                    <Image
                      src={svc.image_url}
                      alt={svc.name}
                      fill
                      sizes="96px"
                      style={{ objectFit: 'contain' }}
                    />
                  </div>
                )}
                <div className="plan-service-list-item__content">
                  <ServiceTag
                    category={svc.category}
                    {...(svc.hasIcon ? { serviceName: svc.name } : {})}
                    variant="icon-text"
                    label={svc.service_lines?.name ?? svc.name}
                    size="sm"
                  />
                  <h3 className="plan-service-list-item__title">{svc.name}</h3>
                  {svc.description && (
                    <p className="plan-service-list-item__description">{svc.description}</p>
                  )}
                  <div>
                    <Button
                      href={`/services/${lineSlug}/${svc.slug}`}
                      variant="primary"
                      size="sm"
                    >
                      Learn More
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </CardGrid>
  );
}
