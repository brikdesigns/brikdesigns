import type { Metadata } from 'next';
import { getSupportPlans } from '@/lib/supabase/queries';
import { PlanCardGrid } from './PlanCardGrid';
import '../shared-sections.css';
import './plans.css';

export const metadata: Metadata = {
  title: 'Support Plans | Monthly Marketing & Design Subscriptions',
  description: 'Monthly subscription plans for ongoing marketing, design, and back-office support — without the cost of full-time hires.',
};

export const revalidate = 3600;

export default async function PlansPage() {
  const rawPlans = await getSupportPlans();

  const plans = rawPlans.map((plan) => ({
    name: plan.name,
    slug: plan.slug,
    monthlyPrice: plan.monthly_price_display || 'Contact',
    annualPrice: plan.annual_price_display || null,
    description: plan.description || '',
    imageUrl: plan.image_url || null,
    features: plan.features || [],
  }));

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
      </section>

      {/* Plan cards */}
      <section className="content-section--secondary plans-section">
        <div className="container-lg container-lg--comfortable">
          <PlanCardGrid plans={plans} />
        </div>
      </section>
    </>
  );
}
