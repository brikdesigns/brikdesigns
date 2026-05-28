import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Image from 'next/image';
import { getIndustryPageBySlug, getIndustryPages, getCustomerStoriesByIndustry, mapServiceLineSlug } from '@/lib/supabase/queries';
import { Breadcrumb, Card, Frame, Grid, LinkButton } from '@brikdesigns/bds';
import { text, heading, label } from '@/lib/styles';
import { color } from '@/lib/tokens';
import { CustomerStoryCard } from '@/components/marketing/CustomerStoryCard';
import { ServiceCard } from '@/components/marketing/ServiceCard';
import { hasIconFor } from '@/lib/service-icons';
import type { ServiceLine } from '@brikdesigns/bds';
import '../../shared-sections.css';
import '../customers.css';
// CustomerStoryCard's CSS lives under /customer-stories/ — must be imported
// here so `.story-card__media { position: relative }` applies. Without it,
// the <Image fill> inside the story card escapes its parent (position:
// static) and overlays the page hero. Component-local CSS would be cleaner;
// tracked as follow-up.
import '../../customer-stories/customer-stories.css';

// Shape of one nested topic-service row from getIndustryPageBySlug.
type TopicService = {
  sort_order: number | null;
  services: {
    id: string;
    slug: string;
    name: string;
    tagline: string | null;
    description: string | null;
    image_url: string | null;
    service_lines: { slug: string; name: string } | null;
  } | null;
};

type Props = { params: Promise<{ slug: string }> };

export const revalidate = 86400;

export async function generateStaticParams() {
  const pages = await getIndustryPages();
  return pages.map((p: { slug: string }) => ({ slug: p.slug }));
}

// Fixed tinted backgrounds per topic_number — matches Webflow per-topic colored sections.
// High-luminance values maintain text-primary 4.5:1+ contrast.
const TOPIC_TINTS: Record<number, string> = {
  1: '#fff4ad',
  2: '#fcd7d3',
  3: '#c8e6c9',
  4: '#d8c5e8',
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  try {
    const page = await getIndustryPageBySlug(slug);
    return {
      title: `${page.name} Customers | Brik Designs`,
      description: page.tagline || `Brik Designs works with ${page.name} businesses.`,
    };
  } catch {
    return { title: 'Not Found' };
  }
}

