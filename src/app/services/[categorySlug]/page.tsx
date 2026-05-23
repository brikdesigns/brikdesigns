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

  // Service-line color tokens — surface for backgrounds, bg/text for button overrides
  const svcColors = serviceColor(mapCategorySlug(category.slug));

  return (
    <>
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
                <Button
                  href="#services"
                  variant="primary"
                  size="lg"
                  style={{ backgroundColor: svcColors.bg, color: svcColors.text, borderColor: svcColors.bg }}
                >
                  View Services
                </Button>
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
                    width={460}
                    height={460}
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

      {/* ═══ Monthly Support CTA ═══ */}
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
              {category.hero_image_url && (
                <div className="svc-detail-support-grid__image">
                  <Image
                    src={category.hero_image_url}
                    alt=""
                    width={460}
                    height={460}
                    style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                  />
                </div>
              )}
              <div className="svc-detail-support-cta">
                {supportPlan.image_url && (
                  <div className="svc-detail-support-cta__image">
                    <Image
                      src={supportPlan.image_url}
                      alt={supportPlan.name}
                      width={200}
                      height={200}
                      style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                    />
                  </div>
                )}
                <h3 style={{ ...heading.sm, textAlign: 'center' }}>{supportPlan.name}</h3>
                <p style={{ ...text.bodySm, color: color.text.secondary, textAlign: 'center' }}>{supportPlan.description}</p>
                <Button
                  href={`/plans#${supportPlan.slug}`}
                  variant="primary"
                  size="sm"
                  style={{ backgroundColor: svcColors.bg, color: svcColors.text, borderColor: svcColors.bg }}
                >
                  Learn more
                </Button>
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
    </>
  );
}
