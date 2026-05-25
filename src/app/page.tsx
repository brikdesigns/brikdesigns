import Image from 'next/image';
import Link from 'next/link';
import { getServiceCategories, getServices, getSupportPlans, getCustomerStories, mapServiceLineSlug } from '@/lib/supabase/queries';
import { Grid, Button } from '@brikdesigns/bds';
import { label } from '@/lib/styles';
import { HomeServiceCard } from '@/components/homepage/HomeServiceCard';
import { HomePlanCard } from '@/components/homepage/HomePlanCard';
import './homepage.css';
import './shared-sections.css';

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
    category: mapServiceLineSlug(cat.slug),
    tagline: cat.tagline || '',
    description: cat.description || '',
    hero_image_url: cat.hero_image_url || null,
    card_image_url: cat.card_image_url || null,
    brand_color_base: cat.brand_color_base || null,
  }));

  // Subscription cards mirror the service-line grid above by rendering the
  // owning service line's card_image_url (e.g. the marketing-line illustration
  // on a Marketing Support Plan card). Joined client-side from the already-
  // fetched `categories` because the `service_plans.service_line_id` column
  // exists in the schema but lacks a PostgREST-visible FK constraint, so
  // `.select('*, service_lines(...)')` 500s with PGRST200. Falls back to
  // plan.image_url when a plan isn't linked.
  const serviceLineById = new Map(categories.map((cat) => [cat.id, cat]));
  const supportPlans = plans.map((plan) => {
    const line = plan.service_line_id ? serviceLineById.get(plan.service_line_id) : null;
    return {
      name: plan.name,
      slug: plan.slug,
      price: plan.monthly_price_display || 'Contact',
      description: plan.home_description || plan.description || '',
      image_url: line?.card_image_url ?? plan.image_url ?? null,
    };
  });

  const featuredStory = stories[0];

  return (
    <>
      {/* ═══ Hero ═══ */}
      {/* Webflow: .section_hero.brand → .container-hero → .layout-wrapper-hero.comfortable → .content-wrapper.narrow + .button-wrapper.stretch */}
      <section className="section-hero">
        <div className="hero-container">
          <div className="hero-layout">
            <div className="hero-text">
              <h1 className="hero-heading">
                Marketing That Works.
                <br />
                Design That Builds.
              </h1>
              <p className="hero-subtext">
                We help small businesses show up better, work smarter, and grow faster—brik by brik.
              </p>
            </div>
            <div className="button-wrapper">
              <Button href="/services" variant="on-color" size="lg">
                Explore Design Services
              </Button>
              <Button href="/contact" variant="outline" size="lg" className="hero-btn-on-dark">
                Let&apos;s Talk
              </Button>
            </div>
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
          <Grid columns={3} gap="md">
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
          </Grid>
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
          <Grid columns={3} gap="md">
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
          </Grid>
        </div>
      </section>

      {/* ═══ Free Marketing Analysis CTA ═══ */}
      {/* Webflow: .section_marketing-audit → .cms-item-audit (row: text left + image right) */}
      <section className="section-audit">
        <div className="audit-layout">
          <div className="audit-content">
            <div className="audit-text">
              <h3 className="audit-heading">Not sure what you need yet?</h3>
              <h3 className="audit-heading">Start with a <strong><em>free</em></strong> marketing assessment.</h3>
              <p className="audit-subtext">
                We&apos;ll review your current marketing, systems, and tools — and send you a 3-part plan to fix what&apos;s holding you back.
              </p>
            </div>
            <div className="button-wrapper button-wrapper--center">
              <Button href="/free-marketing-analysis" variant="primary" size="lg" target="_blank">
                Get Started
              </Button>
            </div>
          </div>
          <div className="audit-image">
            <div className="audit-image-frame">
              <Image
                src="/images/3d-form-robot.png"
                alt="3D clay form illustration"
                width={1008}
                height={1008}
                quality={90}
                sizes="(max-width: 991px) 100vw, 50vw"
                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
              />
            </div>
          </div>
        </div>
      </section>

      {/* ═══ Customer Story ═══ */}
      {/* Webflow: .section_customer-story → .container-lg.comfortable → .cms-item-story (row card) */}
      {featuredStory && (
        <section className="section-story">
          <div className="story-container">
            <div className="section-header">
              <h2 className="section-heading">Latest Customer Story</h2>
            </div>
            <div className="story-card">
              <div className="story-image-wrapper">
                <div className="story-image-frame">
                  {featuredStory.hero_image_url ? (
                    <Image
                      src={featuredStory.hero_image_url}
                      alt={featuredStory.client_name || 'Customer story'}
                      width={600}
                      height={400}
                      priority
                      style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', top: 0, left: 0 }}
                    />
                  ) : (
                    <div style={{ width: '100%', height: '100%', backgroundColor: 'var(--surface-secondary)', position: 'absolute', top: 0, left: 0 }} />
                  )}
                  {featuredStory.award_label && (
                    <div className="story-badge">
                      <Image src="/images/choice.svg" alt="" width={16} height={16} className="icon-md" />
                      <span style={label.tiny}>{featuredStory.award_label}</span>
                    </div>
                  )}
                </div>
              </div>
              <div className="story-content">
                <div>
                  <h3 className="story-title">
                    {featuredStory.name || featuredStory.client_name}
                  </h3>
                  <p className="story-description">
                    {featuredStory.short_description || featuredStory.quote || ''}
                  </p>
                </div>
                <div>
                  <Button href={`/customer-stories/${featuredStory.slug}`} variant="primary" size="md">
                    Read Story
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ═══ CTA ("Get in Touch") ═══ */}
      {/* Webflow: .section_cta → .container-cta → .inner-wrapper._90.center.stacked */}
      <section className="section-cta">
        <div className="cta-card">
          <div className="cta-inner">
            <h2 className="cta-heading">Get in Touch</h2>
            <p className="cta-subtext">
              Starting a new project or want to collaborate with us?
            </p>
          </div>
          <div className="button-wrapper button-wrapper--center">
            <Button href="/contact" variant="outline" size="lg" className="hero-btn-on-dark">
              Let&apos;s Talk
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}
