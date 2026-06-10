import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Image from 'next/image';
import { Icon } from '@iconify/react';
import {
  Breadcrumb,
  Button,
  Card,
  CardDescription,
  CardFooter,
  CardTitle,
  Frame,
  Grid,
  LinkButton,
  ServiceTag,
} from '@brikdesigns/bds';
import { getPostBySlug, getRelatedPosts } from '@/lib/blog';
import { getServiceCategories, getRelatedServicesForPost, mapServiceLineSlug } from '@/lib/supabase/queries';
import { routeSlugForServiceLine } from '@/lib/service-line-routes';
import { hasIconFor } from '@/lib/service-icons';
import { ServiceCard } from '@/components/marketing/ServiceCard';
import { MDXRemote } from '@/components/blog/MDXRemote';
import { heading, text, label } from '@/lib/styles';
import { color, gap, serviceColor } from '@/lib/tokens';
import '../../shared-sections.css';
import '../blog.css';

type Props = { params: Promise<{ slug: string }> };

export const revalidate = 600;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPostBySlug(slug);
  if (!post) return { title: 'Post Not Found' };
  return {
    title: post.meta.title,
    description: post.meta.summary,
    openGraph: {
      title: post.meta.title,
      description: post.meta.summary,
      type: 'article',
      publishedTime: post.meta.date,
      images: post.meta.image ? [post.meta.image] : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title: post.meta.title,
      description: post.meta.summary,
    },
  };
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  const post = await getPostBySlug(slug);
  if (!post) notFound();

  const { meta, content } = post;

  const [relatedPosts, serviceLines, relatedServices] = await Promise.all([
    getRelatedPosts(slug, meta.category),
    getServiceCategories(),
    getRelatedServicesForPost(slug),
  ]);

  return (
    <>
      <section className="page-section">
        <div className="container-lg container-lg--post">
          <Breadcrumb
            style={{ marginBottom: gap.md, flexWrap: 'wrap' }}
            items={[
              { label: 'Home', href: '/' },
              { label: 'Blog', href: '/blog' },
              { label: meta.title },
            ]}
          />

          <h1 style={heading.lg}>{meta.title}</h1>

          <div className="blog-post__meta">
            <span className="blog-post__meta-item" style={{ ...label.sm, color: color.text.secondary }}>
              <Icon icon="ph:calendar-blank" width={16} height={16} aria-hidden />
              {new Date(meta.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
            </span>
            {meta.duration && (
              <span className="blog-post__meta-item" style={{ ...label.sm, color: color.text.secondary }}>
                <Icon icon="ph:clock" width={16} height={16} aria-hidden />
                {meta.duration}
              </span>
            )}
          </div>

          {meta.image && (
            <div className="blog-post__media">
              <Image
                src={meta.image}
                alt={meta.title}
                fill
                style={{ objectFit: 'cover' }}
                sizes="760px"
                priority
              />
            </div>
          )}

          {meta.summary && (
            <p style={{ ...text.bodyHuge, color: color.text.secondary, marginTop: gap.xl }}>
              {meta.summary}
            </p>
          )}

          <article className="blog-post__content">
            <MDXRemote source={content} />
          </article>
        </div>
      </section>

      {/* ═══ Related blogs ═══ */}
      {relatedPosts.length > 0 && (
        <section className="page-section page-section--accent">
          <div className="container-lg">
            <h2 style={{ ...heading.lg, textAlign: 'center', marginBottom: gap.lg }}>
              Keep reading
            </h2>
            <Grid columns={3} gap="lg">
              {relatedPosts.map((related) => (
                <Card key={related.slug} variant="outlined" padding="none" className="blog-card">
                  {related.image && (
                    <div className="blog-card__media">
                      <Image
                        src={related.image}
                        alt={related.title}
                        fill
                        style={{ objectFit: 'cover' }}
                        sizes="(max-width: 768px) 100vw, 400px"
                      />
                    </div>
                  )}
                  <div className="blog-card__content">
                    <CardTitle as="h3">{related.title}</CardTitle>
                    <div className="blog-card__meta">
                      <span className="blog-card__meta-item" style={{ ...label.sm, color: color.text.secondary }}>
                        <Icon icon="ph:calendar-blank" width={16} height={16} aria-hidden />
                        {new Date(related.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                      </span>
                      {related.duration && (
                        <span className="blog-card__meta-item" style={{ ...label.sm, color: color.text.secondary }}>
                          <Icon icon="ph:clock" width={16} height={16} aria-hidden />
                          {related.duration}
                        </span>
                      )}
                    </div>
                    <CardDescription>{related.summary}</CardDescription>
                    <CardFooter>
                      <Button href={`/blog/${related.slug}`} variant="primary" size="md">
                        Read Article
                      </Button>
                    </CardFooter>
                  </div>
                </Card>
              ))}
            </Grid>
          </div>
        </section>
      )}

      {/* ═══ Related services ═══
       * Per-post match when an editor has associated services with this post
       * via the portal CMS (blog_post_services junction, #405) — renders those
       * specific services. Falls back to the generic "explore our services"
       * band (all public service lines) when none are set, so the section is
       * never empty. The generic band reuses the "Other Service Lines"
       * display-card pattern from the service-line landing page.
       */}
      {relatedServices.length > 0 ? (
        <section className="page-section">
          <div className="container-lg container-lg--comfortable">
            <h2 style={{ ...heading.lg, textAlign: 'center', marginBottom: gap.lg }}>
              Related services
            </h2>
            <Grid columns={3} gap="md">
              {relatedServices.map((svc) => {
                const lineSlug = svc.service_lines?.slug;
                if (!lineSlug) return null;
                const cat = mapServiceLineSlug(lineSlug);
                return (
                  <ServiceCard
                    key={svc.slug}
                    name={svc.name}
                    slug={svc.slug}
                    serviceLineSlug={routeSlugForServiceLine(lineSlug)}
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
      ) : serviceLines.length > 0 ? (
        <section className="page-section">
          <div className="container-lg container-lg--comfortable">
            <h2 style={{ ...heading.lg, textAlign: 'center', marginBottom: gap.lg }}>
              Explore our services
            </h2>
            <Grid columns={3} gap="md">
              {serviceLines.map((line) => {
                const lineKey = mapServiceLineSlug(line.slug);
                const lineColors = serviceColor(lineKey);
                return (
                  <div
                    key={line.slug}
                    style={{ '--background-brand-primary': lineColors.inverse, '--text-brand-primary': lineColors.text } as React.CSSProperties}
                  >
                    <Card
                      preset="display"
                      title={line.name}
                      description={line.tagline ?? undefined}
                      image={
                        line.card_image_url ? (
                          <Frame customRatio="3 / 2" fit="contain">
                            <Image src={line.card_image_url} alt={line.name} fill />
                          </Frame>
                        ) : undefined
                      }
                      tag={<ServiceTag category={lineKey} variant="icon" size="md" />}
                      action={<LinkButton href={`/services/${routeSlugForServiceLine(line.slug)}`} variant="primary" size="md">Learn More</LinkButton>}
                    />
                  </div>
                );
              })}
            </Grid>
          </div>
        </section>
      ) : null}

      {meta.ctaTitle && (
        <section className="cta-section-brand">
          <div className="cta-card-brand">
            <h2 style={{ ...heading.lg, color: color.text.onColorDark, textAlign: 'center' }}>
              {meta.ctaTitle}
            </h2>
            <p style={{ ...text.body, color: color.text.onColorDark, textAlign: 'center', opacity: 0.9 }}>
              {meta.ctaDescription ?? 'Starting a new project or want to collaborate with us?'}
            </p>
            <Button href="/contact" variant="on-color" size="md">
              Let&apos;s Talk
            </Button>
          </div>
        </section>
      )}
    </>
  );
}
