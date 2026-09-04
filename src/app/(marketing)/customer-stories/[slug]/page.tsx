import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { Icon } from '@/lib/icon';
import { BackLink } from '@/components/ui/BackLink';
import {
  Card,
  CardDescription,
  CardFooter,
  CardTitle,
  Frame,
  Grid,
  Button,
  ServiceTag,
  SectionHeader,
  Stack,
} from '@brikdesigns/bds';
import type { ServiceLine } from '@brikdesigns/bds';
import {
  getCustomerStoryBySlug,
  getOtherCustomerStories,
  getServiceBySlug,
  mapServiceLineSlug,
} from '@/lib/supabase/queries';
import { routeSlugForServiceLine } from '@/lib/service-line-routes';
import { composeButtonClasses } from '@/lib/bds-button-classes';
import { heading } from '@/lib/styles';
import { color, gap, serviceColor, serviceCtaVars } from '@/lib/tokens';
import { INDUSTRY_ICONS, INDUSTRY_ICON_FALLBACK } from '@/lib/industry-icons';
import { parseStorySections } from '@/lib/customer-story-sections';
import { StorySections, type StoryMetaItem } from './StorySections';
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
      alternates: { canonical: `/customer-stories/${slug}` },
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
    // The fallback is deliberate — a secondary section must not fail the page —
    // but it is logged, because an empty result from a query error is otherwise
    // indistinguishable from a genuinely empty pool.
    getOtherCustomerStories({
      excludeSlug: slug,
      serviceLineSlug: story.service_line_slug ?? null,
      limit: 3,
    }).catch((err) => {
      console.warn(`[customer-story] other-stories query failed for slug=${slug} — ${err}. Section renders empty.`);
      return [];
    }),
    story.service_slug
      ? getServiceBySlug(story.service_slug).catch((err) => {
          console.warn(`[customer-story] related-service lookup failed for service_slug=${story.service_slug} — ${err}. Related card omitted.`);
          return null;
        })
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
  const serviceLineSlug = story.service_line_slug
    ? mapServiceLineSlug(story.service_line_slug)
    : null;
  const serviceLineName = serviceLineSlug
    ? SERVICE_LINE_NAMES[serviceLineSlug] || null
    : null;
  const serviceLineCategory = serviceLineSlug as ServiceLine | null;
  const industryIcon = story.industry
    ? INDUSTRY_ICONS[story.industry] ?? INDUSTRY_ICON_FALLBACK
    : null;
  const serviceIconName = relatedService?.name && serviceLineCategory ? relatedService.name : undefined;
  const storyTitle = story.name || story.client_name;

  // One source for the metadata pairs, rendered either in the interior hero
  // (legacy template) or in the sticky rail (sections template, #1205). The
  // JSX below is unchanged from the inline version, so the legacy DOM is
  // byte-identical — this is a hoist, not a restyle.
  const metaItems: StoryMetaItem[] = ([
    story.client_name && story.client_name !== story.name
      ? {
          key: 'client',
          label: 'Client',
          icon: <Icon icon="ph:buildings" width={16} height={16} aria-hidden />,
          value: story.client_name,
        }
      : null,
    serviceLineCategory && serviceLineName
      ? {
          key: 'service-line',
          label: 'Service Line',
          icon: <ServiceTag category={serviceLineCategory} variant="icon" size="sm" />,
          value: serviceLineName,
        }
      : null,
    serviceLineCategory && relatedService?.name
      ? {
          key: 'service',
          label: 'Service',
          icon: (
            <ServiceTag
              category={serviceLineCategory}
              variant="icon"
              size="sm"
              {...(serviceIconName ? { serviceName: serviceIconName } : {})}
            />
          ),
          value: relatedService.name,
        }
      : null,
    story.industry && industryIcon
      ? {
          key: 'industry',
          label: 'Industry',
          icon: <Icon icon={industryIcon} width={16} height={16} aria-hidden />,
          value: story.industry,
        }
      : null,
    completion
      ? {
          key: 'completion',
          label: 'Completion Date',
          icon: <Icon icon="ph:calendar-blank" width={16} height={16} aria-hidden />,
          value: completion,
        }
      : null,
    story.client_website_url
      ? {
          key: 'website',
          label: 'Website',
          icon: <Icon icon="ph:globe" width={16} height={16} aria-hidden />,
          value: (
            <a
              href={story.client_website_url}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: color.text.brand, textDecoration: 'underline' }}
            >
              View website
            </a>
          ),
        }
      : null,
  ] as (StoryMetaItem | null)[]).filter((item): item is StoryMetaItem => item !== null);

  // Every row carries `sections` (backfilled by portal migration 00374 for
  // brik-client-portal#3770), so this is the only narrative path — the fixed
  // Challenge/Solution/Results template it used to fall back to is gone.
  const storySections = parseStorySections(story.sections);

  // Closing tag row (Figma 25950:9471). Derived from the story's own
  // classification — `customer_stories` has no tags column, and the #3767
  // contract kept classification on the existing dedicated fields.
  const closingTags = [serviceLineName, relatedService?.name, story.industry].filter(
    (tag): tag is string => Boolean(tag)
  );

  return (
    <>
      {/* ═══ Story arc — interior-hero + media + content + quote ═══
       * Anatomy follows /blog/[slug]'s rhythm but with image rows breaking out
       * to the wide 1280px column for visual impact. One page-section hosts
       * alternating containers:
       *   - .container-lg--story  (760px) → back link, h1, meta, narrative,
       *                                     quote
       *   - .container-lg         (1280px) → hero / inline media figures
       * Inter-row spacing of gap-xl is owned by the section via .story-arc
       * so the narrative reads as one continuous flow instead of stacked
       * sub-sections.
       *
       * A single "← Customer Stories" back link (not a breadcrumb) — a story
       * page has exactly one navigable ancestor, so the back link is the
       * clearer return control (nav-pattern rule #712). The story title is not
       * duplicated here; it's the <h1> immediately below.
       *
       * Anatomy ref: design.brikdesigns.com/docs/getting-started/page-templates
       */}
      <section className="page-section story-arc">
        <div className="container-lg container-lg--story">
          <BackLink href="/customer-stories" style={{ marginBottom: gap.md }}>
            Customer Stories
          </BackLink>

          <h1 style={heading.lg}>{storyTitle}</h1>
        </div>

        {story.hero_image_url && (
          <div className="container-lg">
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
          </div>
        )}

        <StorySections
          sections={storySections}
          meta={metaItems}
          quote={story.quote}
          quoteAttribution={story.quote_attribution || story.client_name}
          authorRole={story.author_role}
          tags={closingTags}
          midMedia={
            story.after_photo_url
              ? {
                  url: story.after_photo_url,
                  alt: `${story.name || story.client_name} solution`,
                }
              : null
          }
          closingMedia={
            story.results_photo_url
              ? {
                  url: story.results_photo_url,
                  alt: `${story.name || story.client_name} results`,
                }
              : null
          }
        />
      </section>

      {/* ═══ Other Customer Stories — 3-col grid ═══ */}
      {otherStories.length > 0 && (
        <section className="page-section page-section--accent">
          <div className="container-lg container-lg--comfortable">
            {/* Title + description are one tight pair — the container's
             * 36px column gap is meant to separate the block from the grid,
             * not to space a heading from its own subtitle (#456). */}
            <SectionHeader
              title="Other Customer Stories"
              description="We're more than a design studio — we're your strategic marketing partner."
            />
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
                            serviceName={s.name}
                            variant="icon-text"
                            label={SERVICE_LINE_NAMES[cat] || cat}
                            size="sm"
                            style={{ alignSelf: 'flex-start' }}
                          />
                        )}
                        {/* h4, not the default h3 — the story name overpowered
                            the card at --heading-md; the scoped rule in
                            customer-stories.css steps it to --heading-sm. */}
                        <CardTitle as="h4">{s.name || s.client_name}</CardTitle>
                        {s.short_description && (
                          <CardDescription>{s.short_description}</CardDescription>
                        )}
                      </div>
                      <CardFooter>
                        {/* Presentational span — the wrapping <Link> owns
                         * navigation. Rendering <Button href> here produces
                         * <a> inside <a> (invalid HTML); browsers fall back
                         * to a hard reload + scroll-to-top instead of
                         * client-side navigation. Mirrors ServiceLineCard +
                         * CustomerStoryCard. */}
                        <span className={composeButtonClasses({ variant: 'primary', size: 'md' })}>
                          Read Story
                        </span>
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
          className="page-section service-surface related-services-band"
          // Light mode: pale `surfaceLight` ramp (site-wide pale band treatment,
          // #408). Dark mode: `.related-services-band` (shared-sections.css)
          // repaints to the deep `surfaceDark` service tint so the band reads
          // dark like its neighbouring `story-arc` / `--accent` sections instead
          // of a stuck light-green band (#671/322). Both tint values are handed
          // to CSS as custom props; the `background-color` is applied in the
          // stylesheet (NOT inline) so the dark-mode rule can override it. That
          // rule also flips the section's inherited heading text light, since the
          // `.service-surface` grayscale-darkest pin is only correct on the light
          // tint. The elevated Card keeps its own dark surface + light text via
          // the pin's nested-card carve-out. (#502/322)
          style={{
            '--related-band-light': serviceColor(relatedAudience).surfaceLight,
            '--related-band-dark': serviceColor(relatedAudience).surfaceDark,
          } as React.CSSProperties}
        >
          <div className="container-lg container-lg--comfortable">
            <SectionHeader title="Related Services" />
            <Card variant="elevated" padding="lg" className="service-themed" style={{ marginTop: 'var(--gap-lg)' }}>
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
                    serviceName={relatedService.name}
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
                      href={`/services/${routeSlugForServiceLine(relatedCatSlug)}/${relatedService.slug}`}
                      variant="primary"
                      size="md"
                      style={serviceCtaVars(relatedAudience)}
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
          <SectionHeader
            onColor
            title="Get in Touch"
            description="Starting a new project or want to collaborate with us?"
            actions={
              <Button href="/contact" variant="on-color" size="lg">
                Let&apos;s Talk
              </Button>
            }
          />
        </div>
      </section>
    </>
  );
}
