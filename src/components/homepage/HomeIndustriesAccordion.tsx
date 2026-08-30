'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Accordion, Frame } from '@brikdesigns/bds';

/** One industry row — pre-resolved server-side (R2 blurb + industry_pages illustration). */
export interface HomeIndustryTab {
  id: string;
  label: string;
  description: string;
  imageUrl: string;
  alt: string;
}

interface HomeIndustriesAccordionProps {
  tabs: HomeIndustryTab[];
}

/**
 * R3 home "Industries" section — a single-open BDS {@link Accordion} (Dental /
 * Real Estate / Small Business) beside a synced illustration panel, replacing
 * the R2 MediaTabs (brikdesigns#1054). Opening a row swaps the matching
 * industry_pages illustration; the two-column layout mirrors the HIW page.
 */
export function HomeIndustriesAccordion({ tabs }: HomeIndustriesAccordionProps) {
  const [open, setOpen] = useState<string[]>([tabs[0].id]);
  // Single-open accordion, but keep the last-opened industry in the panel even
  // when every row is collapsed, so the illustration is never blank.
  const activeId = open[0] ?? tabs[0].id;
  const active = tabs.find((tab) => tab.id === activeId) ?? tabs[0];

  return (
    <div className="industries-accordion__layout">
      <Accordion
        className="industries-accordion"
        openItems={open}
        onOpenChange={setOpen}
        items={tabs.map((tab) => ({
          id: tab.id,
          title: tab.label,
          content: tab.description,
        }))}
      />
      <div className="industries-accordion__media">
        <Frame ratio="wide" fit="contain">
          <Image
            key={active.id}
            src={active.imageUrl}
            alt={active.alt}
            width={664}
            height={498}
          />
        </Frame>
      </div>
    </div>
  );
}
