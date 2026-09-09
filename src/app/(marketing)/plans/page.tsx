import type { Metadata } from 'next';
import {
  Button,
  Card,
  CardDescription,
  CardTitle,
  Cluster,
  Grid,
  Image,
  PricingCard,
  SectionHeader,
} from '@brikdesigns/bds';
import { Icon } from '@/lib/icon';
import { getManagedPlanPrices, getSupportPlans, mapServiceLineSlug } from '@/lib/supabase/queries';
import { PLAN_IMAGE_OVERRIDES } from '@/lib/plan-image-overrides';
import { serviceColor, serviceCtaVars } from '@/lib/tokens';
import '../shared-sections.css';
// Reuses the home page's `.section-hero` / `.hero-*` / `.pricing-header` section
// scaffolding rather than re-authoring it here — the same cross-page CSS import
// `/blog` uses to reach `.section-container` / `.section-plans` (blog/page.tsx).
import '../homepage.css';
import './plans.css';

export const metadata: Metadata = {
  alternates: { canonical: '/plans' },
  title: 'Support Plans | Monthly Marketing & Design Subscriptions',
  description:
    'Brik handles marketing, back office, or both — for dental practices, real estate firms, and small businesses. Start with a free BrikDown Analysis and choose the engagement that fits.',
};

export const revalidate = 3600;

const BRIKDOWN_HREF = '/offers/brikdown-analysis';

// The three engagement paths, in the order the content doc presents them (Notion
// "Support Plans" → "Choose your path"): Full Stack first as the recommendation,
// then the two stand-alone sides. DB `rank` orders by marketing/back-office/
// product/full-stack, which is the plan-detail ordering, not this page's argument.
const PATH_SLUGS = ['full-stack-support', 'marketing-support', 'back-office-support'] as const;

// Full Stack is the recommendation, and Figma carries that emphasis on the card
// FILL, never on a border (node 26103:10414 — `surface/service-brand-light`,
// while 10415/10416 take `surface/primary`; all three share one border). #1304
// removed the `highlighted` prop that had reinstated a poppy ring here: the
// operator ratified "3 equal paths" in the #1287 session, so a ring that re-ranks
// the cards is the rejected hierarchy, and a Notion body-copy sentence is not a
// decision that can restore it.
const RECOMMENDED_SLUG = 'full-stack-support';

// Step-3 engagement modes (Notion "Advisory or Managed — you choose how involved
// Brik is."). Copy only — the price split lives on the plan cards above, sourced
// from `service_plan_tiers`.
//
// Titles are Notion's, not Figma's. Figma reads "Advisory (you execute)" /
// "Managed (we execute)" (nodes 26103:10991 / 10993), but Figma owns layout and
// style while Notion owns copy (design-ground-truth-workflow.md, #1303) — and
// each description already says who executes, so the parenthetical is redundant
// as well as unratified.
//
// `accent` keys the icon chip's fill/ink pair in plans.css. Figma gives the two
// chips DIFFERENT token families rather than one tinted pair — advisory takes
// the mid `background/service-brand`, managed the deep
// `background/service-back-office-on-light` — so each is declared by name there
// instead of derived from a single formula.
const ENGAGEMENT_MODES = [
  {
    id: 'advisory',
    accent: 'brand',
    title: 'Advisory',
    description: 'Brik builds the strategy and direction. Your team executes.',
  },
  {
    id: 'managed',
    accent: 'back-office',
    title: 'Managed',
    description: 'Brik handles execution. You review and approve.',
  },
] as const;

