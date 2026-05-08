import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { getAllPosts } from '@/lib/blog';
import { text, heading, label } from '@/lib/styles';
import { color } from '@/lib/tokens';
import '../shared-sections.css';
import './blog.css';

export const metadata: Metadata = {
  title: 'Blog | Tips, Guides & Insights for Small Businesses',
  description: 'Practical tips on branding, marketing, design systems, and running a small business — from the Brik Designs team.',
};

export const revalidate = 600;

export default async function BlogPage() {
  const posts = await getAllPosts();

  return (
    <>
      <section className="page-hero">
        <div className="page-hero__container">
          <h1 className="page-hero__title">Blog</h1>
          <p className="page-hero__description">
            Practical tips on branding, marketing, and running a small business — brik by brik.
          </p>
        </div>
      </section>

      <section className="content-section">
        <div className="container-lg">
          <div className="content-wrapper content-wrapper--center" style={{ marginBottom: 'var(--gap-xl)' }}>
            <h2 style={{ ...heading.lg, textAlign: 'center', margin: 0 }}>Latest Posts</h2>
          </div>
          <div className="blog-grid">
            {posts.map((post) => (
              <Link key={post.slug} href={`/blog/${post.slug}`} className="blog-card">
                {post.image && (
                  <div className="blog-card__image">
                    <Image src={post.image} alt={post.title} fill style={{ objectFit: 'cover' }} sizes="(max-width: 768px) 100vw, 400px" />
                  </div>
                )}
                <div className="blog-card__content">
                  <h2 style={heading.sm}>{post.title}</h2>
                  <div className="blog-card__meta">
                    <span style={{ ...label.smBold, color: color.text.secondary }}>
                      {new Date(post.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                    {post.duration && <span style={{ ...label.smBold, color: color.text.secondary }}>{post.duration}</span>}
                  </div>
                  <p style={{ ...text.bodySm, color: color.text.secondary }}>{post.summary}</p>
                  {post.category && <span style={{ ...label.smBold, color: color.text.brand }}>{post.category}</span>}
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
