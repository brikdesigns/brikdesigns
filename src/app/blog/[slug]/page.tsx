import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Image from 'next/image';
import { Icon } from '@iconify/react';
import { Breadcrumb, Button } from '@brikdesigns/bds';
import { getPostBySlug } from '@/lib/blog';
import { MDXRemote } from '@/components/blog/MDXRemote';
import { heading, text, label } from '@/lib/styles';
import { color, gap } from '@/lib/tokens';
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

  return (
    <>
      <section className="content-section">
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

      {meta.ctaTitle && (
        <section className="cta-section-brand">
          <div className="cta-card-brand">
            <h2 style={{ ...heading.lg, color: color.text.onColorDark, textAlign: 'center' }}>
              {meta.ctaTitle}
            </h2>
            {meta.ctaDescription && (
              <p style={{ ...text.body, color: color.text.onColorDark, textAlign: 'center', opacity: 0.9 }}>
                {meta.ctaDescription}
              </p>
            )}
            <Button href="/contact" variant="on-color" size="md">
              Let&apos;s Talk
            </Button>
          </div>
        </section>
      )}
    </>
  );
}
