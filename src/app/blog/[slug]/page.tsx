import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { getAllPosts, getPostBySlug } from '@/lib/blog';
import { MDXRemote } from '@/components/blog/MDXRemote';
import { ArticleJsonLd } from '@/components/seo/JsonLd';

type Props = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  const posts = getAllPosts();
  return posts.map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) return { title: 'Post Not Found' };
  return {
    title: post.meta.title,
    description: post.meta.summary,
    alternates: { canonical: `/blog/${slug}` },
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
      images: post.meta.image ? [post.meta.image] : undefined,
    },
  };
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) notFound();

  const { meta, content } = post;

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://brikdesigns.com';

  return (
    <>
      <ArticleJsonLd
        title={meta.title}
        description={meta.summary}
        url={`${siteUrl}/blog/${slug}`}
        image={meta.image}
        datePublished={meta.date}
        category={meta.category}
      />
      <article style={{ maxWidth: 720, margin: '0 auto', padding: 'var(--padding-xl) var(--padding-lg)' }}>
        {/* Header */}
        <h1 style={{ fontFamily: 'var(--font-family-display)', fontSize: 'var(--heading-xl)', color: 'var(--text-primary)', margin: 0, lineHeight: 1.15 }}>
          {meta.title}
        </h1>
        <div style={{ display: 'flex', gap: 'var(--gap-lg)', marginTop: 'var(--gap-md)', flexWrap: 'wrap' }}>
          <span style={{ fontFamily: 'var(--font-family-label)', fontSize: 'var(--body-sm)', color: 'var(--text-muted)' }}>
            {new Date(meta.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
          </span>
          {meta.duration && (
            <span style={{ fontFamily: 'var(--font-family-label)', fontSize: 'var(--body-sm)', color: 'var(--text-muted)' }}>
              {meta.duration}
            </span>
          )}
          {meta.category && (
            <span style={{ fontFamily: 'var(--font-family-label)', fontSize: 'var(--body-sm)', color: 'var(--text-brand-primary)' }}>
              {meta.category}
            </span>
          )}
        </div>

        {/* Featured image */}
        {meta.image && (
          <div style={{ position: 'relative', width: '100%', aspectRatio: '16/9', marginTop: 'var(--gap-xl)', borderRadius: 'var(--border-radius-md)', overflow: 'hidden' }}>
            <Image
              src={meta.image}
              alt={meta.title}
              fill
              style={{ objectFit: 'cover' }}
              sizes="720px"
              priority
            />
          </div>
        )}

        {/* Content */}
        <div style={{ marginTop: 'var(--gap-xl)' }}>
          <MDXRemote source={content} />
        </div>
      </article>

      {/* CTA */}
      {meta.ctaTitle && (
        <section style={{ backgroundColor: 'var(--surface-brand-primary)', padding: 'var(--padding-xl) var(--padding-lg)', textAlign: 'center' }}>
          <h2 style={{ fontFamily: 'var(--font-family-heading)', fontSize: 'var(--heading-lg)', color: 'var(--text-on-color-dark)', margin: 0 }}>
            {meta.ctaTitle}
          </h2>
          {meta.ctaDescription && (
            <p style={{ fontFamily: 'var(--font-family-body)', fontSize: 'var(--body-md)', color: 'var(--text-on-color-dark)', opacity: 0.9, marginTop: 'var(--gap-md)' }}>
              {meta.ctaDescription}
            </p>
          )}
          <Link
            href="/services"
            style={{
              display: 'inline-block',
              marginTop: 'var(--gap-lg)',
              fontFamily: 'var(--font-family-label)',
              fontSize: 'var(--label-md)',
              fontWeight: 600,
              color: 'var(--text-brand-primary)',
              backgroundColor: 'var(--surface-primary)',
              padding: 'var(--padding-sm) var(--padding-lg)',
              borderRadius: 'var(--border-radius-md)',
              textDecoration: 'none',
            }}
          >
            Explore Services
          </Link>
        </section>
      )}
    </>
  );
}