export default async function PlansPage() {
  // Two cached reads, joined by slug: `getSupportPlans` carries the copy + the
  // marketing-line illustration; `getManagedPlanPrices` embeds every public tier
  // (its name is narrower than its select). The DB is the pricing SoT (#1123) —
  // no price literal on this page.
  const [rawPlans, tierRows] = await Promise.all([getSupportPlans(), getManagedPlanPrices()]);

  const tiersBySlug = new Map(
    tierRows.map((row) => [
      row.slug,
      {
        advisory: row.service_plan_tiers.find((t) => t.name === 'Advisory')?.monthly_price_display ?? null,
        managed: row.service_plan_tiers.find((t) => t.name === 'Managed')?.monthly_price_display ?? null,
      },
    ]),
  );

  const bySlug = new Map(rawPlans.map((plan) => [plan.slug as string, plan]));

  const paths = PATH_SLUGS.map((slug) => {
    const plan = bySlug.get(slug);
    if (!plan) return null;

    // Same display_line normalization as the plan detail page: PostgREST returns
    // the embed as object or array, and the marketing-line illustration wins over
    // the plan's own image (#454), with a per-plan override on top (#467).
    const rawLine = (plan as { display_line?: unknown }).display_line;
    const displayLine = Array.isArray(rawLine)
      ? (rawLine[0] as { slug: string | null; card_image_url: string | null } | undefined) ?? null
      : (rawLine as { slug: string | null; card_image_url: string | null } | null);
    const lineSlug = displayLine?.slug ?? null;
    const tiers = tiersBySlug.get(slug) ?? { advisory: null, managed: null };

    return {
      slug,
      name: plan.name as string,
      description: (plan.description as string | null) ?? '',
      imageUrl:
        PLAN_IMAGE_OVERRIDES[slug] ?? displayLine?.card_image_url ?? (plan.image_url as string | null) ?? null,
      category: lineSlug ? mapServiceLineSlug(lineSlug) : null,
      // Entry price for the card headline is the Advisory tier (the lower-commitment
      // side); the Managed figure rides the feature list so both are visible without
      // a second card. Falls back to the plan-level price when a tier is missing.
      price: tiers.advisory ?? (plan.monthly_price_display as string | null) ?? 'Contact',
      managedPrice: tiers.managed,
    };
  }).filter((p): p is NonNullable<typeof p> => p !== null);

  // section-type band: the back-office service tint. Figma paints #ffe8dc on this
  // frame, which is `--surface-service-back-office-light` exactly — so the band is
  // the canonical `.service-surface` treatment (card chrome + on-band text pin
  // already handled in shared-sections.css) rather than a new bespoke band class.
  const modeBandTokens = serviceColor('back-office');

  return (
    <>
      {/* ═══ Hero ═══ */}
      {/* Figma node 26103:9457 — the home hero's rounded inset container on the
       * pale blue band (`surface/accent-blue` #bfe2fe, token-identical to
       * --surface-accent-blue). `.hero-container` pins its inherited ink white for
       * the poppy home band; `.plans-hero` re-pins it dark, because white on
       * #bfe2fe is ~1.3:1 — the same AA correction #1127 made on the HIW hero. */}
      <section className="section-hero plans-hero" data-section="hero">
        <div className="hero-container">
          <div className="hero-layout">
            <div className="hero-text">
              <h1 className="hero-title">Two sides of the business. One team to run them.</h1>
              <p className="hero-description">
                Brik handles marketing, back office, or both — for dental practices, real estate
                firms, and small businesses. Every engagement starts with the same free 60-minute
                BrikDown Analysis. From there, you choose how deep you want us involved.
              </p>
            </div>
            <Cluster gap="md" className="hero-button-wrapper">
              <Button href={BRIKDOWN_HREF} variant="primary" size="lg">
                Start with a free BrikDown
              </Button>
            </Cluster>
          </div>
        </div>
      </section>

      {/* ═══ Choose your path ═══ */}
      {/* Figma node 26103:10406 — header row (SectionHeader intro left, brand CTA
       * right) over three plan cards, on the white `--surface-primary` band. The
       * header row is the home page's `.pricing-header`; the band is the shared
       * `.page-section` default, where a card's bordered BDS default is already the
       * correct chrome (card-treatment.md) so no override is declared. */}
      {paths.length > 0 && (
        <section className="page-section" data-section="paths">
          <div className="container-lg container-lg--comfortable">
            <div className="pricing-header pricing-header--top">
              <SectionHeader
                align="start"
                title="Choose your path."
                description="Full Stack is what we recommend — marketing and back office working together is where the real impact happens. Your marketing brings in leads; your systems make sure none of them fall through. But if you want to start with one side, both are available as stand-alone engagements."
              />
              <Button href={BRIKDOWN_HREF} variant="primary" size="lg">
                Get your free BrikDown
              </Button>
            </div>
            <Grid columns={3} gap="huge">
              {paths.map((path) => (
                <PricingCard
                  key={path.slug}
                  title={path.name}
                  price={path.price}
                  period="/month advisory"
                  description={path.description}
                  {...(path.managedPrice ? { features: [`Managed — ${path.managedPrice}/month`] } : {})}
                  className={[
                    path.category ? 'service-themed' : null,
                    path.slug === RECOMMENDED_SLUG ? 'plans-path-card--recommended' : null,
                  ]
                    .filter(Boolean)
                    .join(' ') || undefined}
                  {...(path.category ? { style: serviceCtaVars(path.category) } : {})}
                  image={
                    path.imageUrl ? <Image src={path.imageUrl} alt="" ratio="1-1" fit="cover" /> : undefined
                  }
                  action={
                    <Button href={`/plans/${path.slug}`} variant="primary" size="md">
                      See {path.name}
                    </Button>
                  }
                />
              ))}
            </Grid>
          </div>
        </section>
      )}

      {/* ═══ Advisory or Managed ═══ */}
      {/* Figma node 26103:10983 — header row over two mode cards on the back-office
       * service tint. `.service-surface` carries the tinted-band card chrome
       * (shadow, no border) and the dark on-band text pin; the fill is set inline
       * from the token bundle, the canonical service-band pattern used on
       * /services/[serviceLineSlug] (page.tsx:132). */}
      <section
        className="page-section service-surface"
        data-section="engagement-modes"
        style={{ backgroundColor: modeBandTokens.surfaceLight }}
      >
        <div className="container-lg container-lg--comfortable">
          <div className="pricing-header pricing-header--top">
            <SectionHeader
              align="start"
              title="Advisory or Managed — you choose how involved Brik is."
              description="Both start with the same Foundation. Both are month-to-month. Not sure which fits? The BrikDown tells us — and then we tell you."
            />
            <Button href="/how-we-work" variant="primary" size="lg">
              See how it works
            </Button>
          </div>
          <Grid columns={2} gap="lg">
            {ENGAGEMENT_MODES.map((mode) => (
              <Card key={mode.id} padding="lg">
                {/* Designed slot restored (#1304). Figma draws a Font Awesome
                 * trowel here, but FA is Figma-only — code is on Phosphor, which
                 * has no trowel or brick glyph (0 hits across all 9,161). So the
                 * chip's geometry and token pair come from Figma, and the glyph
                 * is the nearest Phosphor read of the same masonry motif. Purely
                 * decorative — the same mark repeats on every card and carries no
                 * per-mode meaning, so it is hidden from assistive tech. */}
                <span
                  className="engagement-mode__chip"
                  data-accent={mode.accent}
                  aria-hidden="true"
                >
                  <Icon icon="ph:stack-fill" width={16} height={16} />
                </span>
                <CardTitle>{mode.title}</CardTitle>
                <CardDescription>{mode.description}</CardDescription>
              </Card>
            ))}
          </Grid>
        </div>
      </section>

      {/* ═══ BrikDown CTA ═══ */}
      {/* Figma node 26103:9578 — the shared brand CTA panel, reused verbatim
       * (`.cta-section-brand` / `.cta-card-brand`, shared-sections.css) with the
       * `SectionHeader onColor` + `actions` composition the /results index uses. */}
      <section className="cta-section-brand" data-section="cta">
        <div className="cta-card-brand">
          <SectionHeader
            onColor
            title="Not sure where to start? That's what the BrikDown is for."
            description="We work with a focused number of clients at a time so every engagement gets our full attention. You work directly with Abbey and Nick — not a coordinator or rotating team. We'll review your marketing, systems, and back office — then tell you exactly which engagement makes sense and why. No commitment. Just clarity."
            actions={
              <Button href={BRIKDOWN_HREF} variant="on-color" size="lg">
                Schedule your BrikDown
              </Button>
            }
          />
        </div>
      </section>
    </>
  );
}
