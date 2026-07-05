import { Skeleton } from '@/components/ui/Skeleton';
import { gap } from '@/lib/tokens';
import '../../shared-sections.css';

/**
 * Shape-accurate skeleton for the service-line landing page. Mirrors the real
 * `.page-hero` split (`services/[serviceLineSlug]/page.tsx`): full-viewport hero
 * with content left (breadcrumb → title → intro) and a media tile right.
 * Collapses to one column under 991px via `.skeleton-hero-split`. Unlike the
 * service-detail hero, the line landing has no pricing card — just the media.
 */
export default function Loading() {
  return (
    <section className="page-hero">
      <div className="page-hero__container">
        <div className="skeleton-hero-split">
          <div className="skeleton-hero-col">
            {/* breadcrumb */}
            <Skeleton style={{ height: '0.875rem', width: '10rem' }} />
            {/* title */}
            <Skeleton style={{ height: '3rem', width: '70%', marginTop: gap.sm }} />
            {/* intro description */}
            <div className="skeleton-lines">
              <Skeleton style={{ height: '1rem', width: '100%' }} />
              <Skeleton style={{ height: '1rem', width: '92%' }} />
              <Skeleton style={{ height: '1rem', width: '60%' }} />
            </div>
          </div>

          {/* hero media tile */}
          <Skeleton style={{ width: '100%', aspectRatio: '4 / 3' }} />
        </div>
      </div>
    </section>
  );
}
