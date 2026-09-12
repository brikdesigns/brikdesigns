import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getSupportPlanBySlug, mapServiceLineSlug } from '@/lib/supabase/queries';
import { Button, SectionHeader } from '@brikdesigns/bds';
import { serviceColor, serviceCtaVars } from '@/lib/tokens';
import { PlanCoverageRow } from './PlanCoverageRow';
import { PlanTierSection, type PlanTier } from './PlanTierSection';
import { PlanFullStackPanel } from './PlanFullStackPanel';
import { PlanIncludedServices, type IncludedService } from './PlanIncludedServices';
import '../../shared-sections.css';
// `.section-hero` / `.hero-*` and `.pricing-header` live in homepage.css — the
// sanctioned cross-page import (marketing-section-reuse.md), the same one
// /blog and the /plans index already use. Adding the class without the import
// renders the section unstyled with no build error.
import '../../homepage.css';
import '../plans.css';

type Props = { params: Promise<{ slug: string }> };

export const revalidate = 3600;

const BRIKDOWN_HREF = '/offers/brikdown';

/** Future partner page — see the operator quote in PlanFullStackPanel. */
const PARTNER_HREF = '/partners';

/** The plan whose page must not cross-sell itself. */
const FULL_STACK_SLUG = 'full-stack-support';

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
  who_executes: string | null;
  cta_label: string | null;
}

interface FoundationItemRow {
  title: string;
  clause: string | null;
  icon_key: string | null;
  sort_order: number | null;
}

function tierKeySlug(planSlug: string, tierName: string): string {
  const suffix = tierName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
  return `${planSlug}-${suffix}`;
}

/**
 * Advisory takes `brand`, Managed takes `back-office` — the asymmetric split
 * Figma draws (`26144:9107` / `26144:9108`) and #1304 already landed on the
 * /plans index. Keyed off the tier NAME rather than `lens`, which the public
 * read does not select; falls back to alternating so a third tier still gets
 * a defined accent.
 */
function tierAccent(name: string, index: number): 'brand' | 'back-office' {
  const n = name.toLowerCase();
  if (n.includes('advisory')) return 'brand';
  if (n.includes('managed')) return 'back-office';
  return index % 2 === 0 ? 'brand' : 'back-office';
}