export default async function CustomerDetailPage({ params }: Props) {
  const { slug } = await params;

  let page;
  try {
    page = await getIndustryPageBySlug(slug);
  } catch {
    notFound();
  }

  // Skip topics that have no editorial content AND no related services.
  // Webflow's empty "Other Services" placeholder collapses out; populated
  // topics (even those with no description but with services) render.
  const topics = (page.industry_page_topics ?? [])
    .filter((t: {
      description: string | null;
      image_url: string | null;
      industry_page_topic_services: TopicService[] | null;
    }) =>
      Boolean(t.description) ||
      Boolean(t.image_url) ||
      (t.industry_page_topic_services?.length ?? 0) > 0,
    )
    .sort((a: { topic_number: number }, b: { topic_number: number }) => a.topic_number - b.topic_number);

  const [allPages, stories] = await Promise.all([
    getIndustryPages(),
    getCustomerStoriesByIndustry(slug),
  ]);

  const otherPages = allPages
    .filter((p: { slug: string }) => p.slug !== slug)
    .slice(0, 3);

  return (
    <>
      {/* Hero — icon-lg service tag, breadcrumb, name, intro_description.
       * Tagline is reserved for service-plan promotion cards (per design canon)
       * and is intentionally omitted here. The icon-lg block uses
       * page.image_url, which now drives both the meganav card and this hero
       * tag (collapsed from the legacy hero_image_url + image_url pair).
       * Decorative badge pair still supported on the aside when present. */}
      <section className="page-hero">
        <div className="page-hero__container">
          <div className="customer-detail-hero">
            <div className="customer-detail-hero__content">
              {page.image_url && (
                <div className="customer-detail-hero__tag" aria-hidden="true">
                  <Image
                    src={page.image_url}
                    alt=""
                    width={96}
                    height={96}
                    className="customer-detail-hero__tag-icon"
                    priority
                  />
                </div>
              )}
              <Breadcrumb
                style={{ flexWrap: 'wrap' }}
                items={[
                  { label: 'Home', href: '/' },
                  { label: 'Customers', href: '/customers' },
                  { label: page.name },
                ]}
              />
              <h1 className="page-hero__title">{page.name}</h1>
              {page.intro_description && (
                <p className="page-hero__description">{page.intro_description}</p>
              )}
            </div>
            {(page.primary_badge_url || page.secondary_badge_url) && (
              <div className="customer-detail-hero__badges" aria-hidden="true">
                {page.primary_badge_url && (
                  <Image
                    src={page.primary_badge_url}
                    alt=""
                    width={120}
                    height={120}
                    className="customer-detail-hero__badge"
                  />
                )}
                {page.secondary_badge_url && (
                  <Image
                    src={page.secondary_badge_url}
                    alt=""
                    width={120}
                    height={120}
                    className="customer-detail-hero__badge"
                  />
                )}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Topic sections — tinted bg per topic. Single 4-col grid spans the
       * container: col-1 = topic content (number + title + description +
       * optional image), cols 2–4 = up to 3 related service cards. Card slots
       * are preserved when fewer than 3 services exist so the cards remain a
       * consistent width across topics. */}
      {topics.map((topic: {
        topic_number: number;
        title: string | null;
        description: string | null;
        image_url: string | null;
        service_line_slug: string | null;
        industry_page_topic_services: TopicService[] | null;
      }) => {
        const services = (topic.industry_page_topic_services ?? [])
          .filter((ts) => ts.services != null)
          .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
          .map((ts) => ts.services!);

        const CARD_SLOTS = 3;
        const slots = Array.from({ length: CARD_SLOTS }, (_, i) => services[i] ?? null);

        return (
          <section
            key={topic.topic_number}
            className="content-section"
            style={{ backgroundColor: TOPIC_TINTS[topic.topic_number] ?? 'var(--surface-secondary)' }}
          >
            <div className="container-lg">
              <div className="customer-topic-grid">
                <div className="customer-topic-grid__content">
                  <span style={{ ...label.smBold, color: color.text.brand }}>
                    {String(topic.topic_number).padStart(2, '0')}
                  </span>
                  {topic.title && <h3 style={heading.md}>{topic.title}</h3>}
                  {topic.description && (
                    <p style={{ ...text.body, color: color.text.primary }}>{topic.description}</p>
                  )}
                  {topic.image_url && (
                    <div className="customer-topic-grid__media">
                      <Image
                        src={topic.image_url}
                        alt={topic.title ?? ''}
                        fill
                        style={{ objectFit: 'cover' }}
                        sizes="(max-width: 991px) 100vw, 25vw"
                      />
                    </div>
                  )}
                </div>
                {slots.map((svc, idx) => {
                  if (!svc) {
                    return <div key={`empty-${idx}`} className="customer-topic-grid__slot" aria-hidden="true" />;
                  }
                  const lineSlug = svc.service_lines?.slug ?? topic.service_line_slug ?? 'brand';
                  const cat = mapServiceLineSlug(lineSlug);
                  return (
                    <div key={svc.id} className="customer-topic-grid__slot">
                      <ServiceCard
                        name={svc.name}
                        slug={svc.slug}
                        serviceLineSlug={lineSlug}
                        category={cat as ServiceLine}
                        tagline={svc.tagline}
                        description={svc.description}
                        imageUrl={svc.image_url}
                        iconServiceName={hasIconFor(cat, svc.name) ? svc.name : undefined}
                        showCta
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        );
      })}

      {/* Other industries — 3-col display cards. Card uses 1:1 image, title,
       * description (from tagline copy), and a md "Learn More" button. */}
      {otherPages.length > 0 && (
        <section className="content-section">
          <div className="container-lg container-lg--comfortable">
            <h2 style={heading.lg}>Other Industries</h2>
            <Grid columns={3}>
              {otherPages.map((p: { slug: string; name: string; tagline: string | null; image_url: string | null }) => (
                <Card
                  key={p.slug}
                  preset="display"
                  title={p.name}
                  description={p.tagline ?? undefined}
                  image={p.image_url ? (
                    <Frame ratio="square" fit="cover">
                      <Image src={p.image_url} alt={p.name} width={400} height={400} />
                    </Frame>
                  ) : undefined}
                  action={<LinkButton href={`/customers/${p.slug}`} variant="primary" size="md">Learn More</LinkButton>}
                />
              ))}
            </Grid>
          </div>
        </section>
      )}

      {/* Latest Customer Story — single related story (row layout). */}
      {stories.length > 0 && (
        <section className="content-section content-section--secondary">
          <div className="container-lg container-lg--comfortable">
            <h2 style={heading.lg}>Latest Customer Story</h2>
            <p style={{ ...text.body, color: color.text.primary, margin: 0 }}>
              We&rsquo;re more than a design studio&mdash;we&rsquo;re your strategic marketing partner.
            </p>
            <div className="customer-stories-list">
              {stories.slice(0, 1).map((story: {
                id: string;
                slug: string;
                name: string | null;
                client_name: string | null;
                industry: string | null;
                launch_date: string | null;
                short_description: string | null;
                hero_image_url: string | null;
                service_lines: { name: string; slug: string } | null;
                offerings: { name: string } | null;
              }) => (
                <CustomerStoryCard
                  key={story.id}
                  slug={story.slug}
                  name={story.name ?? ''}
                  clientName={story.client_name ?? ''}
                  industry={story.industry}
                  launchDate={story.launch_date}
                  serviceLineName={story.service_lines?.name ?? null}
                  serviceLineCategory={(story.service_lines?.slug ?? null) as ServiceLine | null}
                  serviceName={(story as { services?: { name: string } | null }).services?.name ?? null}
                  shortDescription={story.short_description}
                  imageUrl={story.hero_image_url}
                />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* CTA */}
      <section className="cta-section-brand">
        <div className="cta-card-brand">
          <h2 style={{ ...heading.lg, color: color.text.onColorDark, textAlign: 'center', margin: 0 }}>
            Get in Touch
          </h2>
          <p style={{ ...text.body, color: color.text.onColorDark, textAlign: 'center', margin: 0 }}>
            Let&apos;s talk about how we can help your {page.name.toLowerCase()} business.
          </p>
          <LinkButton href="/contact" variant="on-color" size="lg">
            Let&apos;s Talk
          </LinkButton>
        </div>
      </section>
    </>
  );
}
