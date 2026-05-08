import Image from 'next/image';
import { getServiceCategories, getServices, getSupportPlans, getCustomerStories, mapCategorySlug } from '@/lib/supabase/queries';
import { LinkButton } from '@brikdesigns/bds';
import { HomeServiceCard } from '@/components/homepage/HomeServiceCard';
import { HomePlanCard } from '@/components/homepage/HomePlanCard';
import { display, text, heading } from '@/lib/styles';
import { color } from '@/lib/tokens';
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
      {/* Webflow: .section_hero.brand → .container-hero → .layout-wrapper-hero.comfortable → .content-wrapper.narrow + .button-wrapper.stretch */}
      <section className="section-hero">
        <div className="page-hero__container">
          <div className="stack stack--xl">
            <div className="stack content-wrapper--narrow" style={{ gap: 'var(--gap-tiny)' }}>
              <h1 style={{ ...display.sm, color: color.text.onColorDark }}>
                Marketing That Works. Design That Builds.
              </h1>
              <p style={{ ...text.bodyXl, color: color.text.onColorDark }}>
                We help small businesses show up better, work smarter, and grow faster—brik by brik.
              </p>
            </div>
            <div className="button-wrapper">
              <LinkButton href="/services" variant="outline" size="lg" className="btn-outline--on-dark">
                Explore Design Services
              </LinkButton>
              <LinkButton href="/contact" variant="outline" size="lg" className="btn-outline--on-dark">
                Let&apos;s Talk
              </LinkButton>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ Services ("What We Do") ═══ */}
      {/* Webflow: .section_services */}
      <section className="section-services">
        <div className="container-lg container-lg--tight">
          <div className="stack stack--md content-wrapper content-wrapper--center content-wrapper--narrowest">
            <h2 style={heading.lg}>What We Do</h2>
            <p style={{ ...text.body, color: color.text.secondary, maxWidth: 600, textAlign: 'center' }}>
              From branding to websites to behind-the-scenes systems, we help you build a business that looks good and works better.
            </p>
          </div>
          <div className="grid-3">
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
        <div className="container-lg container-lg--tight">
          <div className="stack stack--md content-wrapper content-wrapper--center content-wrapper--narrowest">
            <h2 style={heading.lg}>Monthly Subscription</h2>
            <p style={{ ...text.body, color: color.text.secondary, maxWidth: 600, textAlign: 'center' }}>
              We&apos;re more than a design studio—we&apos;re your strategic marketing partner.
            </p>
          </div>
          <div className="grid-3">
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
      {/* Webflow: .section_marketing-audit → .cms-item-audit (row: text left + image right) */}
      <section className="section-audit">
        <div className="audit-layout">
          <div className="audit-content">
            <div className="stack stack--md content-wrapper--center">
              <h3 style={heading.lg}>Not sure what you need yet?</h3>
              <h3 style={heading.lg}>Start with a <strong><em>free</em></strong> marketing assessment.</h3>
              <p style={{ ...text.body, color: color.text.secondary, textAlign: 'center' }}>
                We&apos;ll review your current marketing, systems, and tools — and send you a 3-part plan to fix what&apos;s holding you back.
              </p>
            </div>
            <div className="button-wrapper button-wrapper--center">
              <LinkButton href="/free-marketing-analysis" variant="primary" size="lg" target="_blank">
                Get Started
              </LinkButton>
            </div>
          </div>
          <div className="audit-image">
            <div className="img-frame">
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
          <div className="container-lg container-lg--comfortable">
            <div className="stack stack--md content-wrapper content-wrapper--center content-wrapper--narrowest">
              <h2 style={heading.lg}>Latest Customer Story</h2>
            </div>
            <div className="story-card">
              <div className="story-image-wrapper">
                <div className="img-frame img-frame--landscape">
                  {featuredStory.hero_image_url ? (
                    <Image
                      src={featuredStory.hero_image_url}
                      alt={featuredStory.client_name || 'Customer story'}
                      width={600}
                      height={400}
                      style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', top: 0, left: 0 }}
                    />
                  ) : (
                    <div style={{ width: '100%', height: '100%', backgroundColor: 'var(--surface-secondary)', position: 'absolute', top: 0, left: 0 }} />
                  )}
                  {featuredStory.award_label && (
                    <div className="story-badge">
                      <Image src="/images/choice.svg" alt="" width={16} height={16} className="icon-md" />
                      <span className="text-label-tiny">{featuredStory.award_label}</span>
                    </div>
                  )}
                </div>
              </div>
              <div className="story-content">
                <div>
                  <h3 style={heading.md}>
                    {featuredStory.name || featuredStory.client_name}
                  </h3>
                  <p style={{ ...text.body, color: color.text.secondary }}>
                    {featuredStory.short_description || featuredStory.quote || ''}
                  </p>
                </div>
                <div>
                  <LinkButton href={`/customer-stories/${featuredStory.slug}`} variant="primary" size="md">
                    Read Story
                  </LinkButton>
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
          <div className="stack stack--md content-wrapper--center" style={{ maxWidth: '90%' }}>
            <h2 style={{ ...heading.lg, color: color.text.onColorDark, textAlign: 'center' }}>Get in Touch</h2>
            <p style={{ ...text.bodyLg, color: color.text.onColorDark, textAlign: 'center' }}>
              Starting a new project or want to collaborate with us?
            </p>
          </div>
          <div className="button-wrapper button-wrapper--center">
            <LinkButton href="/contact" variant="outline" size="lg" className="btn-outline--on-dark">
              Let&apos;s Talk
            </LinkButton>
          </div>
        </div>
      </section>
    </>
  );
}
