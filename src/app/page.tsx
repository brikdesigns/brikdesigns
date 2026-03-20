import Image from 'next/image';
import Link from 'next/link';
import { getServiceCategories, getServices, getSupportPlans, getCustomerStories, mapCategorySlug } from '@/lib/supabase/queries';
import { HomeServiceCard } from '@/components/homepage/HomeServiceCard';
import { HomePlanCard } from '@/components/homepage/HomePlanCard';
import './homepage.css';

export const revalidate = 3600;

export default async function HomePage() {
  const [categories, allServices, plans, stories] = await Promise.all([
    getServiceCategories(),
    getServices(),
    getSupportPlans(),
    getCustomerStories(),
  ]);

  const serviceLines = categories.map((cat) => ({
    id: cat.id,
    name: cat.name,
    slug: cat.slug,
    category: mapCategorySlug(cat.slug),
    tagline: cat.tagline || '',
    description: cat.description || '',
    hero_image_url: cat.hero_image_url || null,
    card_image_url: cat.card_image_url || null,
  }));

  const supportPlans = plans.map((plan) => ({
    name: plan.name,
    slug: plan.slug,
    price: plan.monthly_price_display || 'Contact',
    description: plan.home_description || plan.description || '',
    image_url: plan.image_url || null,
  }));

  const featuredStory = stories[0];

  return (
    <>
      {/* ═══ Hero ═══ */}
      {/* Webflow: .section_hero.brand */}
      <section className="section-hero">
        <div className="hero-container">
          <h1 className="hero-heading">
            Marketing That Works.<br />
            Design That Builds.
          </h1>
          <p className="hero-subtext">
            We help small businesses show up better, work smarter, and grow faster—brik by brik.
          </p>
          <div className="hero-buttons">
            <Link href="/services" className="hero-btn-primary">
              Explore Design Services
            </Link>
            <Link href="/contact" className="hero-btn-secondary">
              Let&apos;s Talk &rarr;
            </Link>
          </div>
        </div>
      </section>

      {/* ═══ Services ("What We Do") ═══ */}
      {/* Webflow: .section_services */}
      <section className="section-services">
        <div className="section-container">
          <div className="section-header">
            <h2 className="section-heading">What We Do</h2>
            <p className="section-subtext">
              From branding to websites to behind-the-scenes systems, we help you build a business that looks good and works better.
            </p>
          </div>
          <div className="grid-3-col">
            {serviceLines.map((line) => (
              <HomeServiceCard
                key={line.slug}
                name={line.name}
                slug={line.slug}
                category={line.category}
                tagline={line.tagline}
                imageUrl={line.card_image_url}
              />
            ))}
          </div>
        </div>
      </section>

      {/* ═══ Support Plans ("Monthly Subscription") ═══ */}
      {/* Webflow: .section_service */}
      <section className="section-plans">
        <div className="section-container">
          <div className="section-header">
            <h2 className="section-heading">Monthly Subscription</h2>
            <p className="section-subtext">
              We&apos;re more than a design studio—we&apos;re your strategic marketing partner.
            </p>
          </div>
          <div className="grid-3-col">
            {supportPlans.map((plan) => (
              <HomePlanCard
                key={plan.slug}
                name={plan.name}
                slug={plan.slug}
                price={plan.price}
                description={plan.description}
                imageUrl={plan.image_url}
              />
            ))}
          </div>
        </div>
      </section>

      {/* ═══ Free Marketing Analysis CTA ═══ */}
      {/* Webflow: .section_marketing-audit — 2-column: text + illustration */}
      <section className="section-audit">
        <div className="audit-layout">
          <div className="audit-content">
            <h3 className="audit-heading">
              Not sure what you need yet?<br />
              Start with a <em>free</em> marketing assessment.
            </h3>
            <p className="audit-subtext">
              We&apos;ll review your current marketing, systems, and tools — and send you a 3-part plan to fix what&apos;s holding you back.
            </p>
            <Link href="/free-marketing-analysis" className="service-card__cta" style={{ marginTop: 'var(--gap-xl)' }}>
              Get Started
            </Link>
          </div>
          <div className="audit-image">
            <div className="service-card__image-frame">
              <Image
                src="/images/3d-form-robot.png"
                alt="3D clay form illustration"
                width={504}
                height={504}
                style={{ width: '100%', height: 'auto' }}
              />
            </div>
          </div>
        </div>
      </section>

      {/* ═══ Customer Story ═══ */}
      {/* Webflow: .section_customer-story — dark accent bg, 2-column image + text */}
      {featuredStory && (
        <section className="section-story">
          <div className="section-container">
            <div className="section-header">
              <h2 className="section-heading">Latest Customer Story</h2>
            </div>
            <div className="story-layout">
              <div className="story-image-wrapper">
                <div className="story-image-frame">
                  {featuredStory.hero_image_url ? (
                    <Image
                      src={featuredStory.hero_image_url}
                      alt={featuredStory.client_name || 'Customer story'}
                      width={600}
                      height={450}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  ) : (
                    <div style={{ width: '100%', height: '100%', backgroundColor: 'var(--surface-secondary)' }} />
                  )}
                  {featuredStory.award_label && (
                    <div className="story-badge">
                      <Image src="/images/choice.svg" alt="" width={20} height={20} />
                      <span style={{ fontFamily: 'var(--font-family-label)', fontSize: 'var(--body-xs)', fontWeight: 600 }}>
                        {featuredStory.award_label}
                      </span>
                    </div>
                  )}
                </div>
              </div>
              <div className="story-content">
                <h3 className="story-title">
                  {featuredStory.name || featuredStory.client_name}
                </h3>
                <p className="story-description">
                  {featuredStory.short_description || featuredStory.quote || ''}
                </p>
                <Link href={`/customer-stories/${featuredStory.slug}`} className="service-card__cta">
                  Read Story
                </Link>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ═══ CTA ("Get in Touch") ═══ */}
      {/* Webflow: .section_cta (white outer) → .container-cta (brand inner, border-radius: 24px) */}
      <section className="section-cta">
        <div className="cta-card">
          <h2 className="cta-heading">Get in Touch</h2>
          <p className="cta-subtext">
            Starting a new project or want to collaborate with us?
          </p>
          <Link href="/contact" className="cta-button">
            Let&apos;s Talk
          </Link>
        </div>
      </section>
    </>
  );
}
