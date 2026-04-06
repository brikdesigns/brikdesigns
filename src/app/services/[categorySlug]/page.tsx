/**
 * Service Line (Category) Page — CMS template
 *
 * Transcribed from Paper artboard "Service Line — Back Office Design"
 * which was built from Webflow source HTML sections:
 * section_hero, section-description, section_support-plan, section_other-services.
 *
 * Color logic: brand_color_light/base/dark from service_lines table drives
 * hero bg, service card buttons, and other-services card bg colors.
 *
 * Conditional logic:
 * - Services grid: always shown (every category has services)
 * - Support plan: only if category.support_plan_slug is set
 * - Other Service Lines: only if there are other public categories
 */
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import {
  getCategoryBySlug,
  getServicesByCategory,
  getServiceCategories,
  getSupportPlanBySlug,
  mapCategorySlug,
} from '@/lib/supabase/queries';
import { ServiceBadge } from '@/components/marketing/ServiceBadgeClient';
import { ServiceJsonLd, BreadcrumbJsonLd } from '@/components/seo/JsonLd';
import '../../shared-sections.css';
import '../services.css';

type Props = { params: Promise<{ categorySlug: string }> };

export const revalidate = 3600;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { categorySlug } = await params;
  try {
    const cat = await getCategoryBySlug(categorySlug);
    return {
      title: `${cat.name} | Design Services`,
      description: cat.tagline || cat.description || undefined,
      alternates: { canonical: `/services/${categorySlug}` },
      openGraph: {
        title: `${cat.name} | Design Services`,
        description: cat.tagline || cat.description || undefined,
        images: cat.hero_image_url ? [{ url: cat.hero_image_url, alt: cat.name }] : undefined,
      },
    };
  } catch {
    return { title: 'Services' };
  }
}

