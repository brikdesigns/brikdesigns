import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { getIndustryPageBySlug, getIndustryPages, getCustomerStoriesByIndustry, mapCategorySlug } from '@/lib/supabase/queries';
import { Breadcrumb, LinkButton } from '@brikdesigns/bds';
import { text, heading, label } from '@/lib/styles';
import { color, gap } from '@/lib/tokens';
import { CustomerStoryCard } from '@/components/marketing/CustomerStoryCard';
import { ServiceCard } from '@/components/marketing/ServiceCard';
import { hasIconFor } from '@/lib/service-icons';
import type { ServiceCategory } from '@brikdesigns/bds';
import '../../shared-sections.css';
import '../customers.css';

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
      {/* Hero — breadcrumb + name + tagline + intro_description (Webflow parity).
       * intro_description folded into the hero so the page leads with industry
       * content, not the stories section. Optional dual-badge decoration on the
       * aside slot. */}
      <section className="page-hero">
        <div className="page-hero__container">
          <Breadcrumb
            style={{ marginBottom: gap.sm, flexWrap: 'wrap' }}
            items={[
              { label: 'Home', href: '/' },
              { label: 'Customers', href: '/customers' },
              { label: page.name },
            ]}
          />
          <div className="customer-detail-hero">
            <div>
              <h1 className="page-hero__title">{page.name}</h1>
              {page.tagline && <p className="page-hero__tagline">{page.tagline}</p>}
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

      {/* Topic sections — tinted bg per topic; split layout when image
       * present. Each topic carries title + description + a curated grid
       * of related service cards (Webflow per-topic structure from
       * portal #797). */}
      {topics.map((topic: {
        topic_number: number;
        title: string | null;
        description: string | null;
        image_url: string | null;
        service_line_slug: string | null;
        industry_page_topic_services: TopicService[] | null;
      }) => {
        // Order services by the topic-junction sort_order, drop any null
        // service joins (shouldn't happen post-FK retarget, but defensive).
        const services = (topic.industry_page_topic_services ?? [])
          .filter((ts) => ts.services != null)
          .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
          .map((ts) => ts.services!);

        return (
          <section
            key={topic.topic_number}
            className="content-section"
            style={{ backgroundColor: TOPIC_TINTS[topic.topic_number] ?? 'var(--surface-secondary)' }}
          >
            <div className="container-lg">
              {topic.image_url ? (
                /* Split layout: image + content side by side (unique layout) */
                <div className="customer-topic">
                  <div className="customer-topic__image">
                    <Image
                      src={topic.image_url}
                      alt={topic.title ?? ''}
                      fill
                      style={{ objectFit: 'cover' }}
                      sizes="(max-width: 991px) 100vw, 50vw"
                    />
                  </div>
                  <div className="customer-topic__content">
                    <span style={{ ...label.smBold, color: color.text.brand }}>
                      {String(topic.topic_number).padStart(2, '0')}
                    </span>
                    {topic.title && <h3 style={heading.md}>{topic.title}</h3>}
                    {topic.description && (
                      <p style={{ ...text.body, color: color.text.primary }}>{topic.description}</p>
                    )}
                  </div>
                </div>
              ) : (
                /* Text-only layout */
                <div className="industry-topic">
                  <div className="industry-topic__container">
                    <span style={{ ...label.smBold, color: color.text.brand }}>
                      {String(topic.topic_number).padStart(2, '0')}
                    </span>
                    {topic.title && <h3 style={heading.md}>{topic.title}</h3>}
                    {topic.description && (
                      <p style={{ ...text.body, color: color.text.primary }}>{topic.description}</p>
                    )}
                  </div>
                </div>
              )}

              {/* Related service cards for this topic. Each card routes
               * /services/{line}/{slug}; categorySlug derived from the
               * service's own service_lines join (not the topic's
               * service_line_slug — they can diverge for "Other Services"
               * topics that mix lines). */}
              {services.length > 0 && (
                <div
                  className="grid-3"
                  style={{ marginTop: 'var(--gap-xl)' }}
                >
                  {services.map((svc) => {
                    const lineSlug = svc.service_lines?.slug ?? topic.service_line_slug ?? 'brand';
                    const cat = mapCategorySlug(lineSlug);
                    return (
                      <ServiceCard
                        key={svc.id}
                        name={svc.name}
                        slug={svc.slug}
                        categorySlug={lineSlug}
                        category={cat as ServiceCategory}
                        tagline={svc.tagline}
                        description={svc.description}
                        imageUrl={svc.image_url}
                        iconServiceName={hasIconFor(cat, svc.name) ? svc.name : undefined}
                        showCta
                      />
                    );
                  })}
                </div>
              )}
            </div>
          </section>
        );
      })}

      {/* Other industries — placed before customer story (Webflow order). */}
      {otherPages.length > 0 && (
        <section className="content-section">
          <div className="container-lg container-lg--comfortable">
            <div className="content-wrapper content-wrapper--center" style={{ marginBottom: 'var(--gap-xl)' }}>
              <h2 style={{ ...heading.lg, textAlign: 'center', margin: 0 }}>Other Industries</h2>
            </div>
            <div className="customer-others-grid">
              {otherPages.map((p: { slug: string; name: string; tagline: string | null }) => (
                <Link key={p.slug} href={`/customers/${p.slug}`} className="customer-other-card">
                  <h3 style={heading.sm}>{p.name}</h3>
                  {p.tagline && (
                    <p style={{ ...text.bodySm, color: color.text.secondary }}>{p.tagline}</p>
                  )}
                  <span style={{ ...label.smBold, color: color.text.brand, marginTop: 'auto' }}>
                    Learn more →
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Latest Customer Story — single related story (row layout). */}
      {stories.length > 0 && (
        <section className="content-section content-section--secondary">
          <div className="container-lg container-lg--comfortable">
            <div className="content-wrapper content-wrapper--center" style={{ marginBottom: 'var(--gap-xl)' }}>
              <h2 style={{ ...heading.lg, textAlign: 'center', margin: 0 }}>Latest Customer Story</h2>
            </div>
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
                  serviceLineCategory={(story.service_lines?.slug ?? null) as ServiceCategory | null}
                  serviceName={story.offerings?.name ?? null}
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
          <LinkButton href="/contact" variant="inverse" size="lg">
            Let&apos;s Talk
          </LinkButton>
        </div>
      </section>
    </>
  );
}
