import { createClient } from '@/lib/supabase/server';

/**
 * Public blog post read helpers.
 *
 * Backed by the `blog_posts` Supabase table — anon RLS allows SELECT only
 * where `status = 'published'`, so unpublished drafts are invisible to the
 * marketing site automatically.
 *
 * Authoring happens in portal.brikdesigns.com/settings/blog-posts. The legacy
 * MDX files in content/blog/ have been ingested via scripts/seed-blog-from-mdx.ts
 * and are no longer read at runtime — pending a follow-up cleanup PR to delete them.
 */
export interface BlogPost {
  slug: string;
  title: string;
  summary: string;
  date: string;
  category: string;
  duration: string;
  featured: boolean;
  image?: string;
  ctaTitle?: string;
  ctaDescription?: string;
}

interface BlogPostRow {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string | null;
  featured_image_url: string | null;
  author: string | null;
  status: string;
  published_at: string | null;
  duration: string | null;
  featured: boolean | null;
  cta_title: string | null;
  cta_description: string | null;
  tags: string[] | null;
}

function rowToMeta(row: BlogPostRow): BlogPost {
  return {
    slug: row.slug,
    title: row.title,
    summary: row.excerpt ?? '',
    date: row.published_at ?? '',
    category: row.tags?.[0] ?? '',
    duration: row.duration ?? '',
    featured: Boolean(row.featured),
    image: row.featured_image_url ?? undefined,
    ctaTitle: row.cta_title ?? undefined,
    ctaDescription: row.cta_description ?? undefined,
  };
}

const SELECT =
  'id,title,slug,excerpt,content,featured_image_url,author,status,published_at,duration,featured,cta_title,cta_description,tags';

export async function getAllPosts(): Promise<BlogPost[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('blog_posts')
    .select(SELECT)
    .eq('status', 'published')
    .order('published_at', { ascending: false });

  if (error) throw error;
  return (data as BlogPostRow[] | null)?.map(rowToMeta) ?? [];
}

export async function getPostBySlug(slug: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from('blog_posts')
    .select(SELECT)
    .eq('slug', slug)
    .eq('status', 'published')
    .maybeSingle();

  if (!data) return null;
  const row = data as BlogPostRow;
  return {
    meta: rowToMeta(row),
    content: row.content ?? '',
  };
}

/**
 * Related posts for a blog detail page. Prefers posts sharing the current
 * post's category (first tag); tops up with the most-recent remaining posts
 * so the section is always populated. Excludes the current post.
 */
export async function getRelatedPosts(
  slug: string,
  category: string,
  limit = 3,
): Promise<BlogPost[]> {
  const others = (await getAllPosts()).filter((p) => p.slug !== slug);
  const sameCategory = category ? others.filter((p) => p.category === category) : [];
  const rest = others.filter((p) => !sameCategory.includes(p));
  return [...sameCategory, ...rest].slice(0, limit);
}