export default async function ServiceCategoryPage({ params }: Props) {
  const { categorySlug } = await params;

  let category;
  try {
    category = await getCategoryBySlug(categorySlug);
  } catch {
    notFound();
  }

  const [services, allCategories] = await Promise.all([
    getServicesByCategory(category.id),
    getServiceCategories(),
  ]);

  // Support plan — conditional: only if this category has one
  let supportPlan = null;
  if (category.support_plan_slug) {
    try {
      supportPlan = await getSupportPlanBySlug(category.support_plan_slug);
    } catch {
      supportPlan = null;
    }
  }

  // Other service lines — exclude current
  const otherCategories = allCategories.filter((c) => c.slug !== categorySlug);

  // Brand color triplet from service_lines DB
  const colorLight = category.brand_color_light || '#f1f0ec';
  const colorBase = category.brand_color_base || '#828282';
  const colorDark = category.brand_color_dark || '#1b1b1b';
  const bdsCat = mapCategorySlug(category.slug);

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://brikdesigns.com';

  return (
    <>
      <ServiceJsonLd
        name={category.name}
        description={category.tagline || category.description || ''}
        url={`${siteUrl}/services/${categorySlug}`}
        image={category.hero_image_url || undefined}
        category="Design Services"
      />
      <BreadcrumbJsonLd items={[
        { name: 'Home', url: siteUrl },
        { name: 'Services', url: `${siteUrl}/services` },
        { name: category.name, url: `${siteUrl}/services/${categorySlug}` },
      ]} />
      {/* ═══ Section 1: Hero ═══ */}
      <section className="svc-page__hero" style={{ backgroundColor: colorLight }}>
        <div className="container-lg">
          {/* Breadcrumb — left-aligned */}
          <div className="svc-page__breadcrumb">
            <Link href="/services" style={{ color: colorDark, textDecoration: 'none' }}>
              <span className="text-body-lg">All Services</span>
            </Link>
            <span className="text-body-lg" style={{ color: colorDark }}>/</span>
            <span className="text-body-lg" style={{ color: colorBase }}>{category.name}</span>
          </div>

          {/* 2-col layout */}
          <div className="svc-page__hero-grid">
            {/* LEFT: title + description + button */}
            <div className="svc-page__hero-left">
              <h1 className="text-display-sm" style={{ color: colorDark }}>{category.name}</h1>
              {category.description && (
                <p className="text-body-huge" style={{ color: colorDark }}>{category.description}</p>
              )}
              <div className="svc-page__buttons">
                <a href="#services" className="svc-page__btn-primary" style={{ backgroundColor: colorDark, color: '#fff' }}>
                  View Services
                </a>
              </div>
            </div>

            {/* RIGHT: hero image (no card wrapper) */}
            {category.hero_image_url && (
              <div className="svc-page__hero-right" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Image
                  src={category.hero_image_url}
                  alt={category.name}
                  width={560}
                  height={560}
                  priority
                  style={{ width: '100%', height: 'auto', objectFit: 'cover' }}
                />
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ═══ Section 2: Services Grid ═══ */}
      <section id="services" className="svc-page__section" style={{ backgroundColor: colorLight }}>
        <div className="container-lg">
          <div className="svc-page__heading-row" style={{ marginBottom: '36px' }}>
            <h2 className="text-heading-lg" style={{ color: colorDark }}>{category.name}</h2>
            <h2 className="text-heading-lg" style={{ color: colorDark }}>Services</h2>
          </div>

          <div className="svc-page__grid-3">
            {services.map((svc) => (
              <Link key={svc.slug} href={`/services/${categorySlug}/${svc.slug}`} className="svc-page__sibling-card">
                {/* Image frame */}
                <div className="svc-page__img-frame">
                  {svc.image_url && (
                    <Image src={svc.image_url} alt={svc.name} width={400} height={400} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  )}
                </div>
                {/* Badge icon */}
                {svc.primary_badge_url ? (
                  <Image src={svc.primary_badge_url} alt="" width={32} height={32} style={{ objectFit: 'cover' }} />
                ) : (
                  <ServiceBadge category={bdsCat} serviceName={svc.name} size="md" />
                )}
                {/* Content */}
                <div className="svc-page__sibling-content">
                  <h3 className="text-heading-sm">{svc.name}</h3>
                  <p className="text-body-md">{svc.tagline || svc.description}</p>
                </div>
                {/* Button — uses brand light bg with dark text (matches Webflow) */}
                <div className="svc-page__buttons">
                  <span className="svc-page__btn-primary" style={{ backgroundColor: colorLight, color: colorDark }}>
                    Learn more
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ Section 3: Monthly Support — conditional on support_plan_slug ═══ */}
      {supportPlan && (
        <section className="svc-page__section" style={{ backgroundColor: '#fff' }}>
          <div className="container-lg">
            <div className="svc-page__section-header">
              <h2 className="text-heading-lg text--center">Monthly support services</h2>
              <p className="text-body-md text--center">
                Join our monthly support plan to get professional advice without the need for a team.
              </p>
            </div>

            {/* 2-col: illustration left, support card right */}
            <div className="svc-page__support-row">
              {/* LEFT: large illustration from service_lines.support_plan_image_url */}
              {category.support_plan_image_url && (
                <div className="svc-page__support-illustration">
                  <Image
                    src={category.support_plan_image_url}
                    alt={category.name}
                    width={500}
                    height={500}
                    style={{ width: '100%', height: 'auto', objectFit: 'cover' }}
                  />
                </div>
              )}

              {/* RIGHT: accent card — uses card_image_url for small image */}
              <div className="svc-page__support-card" style={{ backgroundColor: '#f1f0ec' }}>
                {category.card_image_url && (
                  <div className="svc-page__support-card-img">
                    <Image src={category.card_image_url} alt={supportPlan.name} width={120} height={120} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                )}
                <h3 className="text-heading-md text--center">{supportPlan.name}</h3>
                <p className="text-body-md text--center">{supportPlan.description}</p>
                <Link href={`/plans#${supportPlan.slug}`} className="svc-page__btn-primary" style={{ backgroundColor: colorDark, color: '#fff' }}>
                  Learn more
                </Link>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ═══ Section 4: Other Service Lines — conditional on other categories existing ═══ */}
      {otherCategories.length > 0 && (
        <section className="svc-page__section svc-page__support-section">
          <div className="container-lg">
            <h2 className="text-heading-lg text--center" style={{ color: '#fff', marginBottom: '36px' }}>
              Other Service Lines
            </h2>

            <div className="svc-page__grid-3">
              {otherCategories.map((cat) => (
                <Link
                  key={cat.slug}
                  href={`/services/${cat.slug}`}
                  className="svc-page__sibling-card"
                  style={{ backgroundColor: cat.brand_color_light || '#f1f0ec' }}
                >
                  {/* Image frame */}
                  <div className="svc-page__img-frame" style={{ backgroundColor: 'rgba(255,255,255,0.5)' }}>
                    {cat.card_image_url && (
                      <Image src={cat.card_image_url} alt={cat.name} width={400} height={400} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    )}
                  </div>
                  {/* Badge — secondary SVG */}
                  {cat.secondary_badge_url ? (
                    <Image src={cat.secondary_badge_url} alt="" width={32} height={32} style={{ objectFit: 'cover' }} />
                  ) : (
                    <ServiceBadge category={mapCategorySlug(cat.slug)} size="md" />
                  )}
                  {/* Content */}
                  <div className="svc-page__sibling-content">
                    <h4 className="text-heading-sm">{cat.name}</h4>
                    <p className="text-body-md">{cat.tagline}</p>
                  </div>
                  {/* Button — dark variant per category */}
                  <div className="svc-page__buttons">
                    <span className="svc-page__btn-primary" style={{ backgroundColor: cat.brand_color_dark || '#1b1b1b', color: '#fff' }}>
                      Learn more
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}
    </>
  );
}
