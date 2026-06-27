import { Skeleton } from '@/components/ui/Skeleton';
import { gap } from '@/lib/tokens';
import '../../shared-sections.css';

/**
 * Shape-accurate skeleton for the support-plan detail page. Mirrors the real
 * `.page-hero` split (`plans/[slug]/page.tsx`): full-viewport hero with content
 * left (title → intro → CTA) and an image-plus-price card right. Collapses to
 * one column under 991px via `.skeleton-hero-split`.
 */
export default function Loading() {
  return (
    <section className="page-hero">
      <div className="page-hero__container">
        <div className="skeleton-hero-split">
          <div className="skeleton-hero-col">
            {/* title */}
            <Skeleton style={{ height: '3rem', width: '75%' }} />
            {/* intro */}
            <div className="skeleton-lines">
              <Skeleton style={{ height: '1rem', width: '100%' }} />
              <Skeleton style={{ height: '1rem', width: '94%' }} />
              <Skeleton style={{ height: '1rem', width: '65%' }} />
            </div>
            {/* CTA button */}
            <Skeleton style={{ height: '3rem', width: '12rem', marginTop: gap.sm }} />
          </div>

          {/* image + price card */}
          <div className="skeleton-hero-col">
            <Skeleton style={{ width: '100%', aspectRatio: '4 / 3' }} />
            <Skeleton style={{ height: '2.5rem', width: '50%' }} />
            <div className="skeleton-lines">
              <Skeleton style={{ height: '0.875rem', width: '100%' }} />
              <Skeleton style={{ height: '0.875rem', width: '90%' }} />
              <Skeleton style={{ height: '0.875rem', width: '95%' }} />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
