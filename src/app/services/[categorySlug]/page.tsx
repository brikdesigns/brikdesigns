import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { getCategoryBySlug, getServicesByCategory, getServiceCategories, getSupportPlanBySlug, mapCategorySlug } from '@/lib/supabase/queries';
import { ServiceCard } from '@/components/marketing/ServiceCard';
import { ServiceBadgeLabel } from '@/components/marketing/ServiceBadgeLabel';
import { LinkButton } from '@bds/components/ui/Button/LinkButton';
import '../../shared-sections.css';
import '../services.css';

type Props = { params: Promise<{ categorySlug: string }> };

export const revalidate = 3600;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { categorySlug } = await params;
  try {
    const cat = await getCategoryBySlug(categorySlug);
    return { title: `${cat.name} | Design Services`, description: cat.tagline || cat.description || undefined };
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

  // Support plan — scoped to this category's plan
  let supportPlan = null;
  if (category.support_plan_slug) {
    try {
      supportPlan = await getSupportPlanBySlug(category.support_plan_slug);
    } catch {
      supportPlan = null;
    }
  }

  // Other service lines (exclude current category)
  const otherCategories = allCategories.filter((c) => c.slug !== categorySlug);

  const brandColorLight = category.brand_color_light || null;

  return (
    <>
      {/* ═══ Hero ═══ */}
      <section
        className="svc-detail-hero-section"
        style={brandColorLight ? { backgroundColor: brandColorLight } as React.CSSProperties : undefined}
      >
        <div className="page-hero__container">
          <p className="page-hero__breadcrumb">
            <Link href="/services">All Services</Link> / {category.name}
          </p>

          <div className="svc-detail-hero">
            <div className="svc-detail-hero__content">
              <ServiceBadgeLabel category={mapCategorySlug(category.slug)} />
              <h1 className="page-hero__title">{category.name}</h1>
              {category.tagline && (
                <p className="page-hero__tagline">{category.tagline}</p>
              )}
              {category.description && (
                <p className="page-hero__description">{category.description}</p>
              )}
              <div className="button-wrapper">
                <LinkButton href="#services" variant="primary" size="md">View Services</LinkButton>
              </div>
            </div>

            {category.hero_image_url && (
              <div className="svc-detail-hero__aside">
                <div
                  className="svc-detail-hero__image"
                  style={brandColorLight ? { backgroundColor: brandColorLight } as React.CSSProperties : undefined}
                >
                  <Image
                    src={category.hero_image_url}
                    alt={category.name}
                    width={560}
                    height={560}
                    priority
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ═══ Service Cards ═══ */}
      <section id="services" className="content-section content-section--secondary">
        <div className="container-lg container-lg--comfortable">
          <h2 className="text-heading-lg text--center" style={{ marginBottom: 'var(--gap-lg)' }}>
            {category.name} Services
          </h2>
          <div className="grid-3">
            {services.map((svc) => (
              <ServiceCard
                key={svc.slug}
                name={svc.name}
                slug={svc.slug}
                categorySlug={categorySlug}
                category={mapCategorySlug(category.slug)}
                tagline={svc.tagline}
                description={svc.marketing_description}
                imageUrl={svc.image_url}
                showCta
              />
            ))}
          </div>
        </div>
      </section>

      {/* ═══ Monthly Support CTA ═══ */}
      {supportPlan && (
        <section className="content-section">
          <div className="container-lg container-lg--comfortable">
            <div className="content-wrapper content-wrapper--center content-wrapper--narrow">
              <h2 className="text-heading-md text--center">Monthly support services</h2>
              <p className="text-body-md text--secondary text--center">
                Join our monthly support plan to get professional advice without the need for a team.
              </p>
            </div>
            <div className="svc-detail-support-cta">
              <h3 className="text-heading-sm">{supportPlan.name}</h3>
              <p className="text-body-sm text--secondary">{supportPlan.description}</p>
              <LinkButton href={`/plans#${supportPlan.slug}`} variant="primary" size="sm">Learn more</LinkButton>
            </div>
          </div>
        </section>
      )}

      {/* ═══ Other Service Lines ═══ */}
      {otherCategories.length > 0 && (
        <section className="content-section content-section--accent">
          <div className="container-lg container-lg--comfortable">
            <h2 className="text-heading-md text--center" style={{ marginBottom: 'var(--gap-lg)' }}>
              Other Design Services
            </h2>
            <div className="svc-category-others">
              {otherCategories.map((cat) => (
                <Link key={cat.slug} href={`/services/${cat.slug}`} className="svc-category-other-card">
                  {cat.hero_image_url && (
                    <div className="svc-category-other-card__image">
                      <Image src={cat.hero_image_url} alt={cat.name} width={300} height={200} />
                    </div>
                  )}
                  <h3 className="text-heading-sm">{cat.name}</h3>
                  {cat.tagline && <p className="text-body-sm text--secondary">{cat.tagline}</p>}
                  <span className="bds-button bds-button--secondary bds-button--sm" style={{ alignSelf: 'flex-start', marginTop: 'auto' }}>
                    Learn more
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
