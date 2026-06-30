import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Image from 'next/image';
import { getServiceLineBySlug, getServicesByServiceLine, getServiceCategories, getSupportPlanBySlug, mapServiceLineSlug } from '@/lib/supabase/queries';
import { routeSlugForServiceLine } from '@/lib/service-line-routes';
import { ServiceCard } from '@/components/marketing/ServiceCard';
import { hasIconFor } from '@/lib/service-icons';
import { ScrollDownCta } from '@/components/ui/ScrollDownCta';
import { Button, Breadcrumb, Card, Frame, Grid, LinkButton, ServiceTag } from '@brikdesigns/bds';
import { text, heading } from '@/lib/styles';
import { color, gap, serviceColor } from '@/lib/tokens';
import '../../shared-sections.css';
import '../services.css';

type Props = { params: Promise<{ serviceLineSlug: string }> };

export const revalidate = 3600;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { serviceLineSlug } = await params;
  try {
    const line = await getServiceLineBySlug(serviceLineSlug);
    return { title: `${line.name} | Design Services`, description: line.tagline || line.description || undefined };
  } catch {
    return { title: 'Services' };
  }
}

export default async function ServiceLinePage({ params }: Props) {
  const { serviceLineSlug } = await params;

  let serviceLine;
  try {
    serviceLine = await getServiceLineBySlug(serviceLineSlug);
  } catch {
    notFound();
  }

  const [services, allServiceLines] = await Promise.all([
    getServicesByServiceLine(serviceLine.id),
    getServiceCategories(),
  ]);

  // Support plan — scoped to this service line's plan
  let supportPlan = null;
  if (serviceLine.support_plan_slug) {
    try {
      supportPlan = await getSupportPlanBySlug(serviceLine.support_plan_slug);
    } catch {
      supportPlan = null;
    }
  }

  // Other service lines (exclude current; top 3 by rank — rank drives display order in getServiceCategories).
  // Compare against the resolved row's DB slug, not the route param: the
  // back-office route slug ('back-office') differs from its DB slug ('service'),
  // so filtering on serviceLineSlug would fail to exclude the current line.
  const otherServiceLines = allServiceLines.filter((c) => c.slug !== serviceLine.slug).slice(0, 3);

  // Resolve the service line this support plan belongs to. A plan slug is
  // prefixed with its line slug (e.g. "marketing-support-plan" → marketing).
  // Multiple service lines can reference the same plan; deriving from the slug
  // ensures the card always shows the correct service-line image and colors.
  const supportPlanServiceLine = allServiceLines.find(
    (c) => (serviceLine.support_plan_slug ?? '').startsWith(c.slug)
  ) ?? serviceLine;
  const supportPlanServiceLineColors = serviceColor(mapServiceLineSlug(supportPlanServiceLine.slug));

  // Service-line color tokens.
  // --background-brand-primary is overridden at page level so ALL primary
  // buttons (hero, service cards, support CTA) inherit the service-line color
  // without needing per-button inline style — mirrors the service detail page pattern.
  const audience = mapServiceLineSlug(serviceLine.slug);
  const svcColors = serviceColor(audience);

  return (
    // Page-level cascade: service-line accent text + primary button color.
    // Scoped to page content only — nav/footer live in the layout wrapper above this.
    // `data-audience` activates BDS's `[data-audience='X'] .bds-breadcrumb`
    // cascade (brik-bds#781) — currently no-op here (no breadcrumb on the
    // service-line index), but stays consistent with the service-detail page
    // pattern so a future breadcrumb addition picks up the audience tint.
    <div data-audience={audience} className="service-themed" style={{ '--background-brand-primary': svcColors.onLight, '--text-brand-primary': svcColors.text } as React.CSSProperties}>
      {/* ═══ Hero ═══ */}
      <section
        className="page-hero service-surface"
        data-scroll-hero
        style={{ backgroundColor: svcColors.surfaceLight }}
      >
        <div className="page-hero__container">
          <div className="service-detail-hero">
            <div className="service-detail-hero__content">
              <Breadcrumb
                style={{ flexWrap: 'wrap' }}
                items={[
                  { label: 'Services', href: '/services' },
                  { label: serviceLine.name },
                ]}
              />
              <h1 className="page-hero__title" style={{ color: svcColors.text }}>{serviceLine.name}</h1>
              {serviceLine.description && (
                <p className="page-hero__description">{serviceLine.description}</p>
              )}
              <div className="button-wrapper">
                <Button href="#services" variant="primary" size="lg">View Services</Button>
              </div>
            </div>

            {serviceLine.hero_image_url && (
              <div className="service-detail-hero__aside">
                <div
                  className="service-detail-hero__media"
                  style={{ backgroundColor: svcColors.surfaceLight }}
                >
                  <Image
                    src={serviceLine.hero_image_url}
                    alt={serviceLine.name}
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
        <ScrollDownCta />
      </section>

      {/* ═══ Service Cards ═══
       * Hero and body both use the lighter `surfaceLight` ramp so the service-line
       * page reads as one uniform tinted band — matching the interior service-detail
       * page (#389). Dark `--text-primary` copy gains contrast on the paler surface,
       * so AA is preserved in both themes. */}
      <section id="services" className="page-section service-surface" style={{ backgroundColor: svcColors.surfaceLight, '--service-card-surface': svcColors.inverse } as React.CSSProperties}>
        <div className="container-lg container-lg--comfortable">
          <h2 style={{ ...heading.lg, textAlign: 'center', marginBottom: 'var(--gap-lg)' }}>
            {serviceLine.name} Services
          </h2>
          <Grid columns={3} gap="md">
            {services.map((svc) => {
              const cat = mapServiceLineSlug(serviceLine.slug);
              return (
                <ServiceCard
                  key={svc.slug}
                  name={svc.name}
                  slug={svc.slug}
                  serviceLineSlug={serviceLineSlug}
                  category={cat}
                  tagline={svc.tagline}
                  description={svc.description}
                  imageUrl={svc.image_url}
                  iconServiceName={hasIconFor(cat, svc.name) ? svc.name : undefined}
                  className="service-card--flat"
                  showCta
                />
              );
            })}
          </Grid>
        </div>
      </section>

      {/* ═══ Monthly Support CTA ═══
       * Left: supportPlan.image_url (the plan's own promo illustration)
       * Right card: supportPlanServiceLine.card_image_url — the service line
       * this plan belongs to (e.g. marketing) so brand/information pages show
       * the correct character and colors rather than inheriting the current line.
       */}
      {supportPlan && (
        <section className="page-section">
          <div className="container-lg container-lg--comfortable">
            <div className="content-wrapper content-wrapper--center content-wrapper--narrow">
              <h2 style={{ ...heading.lg, textAlign: 'center' }}>Monthly Support Services</h2>
              <p style={{ ...text.body, color: color.text.secondary, textAlign: 'center' }}>
                Join our monthly support plan to get professional advice without the need for a team.
              </p>
            </div>
            <div
              className="service-detail-support-grid"
              style={{ '--background-brand-primary': supportPlanServiceLineColors.onLight, '--text-brand-primary': supportPlanServiceLineColors.text } as React.CSSProperties}
            >
              {supportPlan.image_url && (
                <div className="service-detail-support-grid__media">
                  <Image
                    src={supportPlan.image_url}
                    alt=""
                    fill
                    sizes="(max-width: 991px) 100vw, 45vw"
                    style={{ objectFit: 'contain' }}
                  />
                </div>
              )}
              <Card variant="outlined" padding="lg" className="service-card--flat">
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: gap.md, textAlign: 'center', height: '100%' }}>
                  {supportPlanServiceLine.card_image_url && (
                    <div className="service-detail-support-cta__media">
                      <Image
                        src={supportPlanServiceLine.card_image_url}
                        alt={supportPlanServiceLine.name}
                        fill
                        sizes="180px"
                        style={{ objectFit: 'contain' }}
                      />
                    </div>
                  )}
                  <h3 style={{ ...heading.sm, textAlign: 'center' }}>{supportPlan.name}</h3>
                  <p style={{ ...text.body, color: color.text.secondary, textAlign: 'center' }}>{supportPlan.description}</p>
                  <Button href={`/plans#${supportPlan.slug}`} variant="primary" size="md">Learn more</Button>
                </div>
              </Card>
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
      {otherServiceLines.length > 0 && (
        <section className="page-section page-section--accent">
          <div className="container-lg container-lg--comfortable">
            <h2 style={{ ...heading.lg, textAlign: 'center', marginBottom: 'var(--gap-lg)' }}>
              Other Service Lines
            </h2>
            <Grid columns={3} gap="md">
              {otherServiceLines.map((cat) => {
                const catKey = mapServiceLineSlug(cat.slug);
                const catColors = serviceColor(catKey);
                return (
                  <div
                    key={cat.slug}
                    style={{ '--background-brand-primary': catColors.onLight, '--text-brand-primary': catColors.text } as React.CSSProperties}
                  >
                    <Card
                      preset="display"
                      variant="elevated"
                      title={cat.name}
                      description={cat.tagline ?? undefined}
                      image={
                        cat.card_image_url ? (
                          <Frame customRatio="3 / 2" fit="contain">
                            <Image src={cat.card_image_url} alt={cat.name} fill sizes="(max-width: 768px) 100vw, 400px" />
                          </Frame>
                        ) : undefined
                      }
                      tag={<ServiceTag category={catKey} variant="icon" size="md" />}
                      action={<LinkButton href={`/services/${routeSlugForServiceLine(cat.slug)}`} variant="primary" size="md">Learn More</LinkButton>}
                    />
                  </div>
                );
              })}
            </Grid>
          </div>
        </section>
      )}
    </div>
  );
}
