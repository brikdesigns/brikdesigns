import type { Metadata } from 'next';
import Image from 'next/image';
import { Icon } from '@iconify/react';
import { Card, CardTitle, CardDescription, CardFooter, Grid, Button } from '@brikdesigns/bds';
import { getAllPosts } from '@/lib/blog';
import { label } from '@/lib/styles';
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
          <Grid columns={3} gap="lg">
            {posts.map((post) => (
              <Card key={post.slug} variant="outlined" padding="none" className="blog-card">
                {post.image && (
                  <div className="blog-card__media">
                    <Image
                      src={post.image}
                      alt={post.title}
                      fill
                      style={{ objectFit: 'cover' }}
                      sizes="(max-width: 768px) 100vw, 400px"
                    />
                  </div>
                )}
                <div className="blog-card__content">
                  <CardTitle as="h2">{post.title}</CardTitle>
                  <div className="blog-card__meta">
                    <span className="blog-card__meta-item" style={{ ...label.sm, color: color.text.secondary }}>
                      <Icon icon="ph:calendar-blank" width={16} height={16} aria-hidden />
                      {new Date(post.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                    </span>
                    {post.duration && (
                      <span className="blog-card__meta-item" style={{ ...label.sm, color: color.text.secondary }}>
                        <Icon icon="ph:clock" width={16} height={16} aria-hidden />
                        {post.duration}
                      </span>
                    )}
                  </div>
                  <CardDescription>{post.summary}</CardDescription>
                  <CardFooter>
                    <Button href={`/blog/${post.slug}`} variant="primary" size="md">
                      Read Article
                    </Button>
                  </CardFooter>
                </div>
              </Card>
            ))}
          </Grid>
        </div>
      </section>
    </>
  );
}
