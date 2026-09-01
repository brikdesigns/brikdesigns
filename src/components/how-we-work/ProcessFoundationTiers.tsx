'use client';

import { useState } from 'react';
import { SegmentedControl } from '@brikdesigns/bds';
import { CheckIcon } from './CheckIcon';
import type { ProcessChecklistItem } from '@/lib/how-we-work';

/** A Step-2 segment with its Managed price already resolved server-side. */
export interface FoundationSegmentView {
  id: string;
  label: string;
  /** Managed monthly price display from service_plan_tiers (e.g. "$2,500.00"), or null. */
  price: string | null;
  bullets: ProcessChecklistItem[];
}

// DB stores whole-dollar prices with a ".00" — drop it for the marketing block.
function formatPrice(display: string | null): string {
  return display ? display.replace(/\.00$/, '') : 'Contact us';
}

/**
 * HIW Step 2 (Foundation) right pane — a SegmentedControl over the service-line
 * plans; the active segment shows its Managed monthly price + detail bullets
 * (brikdesigns#1123). Client component because the toggle holds state; the
 * price is pulled live server-side and passed in (DB is the pricing SoT).
 * Mirrors the ratified home Services pattern (HomeServicesTabs).
 */
export function ProcessFoundationTiers({ segments }: { segments: FoundationSegmentView[] }) {
  const [activeId, setActiveId] = useState(segments[0]?.id ?? '');
  const active = segments.find((s) => s.id === activeId) ?? segments[0];
  if (!active) return null;

  return (
    <div className="hiw-tiers">
      <SegmentedControl
        aria-label="Choose a plan"
        items={segments.map((s) => ({ label: s.label, value: s.id }))}
        value={activeId}
        onChange={setActiveId}
        size="md"
        fullWidth
        className="hiw-tiers__control"
      />

      <div className="hiw-tiers__price">
        <p className="hiw-tiers__amount">
          {formatPrice(active.price)}
          {active.price && <span className="hiw-tiers__cadence">/mo</span>}
        </p>
      </div>

      <div className="hiw-card__checklist">
        {active.bullets.map((item) => (
          <div key={item.title} className="hiw-check">
            <span className="hiw-check__icon" aria-hidden="true">
              <CheckIcon />
            </span>
            <div className="hiw-check__text">
              <p className="hiw-check__title">{item.title}</p>
              <p className="hiw-check__description">{item.description}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
