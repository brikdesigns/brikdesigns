'use client';

import Image from 'next/image';
import { MediaTabs, Frame } from '@brikdesigns/bds';

/** One industry tab — pre-resolved server-side (R2 blurb + industry_pages illustration). */
export interface HomeIndustryTab {
  id: string;
  label: string;
  description: string;
  imageUrl: string;
  alt: string;
}

interface HomeIndustriesTabsProps {
  tabs: HomeIndustryTab[];
}

/**
 * R2 home "Industries" section — peer {@link MediaTabs} (Dental / Real Estate /
 * Small Business), each revealing its blurb and crossfading a synced
 * illustration panel (brikdesigns#1054). MediaTabs is the single-synced-media
 * pattern (distinct from the Services SegmentedControl, #1053): auto-advance
 * gated to in-view, pause-on-hover, reduced-motion honored — all BDS defaults.
 */
export function HomeIndustriesTabs({ tabs }: HomeIndustriesTabsProps) {
  return (
    <MediaTabs
      className="industries-tabs"
      tabs={tabs.map((tab) => ({
        id: tab.id,
        label: tab.label,
        description: tab.description,
        media: (
          <Frame ratio="wide" fit="contain">
            <Image src={tab.imageUrl} alt={tab.alt} width={664} height={498} />
          </Frame>
        ),
      }))}
    />
  );
}
