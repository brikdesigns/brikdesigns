import type { Metadata } from 'next';
import Link from 'next/link';
import { getServiceCategories, getServices, getSupportPlans, getIndustryPages, mapServiceLineSlug } from '@/lib/supabase/queries';
import { Grid, Button, Cluster, SectionHeader, Card, PricingCard, Image, Marquee, MediaBand, BackgroundPattern } from '@brikdesigns/bds';
import { HomeServicesTabs } from '@/components/homepage/HomeServicesTabs';
import { serviceCtaVars } from '@/lib/tokens';
import { HOME_SERVICES_TABS } from '@/lib/home-services-tabs';
import { HomeIndustriesTabs } from '@/components/homepage/HomeIndustriesTabs';
import { HOME_INDUSTRIES } from '@/lib/home-industries';
import { TOOLING_LOGOS } from '@/lib/home-tooling';
import { WORKFLOW_STEPS, WORKFLOW_IMAGE_WIDTHS } from '@/lib/home-workflow';
import { TESTIMONIALS } from '@/lib/home-testimonials';
import { routeSlugForServiceLine } from '@/lib/service-line-routes';
import { ScrollDownCta } from '@/components/ui/ScrollDownCta';
import './homepage.css';
import './shared-sections.css';

export const metadata: Metadata = { alternates: { canonical: '/' } };

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
              {/* on-color (white fill, dark ink) primary + white-outline secondary
                  on the brand-primary hero band — mirrors the cta-card-brand / HIW
                  CTA panels. A brand `primary`/`outline` would blend orange-on-poppy. */}
              <Button href="/offers/brikdown-analysis" variant="on-color" size="lg">
                Start with a Free BrikDown Analysis
              </Button>
              <Button
                href="/get-started"
                variant="outline"
                size="lg"
                className="hero-btn-on-dark"
              >
                See How We Work
              </Button>
            </Cluster>
          </div>
        </div>
        <ScrollDownCta />
      </section>

      {/* ═══ Problem ("Does this sound familiar?") ═══ */}
      <section className="section-problem" data-section="problems">
        <div className="section-container">
          {/* padding driven by CSS (--padding-xl) — BDS CardPadding caps at 'lg'
              (#1114); the .problem-card rule sets the xl inset. */}
          <Card padding="none" className="problem-card">
            <h2 className="problem__title">Does this sound familiar?</h2>
            <Grid columns={3} gap="huge">
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
          title="Sound like you?"
          description="That's exactly what we uncover in the BrikDown."
          actions={
            <Cluster gap="md" justify="center">
              <Button href="/offers/brikdown-analysis" variant="primary" size="lg">
                Schedule Your Free BrikDown
              </Button>
              {/* on-color (white fill, dark ink, theme-stable) — the accent band
                  is fixed-light in both themes, and a brand `outline` would put
                  orange-on-purple at ~1:1. Matches the Figma white secondary. */}
              <Button href="/get-started" variant="on-color" size="lg">
                See How We Work
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
            align="start"
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
          {/* Only 8 license-clean logos exist (13 deferred, see home-tooling.ts),
              so one pass is ~320px — far short of the viewport, leaving the row
              inset instead of edge-to-edge (#1093). Repeat the set so each
              Marquee group exceeds a wide desktop and the loop reads full-bleed
              and seamless. The duplicate group Marquee adds is aria-hidden, so
              the repeat only multiplies decorative copies, not announced items. */}
          {Array.from({ length: 6 }).flatMap((_, pass) =>
            TOOLING_LOGOS.map((logo) => (
              <img
                key={`${pass}-${logo.src}`}
                className="tooling-logo"
                src={logo.src}
                alt={logo.name}
                loading="lazy"
              />
            ))
          )}
        </Marquee>
      </section>

      {/* ═══ Workflow ("Simple from day one") ═══ */}
      {/* R2 section (Figma node 25800:3081): three sequential engagement steps as
          an alternating timeline (content ⇄ media, row by row) over a BDS
          MediaBand — the primitive owns the stacking recipe so the section
          need only supply content. Copy from the Homepage-R2 Notion doc
          ("Simple from day one."). One primary CTA at the section end (Notion is
          the content SoT — the placeholder Figma per-row buttons are ignored;
          design-decisions "one primary per surface"). Each step's media panel
          carries its design-source illustration in a 1:1 slot (#1073). The panel
          stays aria-hidden decoration — the step title + description carry the
          meaning — so the <img> is alt="". */}
      <MediaBand
        as="section"
        className="section-workflow"
        data-section="workflow"
        graphic={<BackgroundPattern variant="line-grid" />}
      >
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
                  {/* Label + title are one heading cluster (tight intra-gap);
                      the body gap controls the space from that cluster to the
                      description — group the text, then space the groups. See
                      page-anatomy.md § Grouping content into blocks. */}
                  <div className="workflow-step__header">
                    <span className="workflow-step__label">Step {i + 1}</span>
                    <h3 className="workflow-step__title">{step.title}</h3>
                  </div>
                  <p className="workflow-step__description">{step.description}</p>
                </div>
                <div className="workflow-step__media" aria-hidden="true">
                  <img
                    className="workflow-step__image"
                    src={`/images/workflow/${step.imageBase}_2x.webp`}
                    srcSet={WORKFLOW_IMAGE_WIDTHS.map(
                      (w, d) => `/images/workflow/${step.imageBase}_${d + 1}x.webp ${w}w`,
                    ).join(', ')}
                    /* Desktop: the panel is half of the ~1024px timeline. Below
                       991px the step stacks and the panel becomes a full-width
                       320px-tall band (see homepage.css), so the source width
                       needed still tracks the card width, not the height. */
                    sizes="(max-width: 991px) 100vw, 512px"
                    alt=""
                    loading="lazy"
                    decoding="async"
                  />
                </div>
              </li>
            ))}
          </ol>
          <Button href="/offers/brikdown-analysis" variant="primary" size="lg">
            Get Your Free BrikDown — Start with Step 1
          </Button>
        </div>
      </MediaBand>

      {/* ═══ Pricing ("Monthly Subscription") ═══ */}
      {/* R2 pricing band (Figma node 25768:7667): header (title + description +
          CTA) over 3 BDS PricingCards, on the brand band. Tiers come from
          getSupportPlans() (DB); the retired HomePlanCard path is gone here. */}
      <section className="section-pricing" data-section="pricing">
        <div className="section-container">
          <div className="pricing-header">
            <SectionHeader
              align="start"
              title="Monthly Subscription"
              description="We're more than a design studio—we're your strategic marketing partner."
            />
            <Button href="/offers/brikdown-analysis" variant="primary" size="lg">
              Get Your Free BrikDown
            </Button>
          </div>
          <Grid columns={3} gap="huge">
            {supportPlans.map((plan) => {
              // The per-card pale service-line tint R2 painted here (Figma node
              // 25768:7701) is retired by operator decision 2026-08-31 (#1169):
              // these cards take the plain --surface-primary card fill, which is
              // the BDS PricingCard default, so nothing is set here. The service
              // line still reads through the card's illustration and its themed
              // CTA. Removing the tint also retired the on-card text pin in
              // shared-sections.css — that pin only existed because the tint was
              // fixed-light in both themes; --surface-primary is not.
              const category = plan.service_line_slug
                ? mapServiceLineSlug(plan.service_line_slug)
                : null;
              // R3 (#1114): the "Learn More" primary is themed to the card's own
              // service line — serviceCtaVars() sets the brand-primary fill/ink
              // handoff vars and `.service-themed` opts the button into the
              // dark-mode fill rule (globals.css), the canonical service-button
              // path used on the service-detail pricing grid.
              const cardStyle = category ? serviceCtaVars(category) : undefined;
              return (
                <PricingCard
                  key={plan.slug}
                  className={category ? 'service-themed' : undefined}
                  title={plan.name}
                  price={plan.price}
                  period="/month"
                  description={plan.description}
                  style={cardStyle}
                  // Parent service-line illustration (card_image_url), the same
                  // square asset the service cards render; decorative here since
                  // the plan title names it (#454, #1001 join at supportPlans).
                  image={
                    plan.image_url ? (
                      <Image src={plan.image_url} alt="" ratio="1-1" fit="cover" />
                    ) : undefined
                  }
                  action={
                    <Button href={`/plans/${plan.slug}`} variant="primary" size="md">
                      Learn More
                    </Button>
                  }
                />
              );
            })}
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
                {/* Real client logomark when one exists, else the template
                    tile. The logo IS the client's name, so it takes an alt and
                    the tile is not aria-hidden in that branch. */}
                {t.logoSrc ? (
                  <div className="testimonial-row__media">
                    <img
                      className="testimonial-row__logo"
                      src={t.logoSrc}
                      alt={t.logoAlt}
                      loading="lazy"
                      decoding="async"
                    />
                  </div>
                ) : (
                  <div className="testimonial-row__media" aria-hidden="true">
                    <span className="testimonial-row__logo-placeholder">Client logo</span>
                  </div>
                )}
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
