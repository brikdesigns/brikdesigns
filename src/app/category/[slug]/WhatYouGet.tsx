'use client';

import { useState } from 'react';
import Image from 'next/image';
import { SegmentedControl } from '@bds/components/ui/SegmentedControl/SegmentedControl';
import { ServiceBadge } from '@bds/components/ui/ServiceBadge/ServiceBadge';
import type { ServiceCategory } from '@bds/components/ui/ServiceBadge/ServiceBadge';

interface Service {
  slug: string;
  name: string;
  description: string | null;
  image_url: string | null;
  primary_badge_url: string | null;
}

interface ServiceLineTab {
  name: string;
  slug: string;
  category: ServiceCategory;
  services: Service[];
}

interface WhatYouGetProps {
  tabs: ServiceLineTab[];
  colorDark: string;
  colorLight: string;
  colorBase: string;
}

export function WhatYouGet({ tabs, colorDark, colorLight, colorBase }: WhatYouGetProps) {
  const [activeTab, setActiveTab] = useState(tabs[0]?.slug || '');

  const activeServices = tabs.find((t) => t.slug === activeTab)?.services || [];
  const activeCategory = tabs.find((t) => t.slug === activeTab)?.category || 'marketing';

  return (
    <section className="svc-page__section" style={{ backgroundColor: colorLight }}>
      <div className="container-lg" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '36px' }}>
        {/* Header */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--gap-md)' }}>
          <h2 className="text-heading-xl" style={{ color: colorDark, textAlign: 'center' }}>What You Get</h2>
          <p className="text-body-md" style={{ color: colorDark, textAlign: 'center' }}>
            Here are the monthly services you get when you sign up for monthly support
          </p>
        </div>

        {/* Segmented control for tabs */}
        <SegmentedControl
          items={tabs.map((t) => ({ label: t.name, value: t.slug }))}
          value={activeTab}
          onChange={setActiveTab}
          size="sm"
          style={{
            borderColor: colorBase,
            backgroundColor: 'var(--surface-primary)',
          }}
        />

        {/* Service cards list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%', maxWidth: '800px' }}>
          {activeServices.map((svc) => (
            <div
              key={svc.slug}
              style={{
                display: 'flex',
                gap: 'var(--gap-lg)',
                background: 'var(--surface-primary)',
                borderRadius: 'var(--border-radius-lg)',
                padding: 'var(--padding-md)',
                alignItems: 'center',
                borderColor: colorLight,
                borderWidth: '1px',
                borderStyle: 'solid',
              }}
            >
              {/* Thumbnail */}
              <div style={{ width: '80px', height: '80px', borderRadius: 'var(--border-radius-md)', overflow: 'hidden', flexShrink: 0, background: '#f5f5f3' }}>
                {svc.image_url && (
                  <Image src={svc.image_url} alt={svc.name} width={80} height={80} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                )}
              </div>
              {/* Content + badge */}
              <div style={{ display: 'flex', flex: 1, gap: '12px', alignItems: 'center' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
                  <span className="text-heading-sm">{svc.name}</span>
                  {svc.description && (
                    <span className="text-body-sm text--secondary">{svc.description}</span>
                  )}
                </div>
                {/* Badge pill */}
                <ServiceBadge category={activeCategory} serviceName={svc.name} size="sm" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
