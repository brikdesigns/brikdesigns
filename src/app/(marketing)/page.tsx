import Link from 'next/link';
import { getServiceCategories, getServices, getSupportPlans, getIndustryPages, mapServiceLineSlug } from '@/lib/supabase/queries';
import { Grid, Button, Cluster, SectionHeader, Card, PricingCard, Marquee, ZIndexMediaBand } from '@brikdesigns/bds';
import { HomeServicesTabs } from '@/components/homepage/HomeServicesTabs';
import { HOME_SERVICES_TABS } from '@/lib/home-services-tabs';
import { HomeIndustriesTabs } from '@/components/homepage/HomeIndustriesTabs';
import { HOME_INDUSTRIES } from '@/lib/home-industries';
import { TOOLING_LOGOS } from '@/lib/home-tooling';
import { WORKFLOW_STEPS } from '@/lib/home-workflow';
import { TESTIMONIALS } from '@/lib/home-testimonials';
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
  const [categories, allServices, plans, industryPages] = await Promise.all([
    getServiceCategories(),
    getServices(),
    getSupportPlans(),
    getIndustryPages(),
  ]);

  // R2 Industries section: MediaTabs (Dental / Real Estate / Small Business).
  // Blurb = curated R2 copy (HOME_INDUSTRIES); illustration = industry_pages
  // row's image_url joined by slug (DB is SoT for imagery). Any industry whose
  // row is missing or image-less is dropped rather than rendering an empty panel.
  const industryBySlug = new Map(
    (industryPages as { slug: string; name: string; image_url: string | null }[]).map(
      (row) => [row.slug, row],
    ),
  );
  const industriesTabs = HOME_INDUSTRIES.map((industry) => {
    const row = industryBySlug.get(industry.slug);
    if (!row?.image_url) return null;
    return {
      id: industry.slug,
      label: industry.label,
      description: industry.description,
      imageUrl: row.image_url,
      alt: `${row.name} illustration`,
    };
  }).filter((tab): tab is NonNullable<typeof tab> => tab !== null);

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

      {/* ═══ Industries ("Where we do our best work") ═══ */}
      {/* R2 section (Figma node 25768:6527): MediaTabs peer selector (Dental /
          Real Estate / Small Business) + synced illustration panel. Blurbs from
          Homepage-R2 Notion; illustrations from industry_pages.image_url. */}
      {industriesTabs.length > 0 && (
        <section className="section-industries" data-section="industries">
          <div className="section-container">
            <SectionHeader title="Where we do our best work." />
            <HomeIndustriesTabs tabs={industriesTabs} />
          </div>
        </section>
      )}

      {/* ═══ Tooling ("Tools we know") ═══ */}
      {/* R2 section (Figma node 25768:6728 title + 25833:3022 logos): a
          left-aligned header over a single monochrome logo ticker (BDS
          Marquee), base.org "trusted by" style. Copy + tool list from the
          Homepage-R2 Notion doc. Only the 8 tools with a license-clean
          monochrome SVG render today; the other 13 are deferred (see
          home-tooling.ts). Marquee handles the seamless loop + the
          prefers-reduced-motion static-row fallback. */}
      <section className="section-tooling" data-section="tooling">
        <div className="section-container section-container--tooling">
          <SectionHeader
            align="start"
            title="Tools we know."
            description="These are the platforms we work in. We start with what you have — fill what's missing and cut what's not earning its cost."
          />
        </div>
        <Marquee className="tooling-marquee" logoHeight={36} pauseOnHover>
          {TOOLING_LOGOS.map((logo) => (
            <img
              key={logo.src}
              className="tooling-logo"
              src={logo.src}
              alt={logo.name}
              loading="lazy"
            />
          ))}
        </Marquee>
      </section>

      {/* ═══ Workflow ("Simple from day one") ═══ */}
      {/* R2 section (Figma node 25800:3081): three sequential engagement steps as
          an alternating timeline (content ⇄ media, row by row) over a BDS
          ZIndexMediaBand — the primitive owns the stacking recipe so the section
          need only supply content. Copy from the Homepage-R2 Notion doc
          ("Simple from day one."). One primary CTA at the section end (Notion is
          the content SoT — the placeholder Figma per-row buttons are ignored;
          design-decisions "one primary per surface"). The per-step illustration
          is deferred: the source graphic is placeholder art, so the media panel
          renders as a neutral tinted surface until real step art lands (#1073). */}
      <ZIndexMediaBand as="section" className="section-workflow" data-section="workflow">
        <div className="section-container">
          <SectionHeader title="Simple from day one." />
          <ol className="workflow-timeline">
            {WORKFLOW_STEPS.map((step, i) => (
              <li
                key={step.id}
                className="workflow-step"
                data-lead={i % 2 === 0 ? 'content' : 'media'}
              >
                <div className="workflow-step__body">
                  <span className="workflow-step__label">Step {i + 1}</span>
                  <h3 className="workflow-step__title">{step.title}</h3>
                  <p className="workflow-step__description">{step.description}</p>
                </div>
                <div className="workflow-step__media" aria-hidden="true" />
              </li>
            ))}
          </ol>
          <Button href="/offers/brikdown-analysis" variant="primary" size="lg">
            Get Your Free BrikDown — Start with Step 1
          </Button>
        </div>
      </ZIndexMediaBand>

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

      {/* ═══ Testimonials ("What clients say") ═══ */}
      {/* R2 section (Figma node 25157:16902): three alternating rows, each a
          client logo tile beside a quote + attribution, on the white
          --surface-primary band. PLACEHOLDER copy (TESTIMONIALS) — the R2 Notion
          doc reserves real quotes until 2–3 client engagements exist, so the
          bracketed template ships the structure without fabricating a client
          fact. Real quotes + client logos replace the placeholders before
          launch. Figma uses a `CardTestimonial`-shaped quote, but that BDS
          component is a vertical card with no logo/horizontal slot, so the row
          is hand-built (matches the Workflow alternating-row pattern above). */}
      <section className="section-testimonials" data-section="testimonials">
        <div className="section-container">
          <SectionHeader title="What clients say" />
          <ol className="testimonial-rows">
            {TESTIMONIALS.map((t, i) => (
              <li
                key={t.id}
                className="testimonial-row"
                data-lead={i % 2 === 0 ? 'media' : 'quote'}
              >
                <div className="testimonial-row__media" aria-hidden="true">
                  <span className="testimonial-row__logo-placeholder">Client logo</span>
                </div>
                <figure className="testimonial-row__body">
                  <blockquote className="testimonial-row__quote">{t.quote}</blockquote>
                  <figcaption className="testimonial-row__attribution">
                    <span className="testimonial-row__author">{t.authorName}</span>
                    <span className="testimonial-row__business">{t.businessType}</span>
                  </figcaption>
                </figure>
              </li>
            ))}
          </ol>
        </div>
      </section>

    </>
  );
}
