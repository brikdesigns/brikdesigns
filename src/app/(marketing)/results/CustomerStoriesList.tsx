'use client';

import { useMemo, useState } from 'react';
import { Button, SegmentedControl } from '@brikdesigns/bds';
import { CustomerStoryCard, type CustomerStoryCardProps } from '@/components/marketing/CustomerStoryCard';
import { text } from '@/lib/styles';
import { color, gap } from '@/lib/tokens';

const ALL = 'all';
/** BACKLOG-443: initial visible cap; a "Load more" control reveals the rest. */
const INITIAL_VISIBLE = 6;
const LOAD_STEP = 6;

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
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE);

  const filtered =
    industry === ALL ? stories : stories.filter((story) => story.industry === industry);

  // Reset the cap whenever the industry filter changes.
  const handleIndustryChange = (next: string) => {
    setIndustry(next);
    setVisibleCount(INITIAL_VISIBLE);
  };

  const visible = filtered.slice(0, visibleCount);
  const hasMore = filtered.length > visibleCount;

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
            onChange={handleIndustryChange}
            size="lg"
          />
        </div>
      )}

      {filtered.length > 0 ? (
        <>
          <div className="story-list">
            {visible.map((story) => (
              <CustomerStoryCard key={story.slug} {...story} />
            ))}
          </div>
          {hasMore && (
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: gap.xl }}>
              <Button
                variant="outline"
                size="lg"
                onClick={() => setVisibleCount((count) => count + LOAD_STEP)}
              >
                Load more
              </Button>
            </div>
          )}
        </>
      ) : (
        <p style={{ ...text.body, color: color.text.secondary, textAlign: 'center' }}>
          No customer stories in this industry yet.
        </p>
      )}
    </>
  );
}
