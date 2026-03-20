import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { getAllPosts } from '@/lib/blog';

export const metadata: Metadata = {
  title: 'Blog | Tips, Guides & Insights for Small Businesses',
  description: 'Practical tips on branding, marketing, design systems, and running a small business — from the Brik Designs team.',
};

export default function BlogPage() {
  const posts = getAllPosts();

  return (
    <section style={{ maxWidth: 1200, margin: '0 auto', padding: 'var(--padding-xl) var(--padding-lg)' }}>
      <h1 style={{ fontFamily: 'var(--font-family-heading)', fontSize: 'var(--heading-xl)', color: 'var(--text-primary)', margin: 0 }}>
        Blog
      </h1>
      <p style={{ fontFamily: 'var(--font-family-body)', fontSize: 'var(--body-lg)', color: 'var(--text-secondary)', marginTop: 'var(--gap-md)' }}>
        Practical tips on branding, marketing, and running a small business — brik by brik.
      </p>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
          gap: 'var(--gap-lg)',
          marginTop: 'var(--gap-xl)',
        }}
      >
        {posts.map((post) => (
          <Link
            key={post.slug}
            href={`/blog/${post.slug}`}
            style={{
              display: 'flex',
              flexDirection: 'column',
              backgroundColor: 'var(--surface-primary)',
              border: '1px solid var(--border-secondary)',
              borderRadius: 'var(--border-radius-md)',
              overflow: 'hidden',
              textDecoration: 'none',
              transition: 'border-color 0.15s, box-shadow 0.15s',
            }}
          >
            {post.image && (
              <div style={{ position: 'relative', width: '100%', aspectRatio: '16/9', backgroundColor: 'var(--surface-secondary)' }}>
                <Image
                  src={post.image}
                  alt={post.title}
                  fill
                  style={{ objectFit: 'cover' }}
                  sizes="(max-width: 768px) 100vw, 400px"
                />
              </div>
            )}
            <div style={{ padding: 'var(--padding-lg)', flex: 1, display: 'flex', flexDirection: 'column' }}>
              <h2 style={{ fontFamily: 'var(--font-family-heading)', fontSize: 'var(--heading-sm)', color: 'var(--text-primary)', margin: 0 }}>
                {post.title}
              </h2>
              <div style={{ display: 'flex', gap: 'var(--gap-md)', marginTop: 'var(--gap-sm)' }}>
                <span style={{ fontFamily: 'var(--font-family-label)', fontSize: 'var(--body-xs)', color: 'var(--text-muted)' }}>
                  {new Date(post.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
                {post.duration && (
                  <span style={{ fontFamily: 'var(--font-family-label)', fontSize: 'var(--body-xs)', color: 'var(--text-muted)' }}>
                    {post.duration}
                  </span>
                )}
              </div>
              <p style={{ fontFamily: 'var(--font-family-body)', fontSize: 'var(--body-sm)', color: 'var(--text-secondary)', marginTop: 'var(--gap-sm)', flex: 1, lineHeight: 1.6 }}>
                {post.summary}
              </p>
              {post.category && (
                <span style={{ fontFamily: 'var(--font-family-label)', fontSize: 'var(--body-xs)', color: 'var(--text-brand-primary)', marginTop: 'var(--gap-sm)' }}>
                  {post.category}
                </span>
              )}
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
