import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Image from 'next/image';
import { getCategoryBySlug, getServicesByCategory, getServiceCategories, getSupportPlanBySlug, mapCategorySlug } from '@/lib/supabase/queries';
import { ServiceCard } from '@/components/marketing/ServiceCard';
import { hasIconFor } from '@/lib/service-icons';
import { Button, Breadcrumb, Card, Frame, Grid } from '@brikdesigns/bds';
import { text, heading } from '@/lib/styles';
import { color, gap, serviceColor } from '@/lib/tokens';
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

  // Other service lines (exclude current; top 3 by rank — rank drives display order in getServiceCategories)
  const otherCategories = allCategories.filter((c) => c.slug !== categorySlug).slice(0, 3);

  // Service-line color tokens.
  // --background-brand-primary is overridden at page level so ALL primary
  // buttons (hero, service cards, support CTA) inherit the service-line color
  // without needing per-button inline style — mirrors the service detail page pattern.
  const svcColors = serviceColor(mapCategorySlug(category.slug));

  return (
    // Page-level cascade: service-line accent text + primary button color.
    // Scoped to page content only — nav/footer live in the layout wrapper above this.
    <div style={{ '--background-brand-primary': svcColors.inverse, '--text-brand-primary': svcColors.text } as React.CSSProperties}>
      {/* ═══ Hero ═══ */}
      <section
        className="svc-detail-hero-section"
        style={{ backgroundColor: svcColors.surface }}
      >
        <div className="page-hero__container">
          <Breadcrumb
            style={{ marginBottom: gap.sm, flexWrap: 'wrap' }}
            items={[
              { label: 'Home', href: '/' },
              { label: 'Services', href: '/services' },
              { label: category.name },
            ]}
          />

          <div className="svc-detail-hero">
            <div className="svc-detail-hero__content">
              <h1 className="page-hero__title">{category.name}</h1>
              {category.tagline && (
                <p className="page-hero__tagline">{category.tagline}</p>
              )}
              {category.description && (
                <p className="page-hero__description">{category.description}</p>
              )}
              <div className="button-wrapper">
                <Button href="#services" variant="primary" size="lg">View Services</Button>
              </div>
            </div>

            {category.hero_image_url && (
              <div className="svc-detail-hero__aside">
                <div
                  className="svc-detail-hero__image"
                  style={{ backgroundColor: svcColors.surface }}
                >
                  <Image
                    src={category.hero_image_url}
                    alt={category.name}
                    fill
                    sizes="(max-width: 991px) 100vw, 45vw"
                    style={{ objectFit: 'contain' }}
                    priority
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ═══ Service Cards ═══ */}
      <section id="services" className="content-section" style={{ backgroundColor: svcColors.surface }}>
        <div className="container-lg container-lg--comfortable">
          <h2 style={{ ...heading.lg, textAlign: 'center', marginBottom: 'var(--gap-lg)' }}>
            {category.name} Services
          </h2>
          <Grid columns={3} gap="md">
            {services.map((svc) => {
              const cat = mapCategorySlug(category.slug);
              return (
                <ServiceCard
                  key={svc.slug}
                  name={svc.name}
                  slug={svc.slug}
                  categorySlug={categorySlug}
                  category={cat}
                  tagline={svc.tagline}
                  description={svc.description}
                  imageUrl={svc.image_url}
                  iconServiceName={hasIconFor(cat, svc.name) ? svc.name : undefined}
                  showCta
                />
              );
            })}
          </Grid>
        </div>
      </section>

      {/* ═══ Monthly Support CTA ═══
       * Left: supportPlan.image_url (the plan's own promo illustration)
       * Right card: category.card_image_url (the service-line character)
       */}
      {supportPlan && (
        <section className="content-section">
          <div className="container-lg container-lg--comfortable">
            <div className="content-wrapper content-wrapper--center content-wrapper--narrow">
              <h2 style={{ ...heading.md, textAlign: 'center' }}>Monthly support services</h2>
              <p style={{ ...text.body, color: color.text.secondary, textAlign: 'center' }}>
                Join our monthly support plan to get professional advice without the need for a team.
              </p>
            </div>
            <div className="svc-detail-support-grid">
              {supportPlan.image_url && (
                <div className="svc-detail-support-grid__image">
                  <Image
                    src={supportPlan.image_url}
                    alt=""
                    fill
                    sizes="(max-width: 991px) 100vw, 45vw"
                    style={{ objectFit: 'contain' }}
                  />
                </div>
              )}
              <div className="svc-detail-support-cta">
                {category.card_image_url && (
                  <div className="svc-detail-support-cta__image">
                    <Image
                      src={category.card_image_url}
                      alt={category.name}
                      fill
                      sizes="180px"
                      style={{ objectFit: 'contain' }}
                    />
                  </div>
                )}
                <h3 style={{ ...heading.sm, textAlign: 'center' }}>{supportPlan.name}</h3>
                <p style={{ ...text.bodySm, color: color.text.secondary, textAlign: 'center' }}>{supportPlan.description}</p>
                <Button href={`/plans#${supportPlan.slug}`} variant="primary" size="sm">Learn more</Button>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ═══ Other Service Lines ═══
       * Tile images use `card_image_url` (the 3D character illustration)
       * to match `/services`. `hero_image_url` is the large hero artwork —
       * scaled into a 3/2 tile slot it renders as a generic colored band
       * (parity #158).
       */}
      {otherCategories.length > 0 && (
        <section className="content-section content-section--accent">
          <div className="container-lg container-lg--comfortable">
            <h2 style={{ ...heading.md, textAlign: 'center', marginBottom: 'var(--gap-lg)' }}>
              Other Service Lines
            </h2>
            <Grid columns={3} gap="md">
              {otherCategories.map((cat) => (
                <Card
                  key={cat.slug}
                  preset="display"
                  href={`/services/${cat.slug}`}
                  title={cat.name}
                  description={cat.tagline ?? undefined}
                  image={
                    cat.card_image_url ? (
                      <Frame customRatio="3 / 2" fit="contain">
                        <Image src={cat.card_image_url} alt={cat.name} fill />
                      </Frame>
                    ) : undefined
                  }
                />
              ))}
            </Grid>
          </div>
        </section>
      )}
    </div>
  );
}
