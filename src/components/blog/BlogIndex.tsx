'use client';

import { useMemo, useState } from 'react';
import Image from 'next/image';
import { Icon } from '@/lib/icon';
import {
  Card,
  CardTitle,
  CardDescription,
  CardFooter,
  Frame,
  Grid,
  Button,
  SegmentedControl,
} from '@brikdesigns/bds';
import type { BlogPost } from '@/lib/blog';
import { label, text } from '@/lib/styles';
import { color } from '@/lib/tokens';

const ALL = '__all__';

/** Initial visible cap; a "Load more" control reveals the rest. Mirrors the
 *  customer-stories list (CustomerStoriesList.tsx). Capping the grid bounds the
 *  height delta on a filter switch, which is what kills the layout lurch — an
 *  unbounded 12→2 collapse produced CLS ~0.49 and yanked the control the user
 *  just clicked (#710 / BACKLOG-659). */
const INITIAL_VISIBLE = 6;
const LOAD_STEP = 6;

interface Props {
  posts: BlogPost[];
}

/**
 * Blog index grid with a type filter.
 *
 * The control is data-driven from each post's canonical service line
 * (`primary_category_id` FK → `service_lines`, set via the drift-proof
 * "Primary service line" picker in the portal). Segments are the distinct
 * service lines present, ordered by `service_lines.sort_order` so they match
 * the site-wide service ordering. Filtering is client-side `useState` — the
 * server page stays statically generated. Long-label overflow on narrow
 * viewports is handled by the `.blog-filter` scroll container (see blog.css).
 *
 * Results are capped at INITIAL_VISIBLE with a "Load more" reveal; the cap
 * resets on every filter change so switching categories never collapses a tall
 * grid under the user (the #710 jitter fix).
 */
export function BlogIndex({ posts }: Props) {
  const lines = useMemo(() => {
    const seen = new Map<string, { slug: string; name: string; rank: number }>();
    for (const p of posts) {
      if (p.serviceLineSlug && !seen.has(p.serviceLineSlug)) {
        seen.set(p.serviceLineSlug, {
          slug: p.serviceLineSlug,
          name: p.serviceLine,
          rank: p.serviceLineRank,
        });
      }
    }
    return Array.from(seen.values()).sort((a, b) => a.rank - b.rank);
  }, [posts]);

  const items = useMemo(
    () => [{ label: 'All', value: ALL }, ...lines.map((l) => ({ label: l.name, value: l.slug }))],
    [lines],
  );

  const [active, setActive] = useState<string>(ALL);
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE);

  // Reset the cap whenever the filter changes, so a new category always opens
  // at INITIAL_VISIBLE rather than inheriting a larger "Load more" count.
  const handleChange = (next: string) => {
    setActive(next);
    setVisibleCount(INITIAL_VISIBLE);
  };

  const filtered = active === ALL ? posts : posts.filter((p) => p.serviceLineSlug === active);
  const visible = filtered.slice(0, visibleCount);
  const hasMore = filtered.length > visibleCount;

  return (
    <>
      {lines.length > 0 && (
        <div className="blog-filter">
          <div className="blog-filter__inner">
            <SegmentedControl
              items={items}
              value={active}
              onChange={handleChange}
              size="sm"
              aria-label="Filter posts by type"
            />
          </div>
        </div>
      )}

      {visible.length === 0 ? (
        <p className="blog-filter__empty" style={{ ...text.body, color: color.text.secondary }}>
          No posts in this category yet.
        </p>
      ) : (
        <Grid columns={3} gap="lg">
          {visible.map((post) => (
            <Card key={post.slug} variant="outlined" padding="none" className="blog-card">
              {post.image && (
                <Frame customRatio="16 / 9" fit="cover" className="blog-card__media">
                  <Image
                    src={post.image}
                    alt={post.title}
                    fill
                    style={{ objectFit: 'cover' }}
                    sizes="(max-width: 768px) 100vw, 400px"
                  />
                </Frame>
              )}
              <div className="blog-card__content">
                <CardTitle as="h2">{post.title}</CardTitle>
                <div className="blog-card__meta">
                  <span
                    className="blog-card__meta-item"
                    style={{ ...label.sm, color: color.text.secondary }}
                  >
                    <Icon icon="ph:calendar-blank" width={16} height={16} aria-hidden />
                    {new Date(post.date).toLocaleDateString('en-US', {
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </span>
                  {post.duration && (
                    <span
                      className="blog-card__meta-item"
                      style={{ ...label.sm, color: color.text.secondary }}
                    >
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
      )}

      {hasMore && (
        <div className="blog-loadmore">
          <Button
            variant="outline"
            size="lg"
            onClick={() => setVisibleCount((count) => count + LOAD_STEP)}
          >
            Load more
          </Button>
        </div>
      )}
    </>
  );
}
