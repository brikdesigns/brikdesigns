import Image from 'next/image';
import Link from 'next/link';
import { getServiceCategories, getServices, getSupportPlans, getCustomerStories, mapServiceLineSlug } from '@/lib/supabase/queries';
import { Grid, Button, Cluster, SectionHeader, Card } from '@brikdesigns/bds';
import { label } from '@/lib/styles';
import { HomeServiceCard } from '@/components/homepage/HomeServiceCard';
import { HomePlanCard } from '@/components/homepage/HomePlanCard';
import { ScrollDownCta } from '@/components/ui/ScrollDownCta';
import './homepage.css';
import './shared-sections.css';

export const revalidate = 3600;

// R2 "Does this sound familiar?" pain points (Homepage-R2 Notion doc).
// Row-major order mirrors the Figma layout (node 25768:9531): row 1 across,
// then row 2. Figma placeholder text is ignored — this is the real copy.
const PROBLEMS = [
  {
    title: 'Leads come in and go quiet',
    description: 'No system to follow up, so they slip away every time.',
  },
  {
    title: 'Marketing happens when you get to it',
    description: 'No real plan, just reaction.',
  },
  {
    title: "Your systems work because you're running them",
    description: 'The moment you step away, things slip.',
  },
  {
    title: 'Nothing is written down',
    description: "Every process lives in someone's head.",
  },
  {
    title: 'Vendors and tools for everything, but nothing connects',
    description: "Marketing doesn't talk to ops.",
  },
  {
    title: 'You built this to grow, not to babysit it',
    description: 'But here you are.',
  },
];

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
  }));

  // Plan cards render the marketing-line illustration (e.g. the Marketing
  // Design line's card_image_url on the Marketing Support plan card). Joined
  // client-side against the already-fetched `categories` via the
  // service_plans.display_line_id FK introduced in portal 00196, renamed by 00339.
  // Falls back to plan.image_url when display_line_id is null/absent.
  const serviceLineById = new Map(categories.map((cat) => [cat.id, cat]));
  const supportPlans = plans
    // Product Support is a niche plan — excluded from the home Monthly
    // Subscription band (still live on the Plans page and its detail route).
    .filter((plan) => plan.slug !== 'product-support')
    .map((plan) => {
    const displayLineId = (plan as { display_line_id?: string | null }).display_line_id;
    const line = displayLineId ? serviceLineById.get(displayLineId) : null;
    return {
      name: plan.name,
      slug: plan.slug,
      price: plan.monthly_price_display || 'Contact',
      description: plan.home_description || plan.description || '',
      image_url: line?.card_image_url ?? plan.image_url ?? null,
      // Same display-line join drives the CTA tint — the card links to
      // /plans/{slug}, whose own CTAs are tinted from this line (#1001).
      service_line_slug: line?.slug ?? null,
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
              <h1 className="hero-title">
                Stop managing the business.
                <br />
                Start growing it.
              </h1>
              <p className="hero-description">
                Most business owners spend more time running their marketing and managing their operations than actually doing the work. Brik takes both off your plate — so leads get followed up, your team has a process, and you can spend your time on patients and clients, not on the systems holding everything together.
              </p>
            </div>
            <Cluster gap="md" className="hero-button-wrapper">
              <Button href="/offers/brikdown-analysis" variant="on-color" size="lg">
                Start with a Free BrikDown Analysis
              </Button>
              <Button href="/get-started" variant="outline" size="lg" className="hero-btn-on-dark">
                See How It Works
              </Button>
            </Cluster>
          </div>
        </div>
        <ScrollDownCta />
      </section>

      {/* ═══ Problem ("Does this sound familiar?") ═══ */}
      <section className="section-problem" data-section="problems">
        <div className="section-container">
          <Card padding="lg" className="problem-card">
            <h2 className="problem__title">Does this sound familiar?</h2>
            <Grid columns={3} gap="lg">
              {PROBLEMS.map((problem) => (
                <div key={problem.title} className="problem-item">
                  <span className="problem-item__rule" aria-hidden="true" />
                  <h3 className="problem-item__title">{problem.title}</h3>
                  <p className="problem-item__description">{problem.description}</p>
                </div>
              ))}
            </Grid>
          </Card>
        </div>
      </section>

      {/* ═══ Services ("What We Do") ═══ */}
      {/* Webflow: .section_services */}
      <section className="section-services">
        <div className="section-container">
          <SectionHeader
            title="What We Do"
            description="From branding to websites to behind-the-scenes systems, we help you build a business that looks good and works better."
          />
          <Grid columns={5} gap="lg">
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
          <SectionHeader
            title="Monthly Subscription"
            description="We're more than a design studio—we're your strategic marketing partner."
          />
          <Grid columns={3} gap="lg">
            {supportPlans.map((plan) => (
              <HomePlanCard
                key={plan.slug}
                name={plan.name}
                slug={plan.slug}
                price={plan.price}
                description={plan.description}
                imageUrl={plan.image_url}
                serviceLineSlug={plan.service_line_slug}
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
              <h3 className="audit-title">Not sure what you need yet?</h3>
              <h3 className="audit-title">Start with a <strong><em>free</em></strong> marketing assessment.</h3>
              <p className="audit-description">
                We&apos;ll review your current marketing, systems, and tools — and send you a 3-part plan to fix what&apos;s holding you back.
              </p>
            </div>
            <Cluster gap="md" justify="center">
              <Button href="/offers/free-marketing-analysis" variant="primary" size="lg" target="_blank">
                Get Started
              </Button>
            </Cluster>
          </div>
          <div className="audit-image">
            <div className="audit__media">
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
            <SectionHeader title="Latest Customer Story" />
            <div className="story-card">
              <div className="story-image-wrapper">
                <div className="section-story__media">
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
            <h2 className="cta-title">Get in Touch</h2>
            <p className="cta-description">
              Starting a new project or want to collaborate with us?
            </p>
          </div>
          <Cluster gap="md" justify="center">
            <Button href="/contact" variant="outline" size="lg" className="hero-btn-on-dark">
              Let&apos;s Talk
            </Button>
          </Cluster>
        </div>
      </section>
    </>
  );
}
