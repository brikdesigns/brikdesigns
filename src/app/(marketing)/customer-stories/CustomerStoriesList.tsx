'use client';

import { useMemo, useState } from 'react';
import { SegmentedControl } from '@brikdesigns/bds';
import { CustomerStoryCard, type CustomerStoryCardProps } from '@/components/marketing/CustomerStoryCard';
import { text } from '@/lib/styles';
import { color, gap } from '@/lib/tokens';

const ALL = 'all';

/**
 * Client-side industry filter for the customer-stories list. The page maps the
 * Supabase rows into serializable card view-models server-side; this component
 * owns the filter state and renders the (already-mapped) cards.
 */
export function CustomerStoriesList({ stories }: { stories: CustomerStoryCardProps[] }) {
  const industries = useMemo(() => {
    const set = new Set<string>();
    for (const story of stories) {
      if (story.industry) set.add(story.industry);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [stories]);

  const [industry, setIndustry] = useState(ALL);

  const filtered =
    industry === ALL ? stories : stories.filter((story) => story.industry === industry);

  return (
    <>
      {/* Only show the filter when there's more than one industry to choose between. */}
      {industries.length > 1 && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            marginBottom: gap.xl,
            maxWidth: '100%',
            overflowX: 'auto',
          }}
        >
          <SegmentedControl
            items={[
              { label: 'All', value: ALL },
              ...industries.map((name) => ({ label: name, value: name })),
            ]}
            value={industry}
            onChange={setIndustry}
            size="lg"
          />
        </div>
      )}

      {filtered.length > 0 ? (
        <div className="story-list">
          {filtered.map((story) => (
            <CustomerStoryCard key={story.slug} {...story} />
          ))}
        </div>
      ) : (
        <p style={{ ...text.body, color: color.text.secondary, textAlign: 'center' }}>
          No customer stories in this industry yet.
        </p>
      )}
    </>
  );
}
