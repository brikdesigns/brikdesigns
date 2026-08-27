'use client';

import { useState } from 'react';
import { Grid, SegmentedControl } from '@brikdesigns/bds';
import type { ServiceLine } from '@brikdesigns/bds';
import { ServiceCard } from '@/components/marketing/ServiceCard';

/** One card in a Services tab — pre-resolved server-side from a `services` row. */
export interface HomeServiceTabCard {
  slug: string;
  name: string;
  /** Route segment for the service's line (`routeSlugForServiceLine` applied). */
  serviceLineSlug: string;
  category: ServiceLine;
  description: string | null;
  imageUrl: string | null;
}

export interface HomeServicesTabsData {
  id: string;
  label: string;
  cards: HomeServiceTabCard[];
}

interface HomeServicesTabsProps {
  tabs: HomeServicesTabsData[];
}

/**
 * R2 home "Services" section — a Marketing / Back-Office {@link SegmentedControl}
 * toggling two peer card grids (brikdesigns#1053). Peer switch, not a sequence:
 * SegmentedControl is the ratified control for the two-way toggle (teardown ref
 * §"Accordion vs Tab"), distinct from MediaTabs (Industries, #1054).
 */
export function HomeServicesTabs({ tabs }: HomeServicesTabsProps) {
  const [activeId, setActiveId] = useState(tabs[0]?.id ?? '');
  const active = tabs.find((tab) => tab.id === activeId) ?? tabs[0];

  return (
    <div className="services-tabs">
      <SegmentedControl
        aria-label="Choose a service area"
        items={tabs.map((tab) => ({ label: tab.label, value: tab.id }))}
        value={activeId}
        onChange={setActiveId}
        size="lg"
      />

      <Grid columns={3} gap="lg" className="services-tabs__grid">
        {active?.cards.map((card) => (
          <ServiceCard
            key={card.slug}
            name={card.name}
            slug={card.slug}
            serviceLineSlug={card.serviceLineSlug}
            category={card.category}
            description={card.description}
            imageUrl={card.imageUrl}
            iconServiceName={card.name}
            showCta
          />
        ))}
      </Grid>
    </div>
  );
}
