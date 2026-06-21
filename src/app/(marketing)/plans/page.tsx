import type { Metadata } from 'next';
import { getSupportPlans } from '@/lib/supabase/queries';
import { PlanCardGrid } from './PlanCardGrid';
import { ScrollDownCta } from '@/components/ui/ScrollDownCta';
import '../shared-sections.css';
import './plans.css';

export const metadata: Metadata = {
  title: 'Support Plans | Monthly Marketing & Design Subscriptions',
  description: 'Monthly subscription plans for ongoing marketing, design, and back-office support — without the cost of full-time hires.',
};

export const revalidate = 3600;

export default async function PlansPage() {
  const rawPlans = await getSupportPlans();

  const plans = rawPlans.map((plan) => {
    const sl = plan.service_lines as { slug: string } | null;
    // Prefer the plan's marketing-line illustration (card_image_url) over its
    // own marketing image (#454). PostgREST returns the embed as object or
    // array — normalize both. Falls back to plan.image_url when unset.
    const rawLine = (plan as { marketing_line?: unknown }).marketing_line;
    const marketingLine = Array.isArray(rawLine)
      ? (rawLine[0] as { card_image_url: string | null } | undefined) ?? null
      : (rawLine as { card_image_url: string | null } | null);
    return {
      name: plan.name,
      slug: plan.slug,
      monthlyPrice: plan.monthly_price_display || 'Contact',
      annualPrice: plan.annual_price_display || null,
      discountLabel: plan.discount_label || null,
      description: plan.description || '',
      imageUrl: marketingLine?.card_image_url || plan.image_url || null,
      features: [] as string[],
      serviceLineSlug: sl?.slug ?? null,
    };
  });

  return (
    <>
      {/* Hero */}
      <section className="page-hero">
        <div className="page-hero__container">
          <h1 className="page-hero__title">Support Plans</h1>
          <p className="page-hero__description">
            Get an experienced, done-for-you team to manage your marketing, back-office
            systems, or product design — without the cost of full-time hires.
          </p>
        </div>
        <ScrollDownCta />
      </section>

      {/* Plan cards */}
      <section className="page-section">
        <div className="container-lg container-lg--comfortable">
          <PlanCardGrid plans={plans} />
        </div>
      </section>
    </>
  );
}
