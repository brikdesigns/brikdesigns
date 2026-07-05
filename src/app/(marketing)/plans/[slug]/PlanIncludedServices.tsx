'use client';

import { useMemo, useState } from 'react';
import Image from 'next/image';
import {
  Card,
  CardGrid,
  Frame,
  SegmentedControl,
  ServiceTag,
} from '@brikdesigns/bds';
import type { ServiceLine } from '@brikdesigns/bds';
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
  category: ServiceLine;
  hasIcon: boolean;
}

export function PlanIncludedServices({
  services,
  surfaceInverse,
}: {
  services: IncludedService[];
  /** Plan service-line `-inverse` surface (white in light / `{hue}-darkest` in
   *  dark) applied to the section band + the per-service cards. The cards keep
   *  their `outlined` border so they stay differentiated from the same-hue band
   *  in dark mode (per BRIK-WEB service-inverse direction). */
  surfaceInverse: string;
}) {
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
    <CardGrid
      sectionKey="what-you-get"
      title="What You Get"
      description="Here are a list of services you get when you sign up for monthly support"
      className="plan-what-you-get"
      style={{ backgroundColor: surfaceInverse }}
    >
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
          return (
            <Card
              key={svc.slug}
              variant="outlined"
              padding="md"
              style={{ backgroundColor: surfaceInverse }}
            >
              <div className="plan-service-list-item">
                {svc.image_url && (
                  <Frame
                    ratio="square"
                    fit="contain"
                    className="plan-service-list-item__media illustration-media-bg"
                  >
                    <Image
                      src={svc.image_url}
                      alt={svc.name}
                      fill
                      sizes="72px"
                      style={{ objectFit: 'contain' }}
                    />
                  </Frame>
                )}
                <div className="plan-service-list-item__content">
                  <div className="plan-service-list-item__header">
                    <h3 className="plan-service-list-item__title">{svc.name}</h3>
                    <ServiceTag
                      category={svc.category}
                      {...(svc.hasIcon ? { serviceName: svc.name } : {})}
                      variant="icon-text"
                      label={svc.service_lines?.name ?? svc.name}
                      size="sm"
                    />
                  </div>
                  {svc.description && (
                    <p className="plan-service-list-item__description">{svc.description}</p>
                  )}
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </CardGrid>
  );
}
