import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { getAllPosts } from '@/lib/blog';
import '../shared-sections.css';
import './blog.css';

export const metadata: Metadata = {
  title: 'Blog | Tips, Guides & Insights for Small Businesses',
  description: 'Practical tips on branding, marketing, design systems, and running a small business — from the Brik Designs team.',
};

export default function BlogPage() {
  const posts = getAllPosts();

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

      <section className="content-section blog-section">
        <div className="container-lg">
          <div className="blog-grid">
            {posts.map((post) => (
              <Link key={post.slug} href={`/blog/${post.slug}`} className="blog-card">
                {post.image && (
                  <div className="blog-card__image">
                    <Image src={post.image} alt={post.title} fill style={{ objectFit: 'cover' }} sizes="(max-width: 768px) 100vw, 400px" />
                  </div>
                )}
                <div className="blog-card__content">
                  <h2 className="text-heading-sm">{post.title}</h2>
                  <div className="blog-card__meta">
                    <span className="text-label-sm text--secondary">
                      {new Date(post.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                    {post.duration && <span className="text-label-sm text--secondary">{post.duration}</span>}
                  </div>
                  <p className="text-body-sm text--secondary">{post.summary}</p>
                  {post.category && <span className="text-label-sm text--brand">{post.category}</span>}
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
