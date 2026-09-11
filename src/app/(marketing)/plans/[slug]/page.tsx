import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getSupportPlanBySlug, mapServiceLineSlug } from '@/lib/supabase/queries';
import { Button, SectionHeader } from '@brikdesigns/bds';
import { serviceColor, serviceCtaVars } from '@/lib/tokens';
import { PlanCoverageRow } from './PlanCoverageRow';
import { PlanTierSection, type PlanTier } from './PlanTierSection';
import { PlanFullStackPanel } from './PlanFullStackPanel';
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

/**
 * `service_plan_coverage_items` — section-details' rows. A near-exact mirror
 * of the Foundation row above (migration 00395 § 1), so the shape is aliased
 * rather than re-declared: one contract, two lists on the same page.
 */
type CoverageItemRow = FoundationItemRow;

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

  // ── Service-line identity ──────────────────────────────────────────────
  // Prefer the authoritative display_line_id FK — the same column the /plans
  // index uses. PostgREST may return an embedded FK row as object or array.
  const rawDisplayLine = (plan as { display_line?: unknown }).display_line;
  const displayLine = Array.isArray(rawDisplayLine)
    ? ((rawDisplayLine[0] as { slug: string } | undefined) ?? null)
    : (rawDisplayLine as { slug: string } | null);

  // `service_plan_items` no longer RENDERS anything — the #3970 reshape below
  // replaced it — but it is still the fallback for a plan whose
  // `display_line_id` is unset: the dominant line across its catalogue rows.
  // Deduped by service slug, because a service joined twice would double-count
  // its line.
  const items = (plan.service_plan_items ?? []) as ServicePlanItemRow[];
  const planServiceLines: string[] = [];
  const seenServices = new Set<string>();
  for (const item of items.slice().sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))) {
    const svc = item.service;
    if (!svc || seenServices.has(svc.slug)) continue;
    seenServices.add(svc.slug);
    planServiceLines.push(svc.service_lines?.slug ?? '');
  }

  const lineCounts = new Map<string, number>();
  for (const s of planServiceLines) {
    lineCounts.set(s, (lineCounts.get(s) ?? 0) + 1);
  }
  let dominantLineSlug = planServiceLines[0] ?? '';
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

  // ── section-details (delta row 3) ──────────────────────────────────────
  // Notion's "What <plan> covers." bullets, from the table 00395 added for
  // exactly this list. Same row contract as the Foundation sibling above, so
  // both render through `PlanCoverageRow` (identical `card-vertical` geometry
  // in both Figma frames — PlanCoverageRow.tsx:6-8).
  const coverageItems = ((plan.service_plan_coverage_items ?? []) as CoverageItemRow[])
    .slice()
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

  // Free text on `service_plans`, the only column that can carry this frame's
  // lead paragraph. Notion authors it per plan ("Brik works across the full
  // marketing side of your business…"), so it is read, never interpolated —
  // a generated sentence here would fork the copy from its authority (#1303).
  const coverageDescription = (plan as { what_you_get?: string | null }).what_you_get;

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
       * left-aligned on a rounded accent-blue band. Today's build rendered all
       * three of those slots, so preserving them would have preserved exactly
       * what the design deletes. Reuses `.section-hero` + `.plans-hero`
       * (the accent-blue re-pin) rather than adding a ninth hero class (#1289).
       */}
      {/* `data-audience` is the page's declared service line, not a tint — the
          old BDS hero blueprint emitted it and `nav-service-tint.spec.ts`
          asserts the nav's tint agrees with it. The Figma band is accent-blue
          on EVERY plan, so the hero no longer carries a service colour, but the
          page's line identity is unchanged (it still drives the CTA cascade and
          the coverage-row fills) and the nav still tints from it. Dropping the
          attribute would have made the gate read "untinted page under a tinted
          nav" — a data claim, not the layout change this actually is. */}
      <section
        className="section-hero plans-hero plan-detail-hero"
        data-section="hero"
        data-audience={audience}
      >
        <div className="hero-container">
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
       * RESHAPE (delta row 3) — the last row of #1371's table, unblocked by
       * brik-client-portal#3970. It replaces `PlanIncludedServices`, which
       * rendered the 21-row `service_plan_items` catalogue behind a
       * SegmentedControl: never this frame's content, and the reason the
       * section measured 1562px against a designed 1039px.
       *
       * The frame is section-intro's composition with a section-level CTA and
       * no list heading, so it reuses that section's row column verbatim
       * (`.plan-coverage-list__items`, the 600px `content-col` cap) rather
       * than forking a second stacked-row vocabulary for one page.
       *
       * `data-section` now, not `aria-labelledby` — the old selector was
       * CardGrid's blueprint identity, and a plain `<section>` takes the
       * convention default (section-identification.md). The KEY is unchanged
       * so the Figma baseline and the slot manifest keep their lineage.
       */}
      {coverageItems.length > 0 && (
        <section className="page-section plan-details" data-section="what-you-get">
          <div className="container-lg container-lg--comfortable">
            <SectionHeader
              // Figma sets "What marketing support covers." — Notion's own
              // heading for this section. Interpolating the plan name renders
              // that string exactly on this plan and stays correct on the
              // others, the same technique section-intro uses above.
              title={`What ${plan.name.toLowerCase()} covers.`}
              description={coverageDescription ?? undefined}
              actions={
                // Figma's label reads "Get Your Free Brikdown"; the brand
                // spelling is Notion's "BrikDown" and the casing is the one
                // `PlanTierSection.tsx:122` already ships for this same
                // section-level CTA, one band down the page.
                <Button href={BRIKDOWN_HREF} size="lg">
                  Get your free BrikDown
                </Button>
              }
            />
            <div className="plan-coverage-list__items">
              {coverageItems.map((item) => (
                <PlanCoverageRow
                  key={item.title}
                  title={item.title}
                  // Notion authors these as bare bullets and Figma's second
                  // line is un-swapped placeholder in both frames, so this is
                  // null today (#1371 Q3). Passed through rather than dropped:
                  // the column exists and the row renders it when authored.
                  clause={item.clause}
                  iconKey={item.icon_key}
                  surfaceLight={audienceTokens.surfaceLight}
                />
              ))}
            </div>
          </div>
        </section>
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
