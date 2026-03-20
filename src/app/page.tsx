import Image from 'next/image';
import { getServiceCategories, getSupportPlans, getCustomerStories, mapCategorySlug } from '@/lib/supabase/queries';
import { ServiceLineGrid } from '@/components/marketing/ServiceLineGrid';
import { SupportPlanGrid } from '@/components/marketing/SupportPlanGrid';
import { FeaturedTestimonial } from '@/components/marketing/FeaturedTestimonial';
import { HeroButtons } from '@/components/marketing/HeroButtons';
import { AnalysisCta, BottomCta, ViewStoriesButton } from '@/components/marketing/CtaButtons';

export const revalidate = 3600; // ISR: 1 hour

export default async function HomePage() {
  const [categories, plans, stories] = await Promise.all([
    getServiceCategories(),
    getSupportPlans(),
    getCustomerStories(),
  ]);

  const serviceLines = categories.map((cat) => ({
    name: cat.name,
    slug: cat.slug,
    category: mapCategorySlug(cat.slug),
    tagline: cat.tagline || cat.name,
  }));

  const supportPlans = plans.map((plan) => ({
    name: plan.name,
    slug: plan.slug,
    price: plan.monthly_price_display || 'Contact',
    period: '/month',
    description: plan.home_description || plan.description || '',
    features: [] as string[], // TODO: populate from support_plan_services
    highlighted: plan.slug === 'product-support',
  }));

  const featuredStory = stories[0];

  return (
    <>
      {/* Hero */}
      <section style={{ maxWidth: 1200, margin: '0 auto', padding: 'var(--padding-huge) var(--padding-lg)', textAlign: 'center' }}>
        <h1 style={{ fontFamily: 'var(--font-family-heading)', fontSize: 'var(--heading-huge)', color: 'var(--text-primary)', lineHeight: 1.1, margin: 0 }}>
          Marketing That Works.
          <br />
          Design That Builds.
        </h1>
        <p style={{ fontFamily: 'var(--font-family-body)', fontSize: 'var(--body-lg)', color: 'var(--text-secondary)', maxWidth: 640, margin: 'var(--gap-lg) auto 0' }}>
          We help small businesses show up better, work smarter, and grow faster — brik by brik.
        </p>
        <HeroButtons />
        <div style={{ marginTop: 'var(--gap-xl)', position: 'relative', maxWidth: 900, margin: 'var(--gap-xl) auto 0', borderRadius: 'var(--border-radius-lg)', overflow: 'hidden' }}>
          <Image
            src="/images/brik_designs_4x.webp"
            alt="Brik Designs — branding, marketing, and design services"
            width={900}
            height={506}
            style={{ width: '100%', height: 'auto' }}
            priority
          />
        </div>
      </section>

      {/* Services */}
      <section style={{ backgroundColor: 'var(--surface-secondary)', padding: 'var(--padding-xl) var(--padding-lg)' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 'var(--gap-xl)' }}>
            <h2 style={{ fontFamily: 'var(--font-family-heading)', fontSize: 'var(--heading-lg)', color: 'var(--text-primary)', margin: 0 }}>
              What We Do
            </h2>
            <p style={{ fontFamily: 'var(--font-family-body)', fontSize: 'var(--body-md)', color: 'var(--text-secondary)', maxWidth: 600, margin: 'var(--gap-md) auto 0' }}>
              From branding to websites to behind-the-scenes systems, we help you build a business that looks good and works better.
            </p>
          </div>
          <ServiceLineGrid items={serviceLines} />
        </div>
      </section>

      {/* Support Plans */}
      <section style={{ padding: 'var(--padding-xl) var(--padding-lg)' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 'var(--gap-xl)' }}>
            <h2 style={{ fontFamily: 'var(--font-family-heading)', fontSize: 'var(--heading-lg)', color: 'var(--text-primary)', margin: 0 }}>
              Monthly Subscription
            </h2>
            <p style={{ fontFamily: 'var(--font-family-body)', fontSize: 'var(--body-md)', color: 'var(--text-secondary)', maxWidth: 600, margin: 'var(--gap-md) auto 0' }}>
              We&apos;re more than a design studio — we&apos;re your strategic marketing partner.
            </p>
          </div>
          <SupportPlanGrid items={supportPlans} />
        </div>
      </section>

      {/* Free Analysis CTA */}
      <section style={{ backgroundColor: 'var(--surface-secondary)', padding: 'var(--padding-xl) var(--padding-lg)' }}>
        <div style={{ maxWidth: 800, margin: '0 auto' }}>
          <AnalysisCta />
        </div>
      </section>

      {/* Customer Story */}
      {featuredStory && (
        <section style={{ padding: 'var(--padding-xl) var(--padding-lg)' }}>
          <div style={{ maxWidth: 700, margin: '0 auto', textAlign: 'center' }}>
            <h2 style={{ fontFamily: 'var(--font-family-heading)', fontSize: 'var(--heading-lg)', color: 'var(--text-primary)', margin: 0 }}>
              Latest Customer Story
            </h2>
            <div style={{ marginTop: 'var(--gap-lg)' }}>
              <FeaturedTestimonial
                quote={featuredStory.quote || featuredStory.short_description || ''}
                authorName={featuredStory.quote_attribution || featuredStory.client_name}
                authorRole={featuredStory.industry || undefined}
                rating={5}
              />
            </div>
            <ViewStoriesButton />
          </div>
        </section>
      )}

      {/* Bottom CTA */}
      <section style={{ backgroundColor: 'var(--surface-brand-primary)', padding: 'var(--padding-xl) var(--padding-lg)', textAlign: 'center' }}>
        <h2 style={{ fontFamily: 'var(--font-family-heading)', fontSize: 'var(--heading-lg)', color: 'var(--text-on-color-dark)', margin: 0 }}>
          Get in Touch
        </h2>
        <p style={{ fontFamily: 'var(--font-family-body)', fontSize: 'var(--body-md)', color: 'var(--text-on-color-dark)', opacity: 0.9, margin: 'var(--gap-md) auto 0' }}>
          Starting a new project or want to collaborate with us?
        </p>
        <BottomCta />
      </section>
    </>
  );
}
