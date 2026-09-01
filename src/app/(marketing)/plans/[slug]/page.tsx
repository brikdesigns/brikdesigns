import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Image from 'next/image';
import {
  getSupportPlanBySlug,
  getOtherSupportPlans,
  mapServiceLineSlug,
} from '@/lib/supabase/queries';
import {
  Button,
  Card,
  CardGrid,
  Cluster,
  ContentBlock,
  Frame,
  Grid,
  Stack,
} from '@brikdesigns/bds';
import type { BlueprintSection } from '@brikdesigns/bds';
import { GetStartedModalButton } from '@/components/marketing/GetStartedModalButton';
import { PLAN_IMAGE_OVERRIDES } from '@/lib/plan-image-overrides';
import { PlanHeroModal } from './PlanHeroModal';
import { defaultClientFacts, defaultMarketingTheme } from '@/lib/blueprint-helpers';
import { color, serviceColor, serviceCtaVars, font } from '@/lib/tokens';
import { heading, text } from '@/lib/styles';
import { SERVICE_LINE_ICON } from '@/lib/service-icons';
import { PlanIncludedServices, type IncludedService } from './PlanIncludedServices';
import { PlanCardGrid } from '../PlanCardGrid';
import { ScrollDownCta } from '@/components/ui/ScrollDownCta';
import '../../shared-sections.css';
import '../plans.css';

type Props = { params: Promise<{ slug: string }> };

export const revalidate = 3600;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  try {
    const plan = await getSupportPlanBySlug(slug);
    return {
      title: `${plan.name} | Support Plans`,
      description: plan.description ?? undefined,
      alternates: { canonical: `/plans/${slug}` },
    };
  } catch {
    return { title: 'Plan Not Found' };
  }
}

interface ServicePlanItemRow {
  sort_order: number | null;
  service: {
    slug: string;
    name: string;
    description: string | null;
    image_url: string | null;
    service_lines: { slug: string; name: string } | null;
  } | null;
}

interface ServicePlanTierRow {
  name: string;
  description: string | null;
  monthly_price_display: string | null;
  annual_price_display: string | null;
  discount_label: string | null;
  included_scope: string | null;
  is_featured: boolean | null;
  sort_order: number | null;
}

function tierKeySlug(planSlug: string, tierName: string): string {
  const suffix = tierName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
  return `${planSlug}-${suffix}`;
}

