import type { Metadata } from 'next';
import Link from 'next/link';
import { getSupportPlans } from '@/lib/supabase/queries';
import { HomePlanCard } from '@/components/homepage/HomePlanCard';
import '../shared-sections.css';

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
    price: plan.monthly_price_display || 'Contact',
    description: plan.description || '',
    imageUrl: plan.card_image_url || null,
  }));

  return (
    <>
      {/* Hero */}
      <section className="page-hero">
        <div className="page-hero__container">
          <h1 className="page-hero__title">Support Plans</h1>
          <p className="page-hero__description">
            Get an experienced, done-for-you team to manage your marketing, back-office systems, or product design — without the cost of full-time hires.
          </p>
        </div>
      </section>

      {/* Plan cards */}
      <section className="content-section--secondary" style={{ padding: 'var(--padding-huge) 0' }}>
        <div className="content-section__container">
          <div className="grid-3">
            {plans.map((plan) => (
              <HomePlanCard
                key={plan.slug}
                name={plan.name}
                slug={plan.slug}
                price={plan.price}
                description={plan.description}
                imageUrl={plan.imageUrl}
              />
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="content-section" style={{ padding: 'var(--padding-huge) 0' }}>
        <div className="content-section__container" style={{ textAlign: 'center' }}>
          <h2 className="content-section__heading">Not sure which plan is right?</h2>
          <p className="content-section__subtext">
            Let&apos;s talk through your needs and find the right fit.
          </p>
          <Link href="/contact" className="btn-primary" style={{ marginTop: 'var(--gap-xl)' }}>
            Let&apos;s Talk
          </Link>
        </div>
      </section>
    </>
  );
}
