import { Skeleton } from '@/components/ui/Skeleton';
import { gap } from '@/lib/tokens';
import '../../shared-sections.css';

/**
 * Shape-accurate skeleton for the customer-story detail page. Mirrors the real
 * `.story-arc` hero (`customer-stories/[slug]/page.tsx`): a narrow
 * `.container-lg--story` column with back link → title → a `story-detail-meta`
 * list (client / service line / service / industry) → the first wide story-arc
 * media frame. Stacked, not a split hero.
 */
export default function Loading() {
  return (
    <section className="page-section story-arc">
      <div className="container-lg container-lg--story">
        {/* back link ("← Customer Stories") */}
        <Skeleton style={{ height: '0.875rem', width: '10rem', marginBottom: gap.md }} />

        {/* title (heading.lg — two lines) */}
        <Skeleton style={{ height: '2.75rem', width: '90%' }} />
        <Skeleton style={{ height: '2.75rem', width: '55%', marginTop: gap.sm }} />

        {/* story-detail-meta rows (label + value) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: gap.sm, marginTop: gap.lg }}>
          {['9rem', '11rem', '8rem'].map((w, i) => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: gap.xs }}>
              <Skeleton style={{ height: '0.75rem', width: '5rem' }} />
              <Skeleton style={{ height: '1rem', width: w }} />
            </div>
          ))}
        </div>

        {/* first wide story-arc media frame */}
        <Skeleton style={{ width: '100%', aspectRatio: '16 / 9', marginTop: gap.xl }} />

        {/* body copy */}
        <div className="skeleton-lines" style={{ marginTop: gap.xl }}>
          {['100%', '95%', '90%', '70%'].map((w, i) => (
            <Skeleton key={i} style={{ height: '1rem', width: w }} />
          ))}
        </div>
      </div>
    </section>
  );
}