export default async function PlanDetailPage({ params }: Props) {
  const { slug } = await params;

  let plan;
  try {
    plan = await getSupportPlanBySlug(slug);
  } catch {
    notFound();
  }

  const items = (plan.service_plan_items ?? []) as ServicePlanItemRow[];
  const sortedItems = items
    .slice()
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  const seenServices = new Map<string, IncludedService>();
  for (const item of sortedItems) {
    const svc = item.service;
    if (!svc || seenServices.has(svc.slug)) continue;
    const lineSlug = svc.service_lines?.slug ?? '';
    const category = mapServiceLineSlug(lineSlug);
    seenServices.set(svc.slug, {
      ...svc,
      category,
    });
  }
  const includedServices: IncludedService[] = Array.from(seenServices.values());

  // Prefer the authoritative display_line_id FK for visual identity —
  // the same column getOtherSupportPlans uses on the /plans list page.
  // PostgREST may return embedded FK rows as object or array; normalize both.
  const rawDisplayLine = (plan as { display_line?: unknown }).display_line;
  const displayLine = Array.isArray(rawDisplayLine)
    ? (rawDisplayLine[0] as { slug: string; name: string; card_image_url: string | null } | undefined) ?? null
    : (rawDisplayLine as { slug: string; name: string; card_image_url: string | null } | null);

  // Fall back to dominant-included-line heuristic when display_line_id is unset.
  const lineCounts = new Map<string, number>();
  for (const svc of includedServices) {
    const slug = svc.service_lines?.slug ?? '';
    lineCounts.set(slug, (lineCounts.get(slug) ?? 0) + 1);
  }
  let dominantLineSlug = includedServices[0]?.service_lines?.slug ?? '';
  let maxCount = 0;
  for (const [slug, count] of lineCounts) {
    if (count > maxCount) { maxCount = count; dominantLineSlug = slug; }
  }
  const dominantLineName =
    includedServices.find((s) => s.service_lines?.slug === dominantLineSlug)?.service_lines?.name ?? '';

  const audience = mapServiceLineSlug(displayLine?.slug ?? dominantLineSlug);
  const audienceTokens = serviceColor(audience);
  const firstLineName = displayLine?.name ?? dominantLineName;

  // Pricing tiers (#897) — rendered via the shared PlanCardGrid (monthly/annual
  // toggle + discount badge). Display strings are bare figures; PlanCardGrid
  // appends the "/month" · "/year" period. is_featured drives PricingCard's
  // highlighted treatment. Empty when the plan authored no tiers → section hidden.
  const tiers = (plan.service_plan_tiers ?? []) as ServicePlanTierRow[];
  const tierCards = tiers
    .slice()
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    .map((t) => ({
      name: t.name,
      slug: tierKeySlug(plan.slug, t.name),
      monthlyPrice: t.monthly_price_display ?? '',
      annualPrice: t.annual_price_display ?? null,
      discountLabel: t.discount_label,
      description: t.description ?? '',
      imageUrl: null,
      features: (t.included_scope ?? '')
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean),
      // null (not the audience slug): PlanCardGrid only uses serviceLineSlug to
      // inject a `--background-brand-primary: onLight` fill for the list page.
      // Here the tier cards sit inside the plan page's `.plan-detail-ctas`
      // cascade, which already pairs a pale service fill with AA-safe dark ink
      // (plans.css). Injecting the onLight fill would collide with that dark ink
      // (dark-on-dark "Get Started"). Letting it inherit keeps the button AA.
      serviceLineSlug: null,
      highlighted: Boolean(t.is_featured),
      ctaLabel: 'Get Started',
      ctaHref: `/get-started?plan=${plan.slug}`,
    }));

  const otherPlans = await getOtherSupportPlans(slug);

  // Hero mirrors services/[slug] — split column with priceCard overlay
  // driven by the same image source as the meganav + related-plans card:
  // the plan's display_line card_image_url (the single CMS source, #467).
  // The hero's own CTA lives inside the priceCard, so cta is null at the
  // section level (no duplicate "Get Started" buttons stacked).
  const heroImage = PLAN_IMAGE_OVERRIDES[plan.slug] ?? displayLine?.card_image_url ?? null;
  const heroSection: BlueprintSection = {
    sectionKey: `hero-${plan.slug}`,
    sectionType: 'hero',
    heading: plan.name,
    subheading: null,
    body: plan.description ?? null,
    cta: null,
    breadcrumb: [
      { label: 'Support Plans', href: '/plans' },
      { label: plan.name },
    ],
    audience,
    iconUrl: SERVICE_LINE_ICON[audience],
    iconAlt: `${firstLineName || audience} icon`,
    priceCard: heroImage
      ? {
          imageUrl: heroImage,
          imageAlt: plan.name,
          ...(plan.monthly_price_display && {
            priceLabel: 'Per month',
            price: plan.monthly_price_display,
          }),
          // Hero CTA opens the lead-capture modal via PlanHeroModal's
          // `onPriceCtaClick` (brik-bds#843, @brikdesigns/bds@0.101.0) — the
          // same modal the lower cta-panel button opens (#401). The `url` below
          // stays the rendered href, so it remains a working no-JS / direct-link
          // fallback to the standalone /get-started page.
          // `size: 'md'` opts into the priceCard.cta size hook added in
          // @brikdesigns/bds@0.95.0 (brik-bds#869); blueprint default is `sm`.
          cta: { label: 'Get Started', url: `/get-started?plan=${plan.slug}`, size: 'md' },
        }
      : undefined,
    visualNotes: {
      blueprintKey: 'hero_split_image_card_overlay',
      moodKeywords: [],
      layoutBlueprint: 'hero_split_image_card_overlay',
      imageOpportunity: null,
      animationSuggestion: null,
      illustrationOpportunity: null,
    },
    items: [],
  };

  return (
    // `service-themed` activates the shared service-CTA cascade in globals.css:
    // the hover/focus rules that hold the service fill (instead of flashing
    // poppy) and the #648 dark-mode `.service-themed .bds-button--primary` flip.
    // The flip is opt-in per CTA via `--service-cta-fill-dark`/`-ink-dark`; any
    // primary button that doesn't set them falls back to current behaviour, so
    // adding the class is a no-op for non-opted buttons. (BRIK-WEB)
    <div
      className="service-themed plan-detail-ctas"
      style={
        {
          // Primary CTAs on this plan page inherit the plan's service-line color
          // via the canonical service-CTA helper — deep `onLight` fill + the BDS
          // default white label (brikdesigns#1001, mirrors services/[serviceLineSlug]).
          // `--background-inverse` keeps any inverse-variant CTA on the pale `bg`
          // fill, paired with dark ink by the retained `.plan-detail-ctas
          // .bds-button--inverse` rule in plans.css.
          ...serviceCtaVars(audience),
          '--background-inverse': audienceTokens.bg,
        } as React.CSSProperties
      }
    >
      {/* ═══ Hero ═══ */}
      <div
        className="page-hero-blueprint"
        data-scroll-hero
        style={
          {
            '--bds-hero-padding-y': 'var(--padding-huge)',
            // Section-level service-line tint — `surface` family, pale `-light`
            // tone per service-token-decision-tree.md Q2 (the hero is a broad
            // container; pale surface pairs with darkest on-light text at AAA,
            // brik-bds#838). Mirrors the now-pale services/[slug] hero (#389)
            // so all interior heros read as one continuous surface band; the
            // BDS blueprint SECTION (`section.bds-hero--with-pricing-card`) defers to this
            // via the `.page-hero-blueprint .bds-hero--with-pricing-card` override in
            // shared-sections.css (no two-tone seam). (#408)
            backgroundColor: audienceTokens.surfaceLight,
            // Interior-hero CARD surface — the nested `aside.bds-hero__media-card`,
            // NOT this section. The `--bds-hero-media-bg` hook scopes the ADR-012
            // service `-inverse` token to the card only: white in light → `{hue}-darkest`
            // in dark; BDS recalibrates the card text per theme (AA, brik-bds#1020). (BRIK-WEB-52)
            '--bds-hero-media-bg': audienceTokens.inverse,
          } as React.CSSProperties
        }
      >
        <PlanHeroModal
          section={heroSection}
          clientFacts={defaultClientFacts}
          theme={defaultMarketingTheme}
          plan={plan.slug}
          planName={plan.name}
          serviceLine={audience}
          {...(plan.description ? { description: plan.description } : {})}
        />
        <ScrollDownCta />
      </div>

      {/* ═══ Pricing tiers ═══
       * Titled section shell (CardGrid) wrapping the shared PlanCardGrid — one
       * BDS PricingCard per tier with the monthly/annual toggle. Sits ABOVE
       * "What You Get" (#927): the fixed Advisory/Managed tiers are the plan's
       * headline offer, so price leads. Hidden entirely when the plan has no
       * tiers, so single-price plans are unchanged.
       */}
      {tierCards.length > 0 && (
        <CardGrid sectionKey="plan-tiers" title="Pricing">
          <PlanCardGrid plans={tierCards} columns={2} />
        </CardGrid>
      )}

      {/* ═══ What You Get ═══ */}
      {includedServices.length > 0 && (
        <PlanIncludedServices services={includedServices} surfaceInverse={audienceTokens.inverse} />
      )}

      {/* ═══ CTA — two-column support-plan panel (Webflow parity) ═══
       * Surface-service-tinted panel carrying the plan's marketing
       * illustration on the left and a neutral price/CTA card on the right.
       * Panel tone is the dominant service-line pale `surfaceLight` tint
       * (matches the hero band above, #408); the inner elevated card stays
       * neutral so the price + button read as the focal element (mirrors the
       * live Webflow support-plan CTA).
       */}
      <section
        className="page-section"
        // Band carries the plan's pale service tint (`surface-service-*-light`,
        // fixed-light in both themes) so the whole CTA section reads service-themed;
        // the panel below goes neutral (transparent) so the white elevated price/CTA
        // card is the single focal contrast against the tint rather than the tint
        // stacking on itself. (dynamic hue → inline, not plans.css)
        style={{ backgroundColor: audienceTokens.surfaceLight }}
      >
        <div className="container-lg container-lg--comfortable">
          <div className="plan-cta-panel">
            {heroImage && (
              <div className="plan-cta-panel__media">
                <Image
                  src={heroImage}
                  alt=""
                  fill
                  sizes="320px"
                  style={{ objectFit: 'contain' }}
                />
              </div>
            )}
            <Card
              variant="elevated"
              padding="lg"
              className="plan-cta-panel__card"
              // Service `-inverse` surface: white in light (focal price card stays
              // neutral on the pale panel) → `{hue}-darkest` in dark (carries the
              // plan's line identity). Shadow keeps it lifted off the panel band.
              // `--service-cta-fill-dark`/`-ink-dark`: the Get-Started CTA inside
              // sits on this inverse card; flip it to the pale `onDark` step +
              // deep `text` ink in dark mode so it pops on the `{hue}-darkest`
              // card (#648). Light mode unchanged. (BRIK-WEB)
              style={{ backgroundColor: audienceTokens.inverse, '--service-cta-fill-dark': audienceTokens.onDark, '--service-cta-ink-dark': audienceTokens.text } as React.CSSProperties}
            >
              <Stack align="center" style={{ textAlign: 'center' }}>
                {/* "Get" reads inline with the plan name as one title
                    (e.g. "Get Product Design Support") rather than a separate
                    eyebrow kicker. size="md" (25px) mirrors the service-detail
                    bottom-CTA plan name. */}
                <ContentBlock
                  size="md"
                  titleAs="h2"
                  title={<>Get {plan.name}</>}
                  {...(plan.description ? { description: plan.description } : {})}
                />
                {plan.monthly_price_display && (
                  <div
                    // `service-surface` pins inherited text dark on this
                    // fixed-light tint (the pale surface is `-light` in BOTH
                    // themes), so the "per month" caption (--text-secondary,
                    // which is light grey in dark theme) stays AA — the #360
                    // fixed-on-fixed-light pattern. The price figure sets its
                    // own service ink explicitly, so it's unaffected.
                    className="plan-cta-panel__price service-surface"
                    // Price inset carries the plan's pale service tint
                    // (`surface-service-*-light`) instead of the neutral
                    // `--surface-secondary`, so the focal figure reads as
                    // service-themed. Set here (not in plans.css) because the
                    // hue is per-plan/dynamic.
                    style={{ backgroundColor: audienceTokens.surfaceLight }}
                  >
                    {/* Price = display-md figure in the plan's service ink
                        (`text-service-*-on-light`), AA on the pale `-light`
                        inset above. */}
                    <p style={{ ...heading.md, fontSize: font.size.heading.xLarge, color: audienceTokens.text, textAlign: 'center', margin: 0 }}>
                      {plan.monthly_price_display}
                    </p>
                    <p style={{ ...text.bodySm, color: color.text.secondary, textAlign: 'center', margin: 0 }}>
                      per month
                    </p>
                  </div>
                )}
                <Cluster gap="md" justify="center">
                  <GetStartedModalButton plan={plan.slug} planName={plan.name} serviceLine={audience} {...(plan.description ? { description: plan.description } : {})} />
                </Cluster>
              </Stack>
            </Card>
          </div>
        </div>
      </section>

      {/* ═══ Other Support Plans ═══
       * Simple image + title + description + Learn More — matches Webflow.
       * No price / no PricingCard chrome (those are reserved for the /plans
       * list page where prices are part of the selling proposition).
       */}
      {otherPlans.length > 0 && (
        <CardGrid sectionKey="other-plans" title="Other Support Plans">
          {/* gap="lg" across all 3-col display-card grids — retires the #674 /
              BACKLOG-415 gap="md" normalization, which was tied to the now-removed
              card-chrome-on-tint standard. */}
          <Grid columns={3} gap="lg">
            {otherPlans.map((other) => {
              // Each card's CTA uses that plan's own service-line color (dynamic),
              // not the current page's — overrides the page-level default. #343
              const rawOtherLine = (other as { display_line?: unknown }).display_line;
              const otherLine = Array.isArray(rawOtherLine) ? rawOtherLine[0] : rawOtherLine;
              // Card illustration = that plan's service-line card_image_url (the
              // single CMS source, #467).
              const otherImage =
                PLAN_IMAGE_OVERRIDES[other.slug] ??
                (otherLine as { card_image_url?: string | null } | null)?.card_image_url ?? null;
              const otherSlug = (otherLine as { slug?: string } | null)?.slug
                ? mapServiceLineSlug((otherLine as { slug: string }).slug)
                : audience;
              const otherTokens = (otherLine as { slug?: string } | null)?.slug
                ? serviceColor(otherSlug)
                : null;
              // Resolve the card hue once — its OWN line, falling back to the
              // page line — and drive both the `-inverse` surface and the CTA
              // off it so the button always matches its card.
              const cardTokens = otherTokens ?? audienceTokens;
              // Service `-inverse` surface, scoped to each card's OWN line
              // (matching the Learn More button hue below). This is a no-op in
              // light mode — `-inverse` resolves to white, the same neutral fill
              // the staging review locked in when it dropped the light-mode
              // per-plan tint (#397, backlog #278 / #482) — and only carries the
              // deep `{hue}-darkest` band in dark mode. (BRIK-WEB)
              return (
              <Card
                key={other.slug}
                preset="display"
                className="display-card--title-sm"
                style={{ backgroundColor: cardTokens.inverse }}
                image={
                  otherImage ? (
                    <Frame customRatio="3 / 2" fit="contain" className="illustration-media-bg">
                      <Image
                        src={otherImage}
                        alt={other.name}
                        width={400}
                        height={267}
                      />
                    </Frame>
                  ) : undefined
                }
                title={other.name}
                description={other.description ?? undefined}
                action={
                  <Button
                    href={`/plans/${other.slug}`}
                    variant="primary"
                    size="md"
                    // Canonical service-CTA cascade (brikdesigns#1001): deep `onLight`
                    // fill + white label in light mode; the `-dark` handoff flips it to
                    // the pale `onDark` step + deep `text` ink in dark mode so it pops
                    // on the card's `{hue}-darkest` `-inverse` surface (#648).
                    style={serviceCtaVars(otherSlug)}
                  >
                    Learn More
                  </Button>
                }
              />
              );
            })}
          </Grid>
        </CardGrid>
      )}
    </div>
  );
}
