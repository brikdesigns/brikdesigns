import { Skeleton } from '@/components/ui/Skeleton';
import { gap } from '@/lib/tokens';
import '../../shared-sections.css';

/**
 * Shape-accurate skeleton for the blog post detail page. Mirrors the real
 * anatomy (`blog/[slug]/page.tsx`): a narrow 760px article column with
 * breadcrumb → title → meta → 16:9 hero media → summary → body copy. The real
 * page has no full-bleed hero, so neither does this.
 */
export default function Loading() {
  return (
    <section className="page-section">
      <div className="container-lg container-lg--post">
        {/* breadcrumb */}
        <Skeleton style={{ height: '0.875rem', width: '14rem', marginBottom: gap.md }} />

        {/* title (heading.lg — two lines) */}
        <Skeleton style={{ height: '2.75rem', width: '95%' }} />
        <Skeleton style={{ height: '2.75rem', width: '55%', marginTop: gap.sm }} />

        {/* meta row (date + duration) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: gap.xs, marginTop: gap.md }}>
          <Skeleton style={{ height: '1rem', width: '11rem' }} />
          <Skeleton style={{ height: '1rem', width: '8rem' }} />
        </div>

        {/* hero media (16:9) */}
        <Skeleton style={{ width: '100%', aspectRatio: '16 / 9', marginTop: gap.xl }} />

        {/* summary (bodyHuge — two lines) */}
        <div className="skeleton-lines" style={{ marginTop: gap.xl }}>
          <Skeleton style={{ height: '1.5rem', width: '100%' }} />
          <Skeleton style={{ height: '1.5rem', width: '80%' }} />
        </div>

        {/* article body */}
        <div className="skeleton-lines" style={{ marginTop: gap.xl }}>
          {['100%', '96%', '92%', '98%', '70%', '100%', '88%'].map((w, i) => (
            <Skeleton key={i} style={{ height: '1rem', width: w }} />
          ))}
        </div>
      </div>
    </section>
  );
}
