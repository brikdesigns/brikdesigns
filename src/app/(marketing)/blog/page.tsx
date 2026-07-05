import type { Metadata } from 'next';
import { getAllPosts } from '@/lib/blog';
import { ScrollDownCta } from '@/components/ui/ScrollDownCta';
import { BlogIndex } from '@/components/blog/BlogIndex';
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
        <ScrollDownCta />
      </section>

      <section className="page-section">
        <div className="container-lg">
          <BlogIndex posts={posts} />
        </div>
      </section>
    </>
  );
}
