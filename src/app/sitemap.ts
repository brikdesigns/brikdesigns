import type { MetadataRoute } from 'next';
import { getAllPosts } from '@/lib/blog';
import { createClient } from '@/lib/supabase/server';

const BASE_URL = 'https://www.brikdesigns.com';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
    { url: BASE_URL, changeFrequency: 'weekly', priority: 1.0 },
    { url: `${BASE_URL}/about`, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${BASE_URL}/services`, changeFrequency: 'weekly', priority: 0.9 },
    { url: `${BASE_URL}/plans`, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${BASE_URL}/industries`, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${BASE_URL}/customer-stories`, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${BASE_URL}/customers`, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${BASE_URL}/blog`, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${BASE_URL}/contact`, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${BASE_URL}/get-started`, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${BASE_URL}/free-marketing-analysis`, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${BASE_URL}/value`, changeFrequency: 'monthly', priority: 0.6 },
  ];

  // Blog posts (MDX files)
  const posts = getAllPosts();
  const blogPages: MetadataRoute.Sitemap = posts.map((post) => ({
    url: `${BASE_URL}/blog/${post.slug}`,
    lastModified: post.date ? new Date(post.date) : undefined,
    changeFrequency: 'monthly',
    priority: 0.7,
  }));

  // Supabase dynamic content
  const supabase = await createClient();

  // Service categories
  const { data: categories } = await supabase
    .from('service_lines')
    .select('slug')
    .eq('is_public', true);

  const categoryPages: MetadataRoute.Sitemap = (categories || []).map((cat) => ({
    url: `${BASE_URL}/services/${cat.slug}`,
    changeFrequency: 'weekly' as const,
    priority: 0.8,
  }));

  // Individual services
  const { data: services } = await supabase
    .from('services')
    .select('slug, service_lines(slug)')
    .eq('is_public', true);

  const servicePages: MetadataRoute.Sitemap = (services || []).map((svc) => {
    const cats = svc.service_lines as unknown as { slug: string }[] | { slug: string } | null;
    const catSlug = Array.isArray(cats) ? cats[0]?.slug : cats?.slug || '';
    return {
      url: `${BASE_URL}/services/${catSlug}/${svc.slug}`,
      changeFrequency: 'monthly' as const,
      priority: 0.7,
    };
  });

  // Industry pages
  const { data: industries } = await supabase
    .from('industry_pages')
    .select('slug')
    .eq('is_public', true);

  const industryPages: MetadataRoute.Sitemap = (industries || []).map((ind) => ({
    url: `${BASE_URL}/industries/${ind.slug}`,
    changeFrequency: 'monthly' as const,
    priority: 0.7,
  }));

  // Customer stories
  const { data: stories } = await supabase
    .from('customer_stories')
    .select('slug')
    .eq('is_public', true);

  const storyPages: MetadataRoute.Sitemap = (stories || []).map((story) => ({
    url: `${BASE_URL}/customer-stories/${story.slug}`,
    changeFrequency: 'monthly' as const,
    priority: 0.6,
  }));

  return [
    ...staticPages,
    ...blogPages,
    ...categoryPages,
    ...servicePages,
    ...industryPages,
    ...storyPages,
  ];
}
