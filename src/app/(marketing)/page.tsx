import Link from 'next/link';
import { getServiceCategories, getServices, getSupportPlans, mapServiceLineSlug } from '@/lib/supabase/queries';
import { Grid, Button, Cluster, SectionHeader, Card, PricingCard } from '@brikdesigns/bds';
import { HomeServicesTabs } from '@/components/homepage/HomeServicesTabs';
import { HOME_SERVICES_TABS } from '@/lib/home-services-tabs';
import { routeSlugForServiceLine } from '@/lib/service-line-routes';
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
  const [categories, allServices, plans] = await Promise.all([
    getServiceCategories(),
    getServices(),
    getSupportPlans(),
  ]);

  // R2 Services section: two peer card grids (Marketing / Back-Office) toggled
  // by a SegmentedControl. Each tab's card content is sourced from existing
  // `services` rows via the curated slug map in `home-services-tabs.ts`; the
  // line slug (from the row's own `service_lines` join, not hard-coded) drives
  // both the ServiceTag category and the `/services/{line}/{slug}` route, so the
  // back-office slug quirk (`service` → `/services/back-office`) resolves itself.
  const serviceBySlug = new Map(allServices.map((svc) => [svc.slug, svc]));
  const servicesTabs = HOME_SERVICES_TABS.map((tab) => ({
    id: tab.id,
    label: tab.label,
    cards: tab.serviceSlugs
      .map((slug) => serviceBySlug.get(slug))
      .filter((svc): svc is NonNullable<typeof svc> => Boolean(svc))
      .map((svc) => {
        const lineSlug =
          (svc.service_lines as { slug?: string } | null)?.slug ?? '';
        return {
          slug: svc.slug,
          name: svc.name,
          serviceLineSlug: routeSlugForServiceLine(lineSlug),
          category: mapServiceLineSlug(lineSlug),
          description: svc.description ?? null,
          imageUrl: svc.image_url ?? null,
        };
      }),
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

      {/* ═══ Problem-CTA ("Sound like you?") ═══ */}
      <section className="section-problem-cta" data-section="problem-cta">
        <SectionHeader
          onColor
          title="Sound like you?"
          description="That's exactly what we uncover in the BrikDown."
          actions={
            <Cluster gap="md" justify="center">
              <Button href="/offers/brikdown-analysis" variant="on-color" size="lg">
                Schedule Your Free BrikDown
              </Button>
              <Button href="/get-started" variant="outline" size="lg" className="hero-btn-on-dark">
                See How It Works
              </Button>
            </Cluster>
          }
        />
      </section>

      {/* ═══ Services ("Marketing AND back office") ═══ */}
      {/* R2 section (Figma node 25768:6723): a Marketing / Back-Office
          SegmentedControl toggling two peer card grids. Copy from Homepage-R2
          Notion ("Marketing AND back office. One team for both."). */}
      <section className="section-services" data-section="services">
        <div className="section-container">
          <SectionHeader
            title="Marketing AND back office. One team for both."
            description="Most agencies only do marketing. Most operations consultants don't touch marketing. Brik does both — so your marketing and your operations are actually working together."
          />
          <HomeServicesTabs tabs={servicesTabs} />
        </div>
      </section>

      {/* ═══ Pricing ("Monthly Subscription") ═══ */}
      {/* R2 pricing band (Figma node 25768:7667): header (title + description +
          CTA) over 3 BDS PricingCards, on the brand band. Tiers come from
          getSupportPlans() (DB); the retired HomePlanCard path is gone here. */}
      <section className="section-pricing" data-section="pricing">
        <div className="section-container">
          <div className="pricing-header">
            <SectionHeader
              onColor
              align="start"
              title="Monthly Subscription"
              description="We're more than a design studio—we're your strategic marketing partner."
            />
            <Button href="/offers/brikdown-analysis" variant="on-color" size="lg">
              Get Your Free BrikDown
            </Button>
          </div>
          <Grid columns={3} gap="lg">
            {supportPlans.map((plan) => (
              <PricingCard
                key={plan.slug}
                title={plan.name}
                price={plan.price}
                period="/month"
                description={plan.description}
                action={
                  <Button href={`/plans/${plan.slug}`} variant="primary" size="md">
                    Learn More
                  </Button>
                }
              />
            ))}
          </Grid>
        </div>
      </section>

    </>
  );
}
