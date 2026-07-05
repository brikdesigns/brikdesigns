import { Skeleton } from '@/components/ui/Skeleton';
import '../../shared-sections.css';

/**
 * Shape-accurate skeleton for the customer (industry) detail page. Mirrors the
 * real `.page-hero` split (`customers/[slug]/page.tsx`): full-viewport hero
 * with content left (breadcrumb → badge → title → intro) and a square media
 * tile right. Collapses to one column under 991px via `.skeleton-hero-split`.
 */
export default function Loading() {
  return (
    <section className="page-hero">
      <div className="page-hero__container">
        <div className="skeleton-hero-split">
          <div className="skeleton-hero-col">
            {/* breadcrumb */}
            <Skeleton style={{ height: '0.875rem', width: '11rem' }} />
            {/* award badge tile */}
            <Skeleton style={{ height: '2.5rem', width: '2.5rem' }} />
            {/* title */}
            <Skeleton style={{ height: '3rem', width: '70%' }} />
            {/* intro description */}
            <div className="skeleton-lines">
              <Skeleton style={{ height: '1rem', width: '100%' }} />
              <Skeleton style={{ height: '1rem', width: '92%' }} />
              <Skeleton style={{ height: '1rem', width: '60%' }} />
            </div>
          </div>
          {/* square media tile */}
          <Skeleton style={{ width: '100%', aspectRatio: '1' }} />
        </div>
      </div>
    </section>
  );
}
