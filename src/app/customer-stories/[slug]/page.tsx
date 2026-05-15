import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Image from 'next/image';
import {
  Breadcrumb,
  Card,
  CardDescription,
  CardFooter,
  CardGrid,
  CardTitle,
  Frame,
  Grid,
  LinkButton,
  ServiceTag,
  Stack,
} from '@brikdesigns/bds';
import {
  getCustomerStoryBySlug,
  getOtherCustomerStories,
  getRelatedService,
  mapCategorySlug,
} from '@/lib/supabase/queries';
import { hasIconFor } from '@/lib/service-icons';
import { color, font, gap, space } from '@/lib/tokens';
import { heading, label, text } from '@/lib/styles';
import '../../shared-sections.css';

type Props = { params: Promise<{ slug: string }> };

export const revalidate = 86400; // ISR: 24 hours

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  try {
    const story = await getCustomerStoryBySlug(slug);
    return {
      title: `${story.client_name} — ${story.name}`,
      description: story.short_description || undefined,
    };
  } catch {
    return { title: 'Story Not Found' };
  }
}

export default async function CustomerStoryDetailPage({ params }: Props) {
  const { slug } = await params;

  let story;
  try {
    story = await getCustomerStoryBySlug(slug);
  } catch {
    notFound();
  }

  // Resolve the related service from the story's denormalized service_slug.
  // Same source the service-detail "Recommended Add-On" uses, so the row card
  // pattern lines up across both surfaces.
  const relatedService = story.service_slug
    ? await getRelatedService(story.service_slug)
    : null;

  const relatedCatSlug = (() => {
    if (!relatedService?.service_lines) return story.service_line_slug || 'brand-design';
    const catData = relatedService.service_lines;
    if (Array.isArray(catData)) return catData[0]?.slug || story.service_line_slug || 'brand-design';
    return (catData as { slug: string }).slug || story.service_line_slug || 'brand-design';
  })();

  // Other stories — same service line first, fallback to next-ranked so the
  // section stays populated on lines with only one story.
  const otherStories = await getOtherCustomerStories({
    excludeSlug: slug,
    serviceLineSlug: story.service_line_slug ?? null,
    limit: 3,
  });

  return (
    <>
      {/* ═══ Hero ═══ */}
      <section className="page-hero">
        <div className="page-hero__container">
          <div style={{ marginBottom: gap.md, width: '100%', display: 'flex', justifyContent: 'center' }}>
            <Breadcrumb
              items={[
                { label: 'Customer Stories', href: '/customer-stories' },
                { label: story.name || story.client_name },
              ]}
              separator="chevron"
            />
          </div>
          {story.industry && (
            <p style={{ ...label.smBold, color: color.text.brand, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {story.industry}
            </p>
          )}
          <h1 className="page-hero__title" style={{ marginTop: gap.xs }}>
            {story.name}
          </h1>
          <p style={{ ...text.bodyLg, color: color.text.secondary, marginTop: gap.sm }}>
            {story.client_name}
          </p>
          {story.short_description && (
            <p className="page-hero__description" style={{ marginTop: gap.md }}>
              {story.short_description}
            </p>
          )}
        </div>
      </section>

      {/* ═══ Hero image ═══ */}
      {story.hero_image_url && (
        <section style={{ padding: `0 0 ${space.xl}` }}>
          <div style={{ maxWidth: 1280, margin: '0 auto', padding: `0 ${space.lg}` }}>
            <Frame customRatio="16 / 9" fit="cover" style={{ borderRadius: 'var(--border-radius-lg)', overflow: 'hidden' }}>
              <Image
                src={story.hero_image_url}
                alt={`${story.client_name} — ${story.name}`}
                width={1280}
                height={720}
                priority
              />
            </Frame>
          </div>
        </section>
      )}

      {/* ═══ Body — Challenge / Solution / Results with inline imagery ═══ */}
      <section className="content-section">
        <div className="container-lg">
          <div style={{ width: '100%', maxWidth: 800, display: 'flex', flexDirection: 'column', gap: gap.xl }}>
            {story.the_challenge && (
              <div>
                <h2 style={{ ...heading.md, marginBottom: gap.sm }}>The Challenge</h2>
                <div
                  style={{
                    fontFamily: font.family.body,
                    fontSize: font.size.body.md,
                    color: color.text.secondary,
                    lineHeight: font.lineHeight.relaxed,
                  }}
                  dangerouslySetInnerHTML={{ __html: story.the_challenge }}
                />
              </div>
            )}

            {/* Optional mid-body image — `before_photo_url` reads as the "in-progress"
                slot when paired with `after_photo_url`, but story authors often store a
                single mid-story image here. Render whichever exists. */}
            {story.before_photo_url && (
              <Frame customRatio="16 / 9" fit="cover" style={{ borderRadius: 'var(--border-radius-md)', overflow: 'hidden' }}>
                <Image
                  src={story.before_photo_url}
                  alt={`${story.client_name} — before`}
                  width={800}
                  height={450}
                />
              </Frame>
            )}

            {story.the_solution && (
              <div>
                <h2 style={{ ...heading.md, marginBottom: gap.sm }}>The Solution</h2>
                <div
                  style={{
                    fontFamily: font.family.body,
                    fontSize: font.size.body.md,
                    color: color.text.secondary,
                    lineHeight: font.lineHeight.relaxed,
                  }}
                  dangerouslySetInnerHTML={{ __html: story.the_solution }}
                />
              </div>
            )}

            {story.after_photo_url && (
              <Frame customRatio="16 / 9" fit="cover" style={{ borderRadius: 'var(--border-radius-md)', overflow: 'hidden' }}>
                <Image
                  src={story.after_photo_url}
                  alt={`${story.client_name} — after`}
                  width={800}
                  height={450}
                />
              </Frame>
            )}

            {story.results && (
              <div>
                <h2 style={{ ...heading.md, marginBottom: gap.sm }}>Results</h2>
                <div
                  style={{
                    fontFamily: font.family.body,
                    fontSize: font.size.body.md,
                    color: color.text.secondary,
                    lineHeight: font.lineHeight.relaxed,
                  }}
                  dangerouslySetInnerHTML={{ __html: story.results }}
                />
              </div>
            )}

            {story.results_photo_url && (
              <Frame customRatio="16 / 9" fit="cover" style={{ borderRadius: 'var(--border-radius-md)', overflow: 'hidden' }}>
                <Image
                  src={story.results_photo_url}
                  alt={`${story.client_name} — results`}
                  width={800}
                  height={450}
                />
              </Frame>
            )}

            {/* Blockquote — inline pending BDS `<Blockquote>` primitive (gap
                flagged 2026-05-14: CardTestimonial is a stars/card variant,
                not the bordered pull-quote Webflow ships). Left poppy accent
                + serif italic quote + plain attribution. */}
            {story.quote && (
              <blockquote
                style={{
                  margin: 0,
                  padding: `${space.md} ${space.lg}`,
                  borderLeft: `4px solid ${color.brand.primary}`,
                  background: color.surface.secondary,
                  borderRadius: 'var(--border-radius-sm)',
                }}
              >
                <p
                  style={{
                    ...text.bodyLg,
                    fontStyle: 'italic',
                    color: color.text.primary,
                    margin: 0,
                  }}
                >
                  &ldquo;{story.quote}&rdquo;
                </p>
                {(story.quote_attribution || story.client_name) && (
                  <footer
                    style={{
                      ...label.smBold,
                      color: color.text.secondary,
                      marginTop: gap.sm,
                    }}
                  >
                    — {story.quote_attribution || story.client_name}
                  </footer>
                )}
              </blockquote>
            )}
          </div>
        </div>
      </section>

      {/* ═══ Other Customer Stories ═══ */}
      {otherStories.length > 0 && (
        <CardGrid sectionKey="other-stories" title="Other Customer Stories">
          <Grid columns={3} gap="lg">
            {otherStories.map((s) => (
              <Card
                key={s.slug}
                preset="display"
                image={
                  s.hero_image_url ? (
                    <Frame customRatio="3 / 2" fit="cover">
                      <Image
                        src={s.hero_image_url}
                        alt={s.name || s.client_name}
                        width={400}
                        height={267}
                      />
                    </Frame>
                  ) : undefined
                }
                title={s.name || s.client_name}
                description={s.short_description || undefined}
                action={
                  <LinkButton
                    href={`/customer-stories/${s.slug}`}
                    variant="primary"
                    size="sm"
                  >
                    Read Story
                  </LinkButton>
                }
              />
            ))}
          </Grid>
        </CardGrid>
      )}

      {/* ═══ Related Service ═══
       * Mirrors the service-detail "Recommended Add-On" row layout — image
       * left (square), copy + CTA right. Non-interactive card; only the
       * explicit LinkButton is clickable. */}
      {relatedService && (
        <CardGrid sectionKey="related-service" title="Related Service">
          <Card padding="lg">
            <Stack direction="horizontal" gap="lg" align="center">
              {relatedService.image_url && (
                <div style={{ flex: '0 0 35%' }}>
                  <Frame ratio="square" fit="cover">
                    <Image
                      src={relatedService.image_url}
                      alt={relatedService.name}
                      width={400}
                      height={400}
                    />
                  </Frame>
                </div>
              )}
              <Stack direction="vertical" gap="sm" style={{ flex: 1 }}>
                <ServiceTag
                  category={mapCategorySlug(relatedCatSlug)}
                  {...(hasIconFor(mapCategorySlug(relatedCatSlug), relatedService.name)
                    ? { serviceName: relatedService.name }
                    : {})}
                  variant="icon-text"
                  label={relatedService.name}
                  size="md"
                  style={{ alignSelf: 'flex-start' }}
                />
                <CardTitle>{relatedService.name}</CardTitle>
                {(relatedService.description || relatedService.tagline) && (
                  <CardDescription>
                    {relatedService.description || relatedService.tagline}
                  </CardDescription>
                )}
                <CardFooter>
                  <LinkButton
                    href={`/services/${relatedCatSlug}/${relatedService.slug}`}
                    variant="primary"
                    size="sm"
                  >
                    Learn More
                  </LinkButton>
                </CardFooter>
              </Stack>
            </Stack>
          </Card>
        </CardGrid>
      )}

      {/* ═══ Get In Touch — matches customer-stories index footer CTA ═══ */}
      <section className="cta-section-brand">
        <div className="cta-card-brand">
          <h2 style={{ ...heading.lg, color: color.text.onColorDark, textAlign: 'center', margin: 0 }}>
            Get in Touch
          </h2>
          <p style={{ ...text.body, color: color.text.onColorDark, textAlign: 'center', margin: 0, opacity: 0.9 }}>
            Starting a new project or want to collaborate with us?
          </p>
          <LinkButton href="/contact" variant="inverse" size="lg">
            Let&apos;s Talk
          </LinkButton>
        </div>
      </section>
    </>
  );
}
