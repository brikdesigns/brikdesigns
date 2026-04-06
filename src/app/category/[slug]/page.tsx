/**
 * Support Plan Detail Page — CMS template
 *
 * URL: /category/[slug] (e.g., /category/marketing-support)
 * Transcribed from Paper artboard "Support Plan — Marketing Support"
 *
 * Color logic: The plan's PRIMARY service line drives all colors.
 * For marketing-support, Marketing Design is primary (green).
 * service_lines.support_plan_slug → plan slug resolves the relationship.
 *
 * Conditional logic:
 * - "What You Get" tabs: shows all service lines that reference this plan
 * - "Other Plans": shows support plans that aren't the current one
 */
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import {
  getSupportPlanBySlug,
  getSupportPlans,
  getServiceLinesForPlan,
  mapCategorySlug,
} from '@/lib/supabase/queries';
import { WhatYouGet } from './WhatYouGet';
import '../../shared-sections.css';
import '../../services/services.css';

type Props = { params: Promise<{ slug: string }> };

export const revalidate = 3600;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  try {
    const plan = await getSupportPlanBySlug(slug);
    return { title: `${plan.name} | Support Plans`, description: plan.description || undefined };
  } catch {
    return { title: 'Support Plan' };
  }
}

export default async function SupportPlanPage({ params }: Props) {
  const { slug } = await params;

  let plan;
  try {
    plan = await getSupportPlanBySlug(slug);
  } catch {
    notFound();
  }

  // Get service lines that reference this plan (for tabs + colors)
  const serviceLines = await getServiceLinesForPlan(slug);

  // Primary service line — the one whose name best matches the plan name.
  // e.g., "Marketing Support" → "Marketing Design" (contains "Marketing")
  // Falls back to first service line if no match found.
  const primaryLine = serviceLines.find((sl) => {
    const planWord = plan.name.replace(' Support', '').toLowerCase();
    return sl.name.toLowerCase().includes(planWord);
  }) || serviceLines[0] || null;
  const colorLight = primaryLine?.brand_color_light || '#bcff8c';
  const colorBase = primaryLine?.brand_color_base || '#9ada6c';
  const colorDark = primaryLine?.brand_color_dark || '#2a5542';
  const cardImageUrl = primaryLine?.card_image_url || null;
  const supportIllustrationUrl = primaryLine?.support_plan_image_url || plan.image_url || null;

  // Other support plans
  const allPlans = await getSupportPlans();
  const otherPlans = allPlans.filter((p) => p.slug !== slug);

  // For other plans, resolve their brand colors from service_lines
  // Each other plan needs its primary service line's colors for the button
  const otherPlansWithColors = await Promise.all(
    otherPlans.map(async (p) => {
      const pLines = await getServiceLinesForPlan(p.slug);
      const pPrimary = pLines[0];
      return {
        ...p,
        colorLight: pPrimary?.brand_color_light || '#f1f0ec',
        colorDark: pPrimary?.brand_color_dark || '#1b1b1b',
        cardImageUrl: pPrimary?.card_image_url || null,
      };
    })
  );

  // Build tab data — primary line first, then the rest
  const sortedLines = primaryLine
    ? [primaryLine, ...serviceLines.filter((sl) => sl.slug !== primaryLine.slug)]
    : serviceLines;

  const tabs = sortedLines.map((sl) => ({
    name: sl.name,
    slug: sl.slug,
    category: mapCategorySlug(sl.slug),
    services: (sl.services || []).map((svc: { slug: string; name: string; description: string | null; image_url: string | null; primary_badge_url: string | null }) => ({
      slug: svc.slug,
      name: svc.name,
      description: svc.description,
      image_url: svc.image_url,
      primary_badge_url: svc.primary_badge_url,
    })),
  }));

  return (
    <>
      {/* ═══ Section 1: Hero (dark bg from brand dark color) ═══ */}
      <section className="svc-page__hero" style={{ backgroundColor: colorDark }}>
        <div className="container-lg">
          {/* Breadcrumb */}
          <div className="svc-page__breadcrumb">
            <Link href="/plans" style={{ color: '#fff', textDecoration: 'none' }}>
              <span className="text-body-md">Support Plans</span>
            </Link>
            <span className="text-body-md" style={{ color: '#fff' }}>/</span>
            <span className="text-body-md" style={{ color: '#fff' }}>{plan.name}</span>
          </div>

          {/* 2-col layout */}
          <div className="svc-page__hero-grid">
            {/* LEFT: title + description + button */}
            <div className="svc-page__hero-left">
              <h1 className="text-display-sm" style={{ color: '#fff' }}>{plan.name}</h1>
              {plan.description && (
                <p className="text-body-lg" style={{ color: '#fff' }}>{plan.description}</p>
              )}
              <div className="svc-page__buttons">
                <a href="#services" className="svc-page__btn-primary" style={{ backgroundColor: colorLight, color: colorDark }}>
                  View Details
                </a>
              </div>
            </div>

            {/* RIGHT: white price card (image + price + button inside) */}
            <div className="svc-page__hero-right">
              <div className="svc-page__price-card">
                {cardImageUrl && (
                  <div className="svc-page__img-frame">
                    <Image src={cardImageUrl} alt={plan.name} width={400} height={400} priority style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                )}
                <div className="svc-page__price-text">
                  <span className="text-body-lg" style={{ color: '#828282' }}>Per month</span>
                  <span className="text-heading-lg">{plan.monthly_price_display || plan.price_display}</span>
                </div>
                <div className="svc-page__buttons">
                  <a href="/contact" className="svc-page__btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
                    Get Started
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ Section 2: What You Get (tabbed, client component) ═══ */}
      {tabs.length > 0 && (
        <WhatYouGet
          tabs={tabs}
          colorDark={colorDark}
          colorLight={colorLight}
          colorBase={colorBase}
        />
      )}

      {/* ═══ Section 3: CTA (green bg with inner pricing card) ═══ */}
      <section className="svc-page__section" style={{ backgroundColor: colorLight, paddingTop: 0 }}>
        <div className="container-lg">
          <div style={{ display: 'flex', background: colorBase, borderRadius: '16px', overflow: 'hidden', width: '100%' }}>
            {/* LEFT: illustration */}
            {supportIllustrationUrl && (
              <div style={{ flex: '0 0 40%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
                <Image src={supportIllustrationUrl} alt={plan.name} width={500} height={500} style={{ width: '100%', height: 'auto', objectFit: 'cover' }} />
              </div>
            )}
            {/* RIGHT: white inner card */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '24px', padding: '48px 36px', background: '#fff', borderRadius: '16px', margin: '16px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', textAlign: 'center' }}>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <h2 className="text-heading-md">Get</h2>
                  <h2 className="text-heading-md">{plan.name}</h2>
                </div>
                <p className="text-body-md text--center">{plan.description}</p>
              </div>
              {/* Pricing highlight */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', background: '#f1f0ec', borderRadius: '12px', padding: '24px 32px' }}>
                <span className="text-heading-xl">{plan.monthly_price_display || plan.price_display}</span>
                <span className="text-body-lg">per month</span>
                <p className="text-body-sm text--secondary text--center" style={{ maxWidth: '300px' }}>
                  One monthly fee. No juggling freelancers or doing it yourself. Limited spots available.
                </p>
              </div>
              <a href="/contact" className="svc-page__btn-primary">Get Started</a>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ Section 4: Other Support Plans — conditional ═══ */}
      {otherPlansWithColors.length > 0 && (
        <section className="svc-page__section" style={{ backgroundColor: '#fff' }}>
          <div className="container-lg" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '36px' }}>
            <h2 className="text-heading-xl text--center">Other Support Plans</h2>
            <div style={{ display: 'flex', gap: '16px', width: '100%', maxWidth: '900px' }}>
              {otherPlansWithColors.map((p) => (
                <Link
                  key={p.slug}
                  href={`/category/${p.slug}`}
                  style={{ display: 'flex', flexDirection: 'column', gap: '16px', flex: 1, background: '#fff', borderRadius: '12px', padding: '16px', border: '1px solid #e0e0e0', textDecoration: 'none', color: 'inherit' }}
                >
                  {p.cardImageUrl && (
                    <div style={{ width: '100%', aspectRatio: '3/2', borderRadius: '8px', overflow: 'hidden', background: '#f5f5f3' }}>
                      <Image src={p.cardImageUrl} alt={p.name} width={400} height={267} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                  )}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <span className="text-heading-sm">{p.name}</span>
                    <span className="text-body-sm text--secondary">{p.description}</span>
                  </div>
                  <span className="svc-page__btn-primary" style={{ backgroundColor: p.colorLight, color: p.colorDark, alignSelf: 'flex-start' }}>
                    Learn More
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}
    </>
  );
}
