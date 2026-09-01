'use client';

import Image from 'next/image';
import { SyncedMediaSteps, Frame } from '@brikdesigns/bds';

/** One industry step — pre-resolved server-side (R2 blurb + industry_pages illustration). */
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
 * R2 home "Industries" section — a vertical {@link SyncedMediaSteps} rail
 * (Dental / Real Estate / Small Business) stacked beside a synced, crossfading
 * illustration panel (brikdesigns#1054). SyncedMediaSteps is the accordion
 * single-synced-media pattern: the active item reveals its blurb *underneath
 * itself* and crossfades its illustration — the description-under-active layout
 * the operator asked for, which the tabs pattern (MediaTabs) cannot express
 * (a tablist may only contain tabs). Step numbers and the countdown cue are off;
 * auto-advance / pause-on-hover / reduced-motion are BDS defaults.
 */
export function HomeIndustriesTabs({ tabs }: HomeIndustriesTabsProps) {
  return (
    <SyncedMediaSteps
      className="industries-tabs"
      showStepNumbers={false}
      showCountdown={false}
      steps={tabs.map((tab) => ({
        id: tab.id,
        title: tab.label,
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
