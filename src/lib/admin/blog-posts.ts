import { createClient } from '@/lib/supabase/server';
import { pickAndValidate, AdminInputError, type FieldSchema } from './_validation';

const SCHEMA: FieldSchema = {
  title: 'string',
  slug: 'string',
  excerpt: 'string-or-null',
  content: 'string-or-null',
  featured_image_url: 'string-or-null',
  author: 'string-or-null',
  status: 'string',
  published_at: 'string-or-null',
  seo_title: 'string-or-null',
  seo_description: 'string-or-null',
  duration: 'string-or-null',
  featured: 'boolean',
  cta_title: 'string-or-null',
  cta_description: 'string-or-null',
};

const ALLOWED_STATUSES = new Set(['draft', 'published', 'archived']);

function validateStatusAndTags(payload: Record<string, unknown>, rawTags: unknown): Record<string, unknown> {
  if (payload.status !== undefined && !ALLOWED_STATUSES.has(payload.status as string)) {
    throw new AdminInputError(`status must be one of: ${[...ALLOWED_STATUSES].join(', ')}`);
  }
  if (rawTags !== undefined) {
    if (!Array.isArray(rawTags) || !rawTags.every((t) => typeof t === 'string')) {
      throw new AdminInputError('tags must be an array of strings');
    }
    payload.tags = rawTags;
  }
  return payload;
}

export async function listBlogPosts() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('blog_posts')
    .select('id, title, slug, status, published_at, featured, tags, updated_at')
    .order('published_at', { ascending: false, nullsFirst: false });
  if (error) throw error;
  return data ?? [];
}

export async function getBlogPostById(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('blog_posts')
    .select('*')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data;
}

export async function createBlogPost(input: unknown) {
  if (!input || typeof input !== 'object') throw new AdminInputError('Body must be a JSON object');
  const raw = input as Record<string, unknown>;
  const payload = pickAndValidate(raw, SCHEMA, { required: ['title', 'slug', 'status'] });
  validateStatusAndTags(payload, raw.tags);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('blog_posts')
    .insert(payload)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateBlogPost(id: string, patch: unknown) {
  if (!patch || typeof patch !== 'object') throw new AdminInputError('Body must be a JSON object');
  const raw = patch as Record<string, unknown>;
  const payload = pickAndValidate(raw, SCHEMA);
  validateStatusAndTags(payload, raw.tags);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('blog_posts')
    .update(payload)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteBlogPost(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from('blog_posts').delete().eq('id', id);
  if (error) throw error;
}
