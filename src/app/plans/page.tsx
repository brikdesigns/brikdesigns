/**
 * Support Plans Index Page
 *
 * Transcribed from Paper artboard "Plans Page."
 * Each plan card uses its primary service line's brand base color for the button
 * and card_image_url for the thumbnail.
 */
import type { Metadata } from 'next';
import { getSupportPlans, getServiceLinesForPlan } from '@/lib/supabase/queries';
import { PlanCardGrid } from './PlanCardGrid';
import '../shared-sections.css';
import '../services/services.css';

export const metadata: Metadata = {
  title: 'Support Plans | Monthly Marketing & Design Subscriptions',
  description: 'Monthly subscription plans for ongoing marketing, design, and back-office support — without the cost of full-time hires.',
};

export const revalidate = 3600;

export default async function PlansPage() {
  const rawPlans = await getSupportPlans();

  // Resolve each plan's primary service line for brand colors + card image
  const plans = await Promise.all(
    rawPlans.map(async (plan) => {
      const serviceLines = await getServiceLinesForPlan(plan.slug);
      // Primary = the line whose name matches the plan name
      const primary = serviceLines.find((sl) => {
        const planWord = plan.name.replace(' Support', '').replace(' Design', '').toLowerCase();
        return sl.name.toLowerCase().includes(planWord);
      }) || serviceLines[0] || null;

      return {
        name: plan.name,
        slug: plan.slug,
        monthlyPrice: plan.monthly_price_display || 'Contact',
        annualPrice: plan.annual_price_display || null,
        description: plan.description || '',
        imageUrl: primary?.card_image_url || plan.image_url || null,
        brandColorBase: primary?.brand_color_base || '#E35335',
      };
    })
  );

  return (
    <>
      {/* ═══ Hero ═══ */}
      <section style={{ padding: '80px 0 40px' }}>
        <div className="container-lg" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', maxWidth: '800px', gap: '24px' }}>
          <h1 className="text-display-sm text--center">Support Plans</h1>
          <p className="text-body-huge text--center">
            Get an experienced, done-for-you team to manage your marketing, back-office
            systems, or product design — without the cost of full-time hires. We plug in
            where you need us most, handling the day-to-day so you can focus on what you do best.
          </p>
          <a href="#service" style={{ color: '#828282', textDecoration: 'none', fontFamily: 'var(--font-family-label)', fontWeight: 600, fontSize: '16px' }}>
            Scroll down
          </a>
        </div>
      </section>

      {/* ═══ Plan Cards ═══ */}
      <section id="service" className="svc-page__section">
        <div className="container-lg" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '36px' }}>
          <h2 className="text-heading-xl text--center">Support Plans</h2>
          <PlanCardGrid plans={plans} />
        </div>
      </section>
    </>
  );
}