export default async function PlanDetailPage({ params }: Props) {
  const { slug } = await params;

  let plan;
  try {
    plan = await getSupportPlanBySlug(slug);
  } catch {
    notFound();
  }

  // ── Included services (section-details, interim) ───────────────────────
  // NOT the Figma coverage list. `service_plan_items` is a join to `services`
  // and holds 21 catalogue rows for marketing-support across three service
  // lines; Figma's `section-details` wants Notion's six coverage bullets, none
  // of which exists as a service. That table is
  // brikdesigns/brik-client-portal#3970 — until it lands this slot keeps the
  // existing component, in its NEW position (delta row 3 is the one row of
  // #1371's table not yet reshaped).
  const items = (plan.service_plan_items ?? []) as ServicePlanItemRow[];
  const sortedItems = items.slice().sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  const seenServices = new Map<string, IncludedService>();
  for (const item of sortedItems) {
    const svc = item.service;
    if (!svc || seenServices.has(svc.slug)) continue;
    seenServices.set(svc.slug, {
      ...svc,
      category: mapServiceLineSlug(svc.service_lines?.slug ?? ''),
    });
  }
  const includedServices: IncludedService[] = Array.from(seenServices.values());

  // ── Service-line identity ──────────────────────────────────────────────
  // Prefer the authoritative display_line_id FK — the same column the /plans
  // index uses. PostgREST may return an embedded FK row as object or array.
  const rawDisplayLine = (plan as { display_line?: unknown }).display_line;
  const displayLine = Array.isArray(rawDisplayLine)
    ? ((rawDisplayLine[0] as { slug: string } | undefined) ?? null)
    : (rawDisplayLine as { slug: string } | null);

  const lineCounts = new Map<string, number>();
  for (const svc of includedServices) {
    const s = svc.service_lines?.slug ?? '';
    lineCounts.set(s, (lineCounts.get(s) ?? 0) + 1);
  }
  let dominantLineSlug = includedServices[0]?.service_lines?.slug ?? '';
  let maxCount = 0;
  for (const [s, count] of lineCounts) {
    if (count > maxCount) {
      maxCount = count;
      dominantLineSlug = s;
    }
  }

  const audience = mapServiceLineSlug(displayLine?.slug ?? dominantLineSlug);
  const audienceTokens = serviceColor(audience);

  // ── section-intro (delta row 2) ────────────────────────────────────────
  const foundationItems = ((plan.service_plan_foundation_items ?? []) as FoundationItemRow[])
    .slice()
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

  // The Foundation figure is a CMS column, never a literal — the DB is the
  // pricing SoT (#1123), and hardcoding Figma's "$2,500" would fork it per
  // plan. Satisfies the /plans/[slug] half of #1386.
  const foundationPrice = (plan as { foundation_price_display?: string | null })
    .foundation_price_display;

  // ── section-type (delta rows 4 + 5) ────────────────────────────────────
  const tiers = (plan.service_plan_tiers ?? []) as ServicePlanTierRow[];
  const tierCards: PlanTier[] = tiers
    .slice()
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    .map((t, i) => ({
      name: t.name,
      slug: tierKeySlug(plan.slug, t.name),
      monthlyPrice: t.monthly_price_display ?? '',
      annualPrice: t.annual_price_display ?? null,
      description: t.description ?? '',
      whoExecutes: t.who_executes,
      // CMS-authored per tier (migration 00391). Falls back to a generic label
      // so a tier authored before that column existed still renders a named
      // CTA rather than an empty button. The tier CTA opens the lead-capture
      // modal (#1400), so the old `cta_href` navigation target is unused.
      ctaLabel: t.cta_label ?? 'Get started',
      accent: tierAccent(t.name, i),
    }));

  return (
    // `service-themed` activates the shared service-CTA cascade in globals.css:
    // the hover/focus rules that hold the service fill and the #648 dark-mode
    // primary flip.
    <div
      className="service-themed plan-detail-ctas"
      style={
        {
          ...serviceCtaVars(audience),
          '--background-inverse': audienceTokens.bg,
        } as React.CSSProperties
      }
    >
      {/* ═══ 1. section-hero — Figma 26144:9053 ═══
       * RESHAPE, not "keep" (#1371 comment 2026-09-10 18:35). The design has
       * NO price card, NO image and NO hero CTA — title + description only,
       * left-aligned on a rounded band. Today's build rendered all three of
       * those slots, so preserving them would have preserved exactly what the
       * design deletes. Reuses `.section-hero` + `.plans-hero` rather than
       * adding a ninth hero class (#1289).
       */}
      {/* Band fill follows the page's service line (#1474). The hero-container
          background is overridden inline to the line's `surfaceLight` tint —
          the same per-line band the /services heroes
          (services/[serviceLineSlug]/page.tsx) and this page's coverage rows
          already use. This REVERSES the "accent-blue on EVERY plan" band #1371
          shipped, on operator directive:
          OPERATOR SAID 2026-09-12 (chat): "Tint heroes per service line."
          The /plans index hero keeps `--surface-accent-blue`. The Figma node
          still draws accent-blue, so `visual-figma` flags this section until the
          design is updated — do NOT re-baseline to clear it.
          Ink stays the mode-invariant grayscale-950 pin from
          `.plans-hero .hero-container` (plans.css): the service `surfaceLight`
          tints are fixed-light in both themes, so dark ink clears AA on all five
          lines exactly as it did on accent-blue.
          `data-audience` is the page's declared service line — the BDS hero
          blueprint emits it, `nav-service-tint.spec.ts` asserts the nav tint
          agrees with it, and it drives the CTA cascade + coverage-row fills. */}
      <section
        className="section-hero plans-hero plan-detail-hero"
        data-section="hero"
        data-audience={audience}
      >
        <div className="hero-container" style={{ backgroundColor: audienceTokens.surfaceLight }}>
          <div className="hero-layout">
            <div className="hero-text">
              <h1 className="hero-title">{plan.name}</h1>
              {plan.description && <p className="hero-description">{plan.description}</p>}
            </div>
          </div>
        </div>
      </section>

      {/* ═══ 2. section-intro — Figma 26144:9055 ═══
       * ADD. Title + description + "What the Foundation covers:" + the stacked
       * row cards. Copy is the Notion plan page's Foundation section, with the
       * plan name and the CMS Foundation figure interpolated so it reads
       * correctly on every plan rather than hardcoding the Marketing wording.
       */}
      <section className="page-section plan-intro" data-section="foundation">
        <div className="container-lg container-lg--comfortable">
          <SectionHeader
            title="Before we build, we learn."
            description={
              foundationPrice
                ? `Every ${plan.name} engagement begins with a ${foundationPrice} Foundation Investment. This is how we get to know your business, your brand, and your goals well enough to actually run your marketing.`
                : `Every ${plan.name} engagement begins with a Foundation Investment. This is how we get to know your business, your brand, and your goals well enough to actually run your marketing.`
            }
          />
          {foundationItems.length > 0 && (
            <div className="plan-coverage-list">
              {/* Verbatim Notion copy — the plan pages' content SoT authors
                  this line in sentence case ("**What the Foundation covers:**",
                  Marketing Support Plan) and Figma sets it the same way, so
                  title-casing it here would fork the copy from its authority. */}
              <h3 className="plan-coverage-list__title">What the Foundation covers:</h3> {/* lint-heading-case-ignore */}
              <div className="plan-coverage-list__items">
                {foundationItems.map((item) => (
                  <PlanCoverageRow
                    key={item.title}
                    title={item.title}
                    clause={item.clause}
                    iconKey={item.icon_key}
                    surfaceLight={audienceTokens.surfaceLight}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ═══ 3. section-details — Figma 26144:9066 ═══
       * Delta row 3, NOT yet reshaped — see the note on `includedServices`
       * above. It moves to its Figma position now; the reshape follows
       * brikdesigns/brik-client-portal#3970.
       */}
      {includedServices.length > 0 && (
        <PlanIncludedServices
          services={includedServices}
          surfaceInverse={audienceTokens.inverse}
        />
      )}

      {/* ═══ 4 + 5. billing toggle, then section-type — Figma 26144:9099 ═══ */}
      {tierCards.length > 0 && (
        <PlanTierSection
          tiers={tierCards}
          bandSurface={serviceColor('back-office').surfaceLight}
          headerTitle="Advisory or Managed — you choose how involved Brik is."
          headerDescription="Let's start with the BrikDown Analysis to find out."
          brikdownHref={BRIKDOWN_HREF}
          planSlug={plan.slug}
          planName={plan.name}
          serviceLine={audience}
        />
      )}

      {/* ═══ 6. section-full-stack — Figma 26144:9109 ═══
       * REPLACES the old `.plan-cta-panel`. Suppressed on the Full Stack page
       * itself, which would otherwise cross-sell the plan you are reading.
       */}
      {plan.slug !== FULL_STACK_SLUG && (
        <PlanFullStackPanel href={PARTNER_HREF} serviceLine={audience} />
      )}

      {/* ═══ 7. section-cta — Figma 26144:9140 ═══
       * ADD. The shared brand CTA panel reused verbatim per the delta table —
       * same `.cta-section-brand` / `.cta-card-brand` composition, and the same
       * copy, the /plans index already ships for this frame.
       */}
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
    </div>
  );
}
