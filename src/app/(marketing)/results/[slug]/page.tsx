import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
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
import {
  getCustomerStoryBySlug,
  getOtherCustomerStories,
  getServiceBySlug,
  mapServiceLineSlug,
} from '@/lib/supabase/queries';
import { routeSlugForServiceLine } from '@/lib/service-line-routes';
import { composeButtonClasses } from '@/lib/bds-button-classes';
import { heading } from '@/lib/styles';
import { gap, serviceColor, serviceCtaVars } from '@/lib/tokens';
import { parseStorySections } from '@/lib/customer-story-sections';
import { parseStoryStats } from '@/lib/customer-story-stats';
import { parseStorySocialLinks } from '@/lib/customer-story-author';
import { StorySections } from './StorySections';
import { StoryHero, type StoryHeroAuthor, type StoryHeroPair } from './StoryHero';
import '../../shared-sections.css';
import '../results.css';

type Props = { params: Promise<{ slug: string }> };

export const revalidate = 86400;

const SERVICE_LINE_NAMES: Record<string, string> = {
  brand: 'Brand Design',
  marketing: 'Marketing Design',
  information: 'Information Design',
  product: 'Product Design',
  service: 'Back Office Design',
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  try {
    const story = await getCustomerStoryBySlug(slug);
    return {
      title: `${story.client_name || story.name} — Customer Story`,
      description: story.short_description || undefined,
      alternates: { canonical: `/results/${slug}` },
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

  const serviceLineSlug = story.service_line_slug
    ? mapServiceLineSlug(story.service_line_slug)
    : null;
  const serviceLineName = serviceLineSlug
    ? SERVICE_LINE_NAMES[serviceLineSlug] || null
    : null;
  const storyTitle = story.name || story.client_name;

  // Every row carries `sections` (backfilled by portal migration 00374 for
  // brik-client-portal#3770), so this is the only narrative path — the fixed
  // Challenge/Solution/Results template it used to fall back to is gone.
  const storySections = parseStorySections(story.sections);

  // Hero summary card — Figma `col_summary` (node 25967:10126): three iconless
  // pairs, labelled as the design labels them ("Client" / "Industries" /
  // "Services"). This is now the story's ONLY summary — node 25967 folds the
  // former rail meta card into the hero, so the rail carries the TOC + stats
  // (`col_stats`) instead. Dropping that duplicate is #1458 (it superseded the
  // 2026-09-04 "keep both" note, which predated this design revision).
  const heroPairs: StoryHeroPair[] = ([
    story.client_name ? { key: 'client', label: 'Client', value: story.client_name } : null,
    story.industry ? { key: 'industries', label: 'Industries', value: story.industry } : null,
    // The most specific service the row carries — `service_slug` is null on
    // roughly half the live rows, where the service line is all there is.
    relatedService?.name || serviceLineName
      ? {
          key: 'services',
          label: 'Services',
          value: (relatedService?.name || serviceLineName) as string,
        }
      : null,
  ] as (StoryHeroPair | null)[]).filter((p): p is StoryHeroPair => p !== null);

  // Author identity (Figma 25944:9406 + 25944:9430), from the columns portal
  // migration 00376 added. `quote_attribution` is the NAME since the 00381
  // backfill; the role is its own column. All three are nullable and every
  // live row is still empty, so the row degrades to identity-only, then to
  // nothing at all.
  const heroAuthor: StoryHeroAuthor | null = story.quote_attribution
    ? {
        name: story.quote_attribution,
        role: story.author_role,
        headshotUrl: story.author_headshot_url,
        socialLinks: parseStorySocialLinks(story.author_social_links),
      }
    : null;

  // Closing tag row (Figma 25950:9471). Derived from the story's own
  // classification — `customer_stories` has no tags column, and the #3767
  // contract kept classification on the existing dedicated fields.
  const closingTags = [serviceLineName, relatedService?.name, story.industry].filter(
    (tag): tag is string => Boolean(tag)
  );

  return (
    <>
      {/* ═══ Story arc — title + hero + sectioned body ═══
       * Figma node 25967:10113 ("birdwell-story"): the title block, the hero,
       * and the sectioned body all sit in the SAME 1024px `container-small`, so
       * they share one left edge and width. The title block therefore takes
       * `.container-lg--story-layout` (1024) — the same container the hero and
       * body use below — NOT the narrow 760px `--story` column, whose centred
       * max-width left the title inset ~132px from the body it heads (#1458).
       *
       * Inter-row spacing (gap-huge) is owned by the section via .story-arc so
       * the narrative reads as one continuous flow instead of stacked sections.
       *
       * A single "← Customer Stories" back link (not a breadcrumb) — a story
       * page has exactly one navigable ancestor, so the back link is the
       * clearer return control (nav-pattern rule #712). The story title is not
       * duplicated here; it's the <h1> immediately below.
       *
       * Anatomy ref: design.brikdesigns.com/docs/getting-started/page-templates
       */}
      <section className="page-section story-arc">
        <div className="container-lg container-lg--story-layout">
          <BackLink href="/results" style={{ marginBottom: gap.md }}>
            Customer Stories
          </BackLink>

          <h1 style={heading.lg}>{storyTitle}</h1>
        </div>

        {/* Hero block (Figma 25944:8615, #3799 AC3/AC4). Replaces the
            full-bleed 1280px hero image #1205 shipped as a deferral: the image
            is now 768px inside the same 1024px container as the sections
            below, with the metadata card beside it. */}
        <StoryHero
          pairs={heroPairs}
          media={
            story.hero_image_url
              ? {
                  url: story.hero_image_url,
                  alt: `${story.client_name || story.name} hero`,
                }
              : null
          }
          description={story.short_description}
          author={heroAuthor}
        />

        <StorySections
          sections={storySections}
          stats={parseStoryStats(story.stats)}
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
                    href={`/results/${s.slug}`}
                    className="services-card-link"
                  >
                    {/* h4 title (not the default h3) + `display-card--title-sm`
                        steps the story name to --heading-sm so it doesn't
                        overpower the card at --heading-md. Flush media (default)
                        — the story card is not a service card, so it keeps the
                        lg body inset rather than the service `inset` treatment. */}
                    <Card
                      layout="stack"
                      className="display-card--title-sm"
                      style={{ height: '100%' }}
                      titleAs="h4"
                      title={s.name || s.client_name || ''}
                      media={
                        s.hero_image_url ? (
                          <Frame customRatio="16 / 9" fit="cover">
                            <Image
                              src={s.hero_image_url}
                              alt={s.client_name || s.name || ''}
                              fill
                              style={{ objectFit: 'cover' }}
                              sizes="(max-width: 768px) 100vw, 400px"
                            />
                          </Frame>
                        ) : undefined
                      }
                      overline={
                        s.service_line_slug ? (
                          <ServiceTag
                            category={cat}
                            serviceName={s.name}
                            variant="icon-text"
                            label={SERVICE_LINE_NAMES[cat] || cat}
                            size="sm"
                          />
                        ) : undefined
                      }
                      action={
                        // Presentational span — the wrapping <Link> owns
                        // navigation. A <Button href> here would nest <a> in <a>
                        // (invalid HTML), forcing a hard reload + scroll-to-top
                        // instead of client-side nav. Mirrors ServiceLineCard.
                        <span className={composeButtonClasses({ variant: 'primary', size: 'md' })}>
                          <span className="bds-button__content">Read Story</span>
                        </span>
                      }
                    >
                      {s.short_description ? (
                        <CardDescription>{s.short_description}</CardDescription>
                      ) : undefined}
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
