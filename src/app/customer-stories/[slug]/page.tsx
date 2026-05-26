import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import {
  Breadcrumb,
  Card,
  CardDescription,
  CardFooter,
  CardTitle,
  Frame,
  Grid,
  Button,
  ServiceTag,
  Stack,
} from '@brikdesigns/bds';
import {
  getCustomerStoryBySlug,
  getOtherCustomerStories,
  getServiceBySlug,
  mapServiceLineSlug,
} from '@/lib/supabase/queries';
import { hasIconFor } from '@/lib/service-icons';
import { text, heading } from '@/lib/styles';
import { color, gap, serviceColor } from '@/lib/tokens';
import '../../shared-sections.css';
import '../customer-stories.css';

type Props = { params: Promise<{ slug: string }> };

export const revalidate = 86400;

const SERVICE_LINE_NAMES: Record<string, string> = {
  brand: 'Brand Design',
  marketing: 'Marketing Design',
  information: 'Information Design',
  product: 'Product Design',
  service: 'Back Office Design',
};

function formatDate(s: string | null | undefined): string | null {
  if (!s) return null;
  const d = new Date(s);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  try {
    const story = await getCustomerStoryBySlug(slug);
    return {
      title: `${story.client_name || story.name} — Customer Story`,
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

  const [otherStories, relatedService] = await Promise.all([
    // Prefer same-line stories for topical fit; fall back to next-ranked when
    // the line pool is empty so the section never disappears on isolated lines.
    getOtherCustomerStories({
      excludeSlug: slug,
      serviceLineSlug: story.service_line_slug ?? null,
      limit: 3,
    }).catch(() => []),
    story.service_slug
      ? getServiceBySlug(story.service_slug).catch(() => null)
      : Promise.resolve(null),
  ]);

  // Resolve audience for the related service card. Prefer the joined
  // service_lines slug; fall back to the story's denormalized
  // service_line_slug (see #151 drift risk).
  const relatedCatRaw = (() => {
    if (!relatedService?.service_lines) return story.service_line_slug || 'service';
    const sl = relatedService.service_lines;
    if (Array.isArray(sl)) return sl[0]?.slug || 'service';
    return (sl as { slug: string }).slug || 'service';
  })();
  const relatedCatSlug = mapServiceLineSlug(relatedCatRaw);
  const relatedAudience = relatedCatSlug;

  const completion = formatDate(story.launch_date);
  const serviceLineName = story.service_line_slug
    ? SERVICE_LINE_NAMES[mapServiceLineSlug(story.service_line_slug)] || null
    : null;

  return (
    <>
      {/* ═══ Story arc — interior-hero + media + content + quote, single column ═══
       * Anatomy mirrors /blog/[slug]: one content-section, narrow article
       * column (container-lg--story = 760px), explicit per-element rhythm
       * (gap-md inside the hero block, gap-xl between major regions, gap-sm
       * heading→body). Breadcrumb intentionally drops the third (current-page)
       * crumb — story titles are too long to wrap gracefully.
       * Anatomy ref: design.brikdesigns.com/docs/getting-started/page-templates
       */}
      <section className="content-section">
        <div className="container-lg container-lg--story">
          <Breadcrumb
            style={{ marginBottom: gap.md, flexWrap: 'wrap' }}
            items={[
              { label: 'Home', href: '/' },
              { label: 'Customer Stories', href: '/customer-stories' },
            ]}
          />

          <h1 style={heading.lg}>{story.name || story.client_name}</h1>

          <dl className="story-detail-meta">
            {story.client_name && story.client_name !== story.name && (
              <div>
                <dt className="story-detail-meta__label">Client</dt>
                <dd className="story-detail-meta__value">{story.client_name}</dd>
              </div>
            )}
            {serviceLineName && (
              <div>
                <dt className="story-detail-meta__label">Service Line</dt>
                <dd className="story-detail-meta__value">{serviceLineName}</dd>
              </div>
            )}
            {relatedService?.name && (
              <div>
                <dt className="story-detail-meta__label">Service</dt>
                <dd className="story-detail-meta__value">{relatedService.name}</dd>
              </div>
            )}
            {story.industry && (
              <div>
                <dt className="story-detail-meta__label">Industry</dt>
                <dd className="story-detail-meta__value">{story.industry}</dd>
              </div>
            )}
            {completion && (
              <div>
                <dt className="story-detail-meta__label">Completion Date</dt>
                <dd className="story-detail-meta__value">{completion}</dd>
              </div>
            )}
            {story.client_website_url && (
              <div>
                <dt className="story-detail-meta__label">Website</dt>
                <dd className="story-detail-meta__value">
                  <a
                    href={story.client_website_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: color.text.brand, textDecoration: 'underline' }}
                  >
                    View website
                  </a>
                </dd>
              </div>
            )}
          </dl>

          {story.hero_image_url && (
            <div className="story-figure">
              <Frame ratio="wide" fit="cover">
                <Image
                  src={story.hero_image_url}
                  alt={`${story.client_name || story.name} hero`}
                  width={1280}
                  height={720}
                  priority
                />
              </Frame>
            </div>
          )}

          {story.the_challenge && (
            <div className="story-block">
              <h2 style={heading.md}>The Challenge</h2>
              <div
                className="story-block__body"
                dangerouslySetInnerHTML={{ __html: story.the_challenge }}
              />
            </div>
          )}

          {story.after_photo_url && (
            <div className="story-figure">
              <Frame ratio="wide" fit="cover">
                <Image
                  src={story.after_photo_url}
                  alt={`${story.name || story.client_name} solution`}
                  width={1280}
                  height={720}
                />
              </Frame>
            </div>
          )}

          {story.the_solution && (
            <div className="story-block">
              <h2 style={heading.md}>The Brik Solution</h2>
              <div
                className="story-block__body"
                dangerouslySetInnerHTML={{ __html: story.the_solution }}
              />
            </div>
          )}

          {story.results_photo_url && (
            <div className="story-figure">
              <Frame ratio="wide" fit="cover">
                <Image
                  src={story.results_photo_url}
                  alt={`${story.name || story.client_name} results`}
                  width={1280}
                  height={720}
                />
              </Frame>
            </div>
          )}

          {story.results && (
            <div className="story-block">
              <h2 style={heading.md}>Results</h2>
              <div
                className="story-block__body"
                dangerouslySetInnerHTML={{ __html: story.results }}
              />
            </div>
          )}

          {story.quote && (
            <blockquote className="story-quote">
              <p className="story-quote__description">{story.quote}</p>
              {(story.quote_attribution || story.client_name) && (
                <footer className="story-quote__attribution">
                  — {story.quote_attribution || story.client_name}
                </footer>
              )}
            </blockquote>
          )}
        </div>
      </section>

      {/* ═══ Other Customer Stories — 3-col grid ═══ */}
      {otherStories.length > 0 && (
        <section className="content-section content-section--accent">
          <div className="container-lg container-lg--comfortable">
            <h2 style={{ ...heading.lg, textAlign: 'center' }}>Other Customer Stories</h2>
            <p
              style={{
                ...text.body,
                color: color.text.secondary,
                textAlign: 'center',
                maxWidth: '60ch',
                margin: '0 auto',
              }}
            >
              We&apos;re more than a design studio — we&apos;re your strategic marketing partner.
            </p>
            <Grid columns={3} gap="md" style={{ marginTop: 'var(--gap-lg)' }}>
              {otherStories.map((s) => {
                const cat = mapServiceLineSlug(s.service_line_slug || 'service');
                return (
                  <Link
                    key={s.slug}
                    href={`/customer-stories/${s.slug}`}
                    className="services-card-link"
                  >
                    <Card
                      variant="outlined"
                      padding="md"
                      interactive
                      className="services-card"
                      style={{ height: '100%' }}
                    >
                      {s.hero_image_url && (
                        <div className="services-card__media services-card__media--landscape">
                          <Image
                            src={s.hero_image_url}
                            alt={s.client_name || s.name || ''}
                            width={400}
                            height={225}
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          />
                        </div>
                      )}
                      <div className="services-card__content">
                        {s.service_line_slug && (
                          <ServiceTag
                            category={cat}
                            {...(hasIconFor(cat, s.name || '') ? { serviceName: s.name } : {})}
                            variant="icon-text"
                            label={SERVICE_LINE_NAMES[cat] || cat}
                            size="sm"
                            style={{ alignSelf: 'flex-start' }}
                          />
                        )}
                        <CardTitle>{s.name || s.client_name}</CardTitle>
                        {s.short_description && (
                          <CardDescription>{s.short_description}</CardDescription>
                        )}
                      </div>
                      <CardFooter>
                        <Button
                          href={`/customer-stories/${s.slug}`}
                          variant="primary"
                          size="sm"
                        >
                          Read Story
                        </Button>
                      </CardFooter>
                    </Card>
                  </Link>
                );
              })}
            </Grid>
          </div>
        </section>
      )}

      {/* ═══ Related Services — single row card ═══ */}
      {relatedService && (
        <section
          className="content-section"
          style={{ backgroundColor: serviceColor(relatedAudience).surface }}
        >
          <div className="container-lg container-lg--comfortable">
            <h2 style={{ ...heading.lg, textAlign: 'center' }}>Related Services</h2>
            <Card variant="outlined" padding="lg" style={{ marginTop: 'var(--gap-lg)' }}>
              <Stack direction="horizontal" gap="lg" align="center">
                {relatedService.image_url && (
                  <div style={{ flex: '0 0 35%' }}>
                    <Frame customRatio="3 / 2" fit="contain" className="illustration-media-bg">
                      <Image
                        src={relatedService.image_url}
                        alt={relatedService.name}
                        width={500}
                        height={333}
                      />
                    </Frame>
                  </div>
                )}
                <Stack direction="vertical" gap="sm" style={{ flex: 1 }}>
                  <ServiceTag
                    category={relatedAudience}
                    {...(hasIconFor(relatedAudience, relatedService.name)
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
                    <Button
                      href={`/services/${relatedCatSlug}/${relatedService.slug}`}
                      variant="primary"
                      size="sm"
                    >
                      Learn More
                    </Button>
                  </CardFooter>
                </Stack>
              </Stack>
            </Card>
          </div>
        </section>
      )}

      {/* ═══ Bottom Get In Touch CTA ═══ */}
      <section className="cta-section-brand">
        <div className="cta-card-brand">
          <h2
            style={{
              ...heading.lg,
              color: color.text.onColorDark,
              textAlign: 'center',
              margin: 0,
            }}
          >
            Get in Touch
          </h2>
          <p
            style={{
              ...text.body,
              color: color.text.onColorDark,
              textAlign: 'center',
              margin: 0,
              opacity: 0.9,
            }}
          >
            Starting a new project or want to collaborate with us?
          </p>
          <Button href="/contact" variant="on-color" size="lg">
            Let&apos;s Talk
          </Button>
        </div>
      </section>
    </>
  );
}
