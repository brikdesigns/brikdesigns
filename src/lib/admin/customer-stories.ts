import { createClient } from '@/lib/supabase/server';
import { pickAndValidate, type FieldSchema } from './_validation';

/**
 * customer_stories carries both portfolio narrative + media galleries.
 * service_slug / service_line_slug are denormalized lookup columns the
 * marketing site reads directly (see queries.ts:getStoriesByService) — keep
 * them in sync with primary_service_id / primary_category_id manually for
 * now. A future trigger could auto-populate.
 */
const SCHEMA: FieldSchema = {
  // Identity
  name: 'string',
  slug: 'string',
  client_name: 'string',
  short_description: 'string-or-null',
  industry: 'string-or-null',
  // Linking
  primary_service_id: 'uuid',
  primary_category_id: 'uuid',
  service_slug: 'string-or-null',
  service_line_slug: 'string-or-null',
  website_url: 'string-or-null',
  client_website: 'string-or-null',
  client_website_display: 'string-or-null',
  // Hero + thumb
  hero_image_url: 'string-or-null',
  hero_video_url: 'string-or-null',
  thumbnail_url: 'string-or-null',
  // Brand assets
  client_logo_url: 'string-or-null',
  client_icon_url: 'string-or-null',
  industry_badge_url: 'string-or-null',
  service_line_icon_url: 'string-or-null',
  // Story
  the_challenge: 'string-or-null',
  the_solution: 'string-or-null',
  results: 'string-or-null',
  quote: 'string-or-null',
  quote_attribution: 'string-or-null',
  // Before/after/results media
  before_photo_url: 'string-or-null',
  after_photo_url: 'string-or-null',
  results_photo_url: 'string-or-null',
  before_video_url: 'string-or-null',
  after_video_url: 'string-or-null',
  results_video_url: 'string-or-null',
  // Metadata
  launch_date: 'string-or-null',
  award_label: 'string-or-null',
  // Publishing
  rank: 'number',
  is_public: 'boolean',
};

export async function listCustomerStories() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('customer_stories')
    .select('id, name, slug, client_name, industry, rank, is_public, updated_at')
    .order('rank', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function getCustomerStoryById(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('customer_stories')
    .select('*')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data;
}

export async function createCustomerStory(input: unknown) {
  const payload = pickAndValidate(input, SCHEMA, {
    required: ['name', 'slug', 'client_name'],
  });
  if (payload.is_public === undefined) payload.is_public = false;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('customer_stories')
    .insert(payload)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateCustomerStory(id: string, patch: unknown) {
  const payload = pickAndValidate(patch, SCHEMA);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('customer_stories')
    .update(payload)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteCustomerStory(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from('customer_stories').delete().eq('id', id);
  if (error) throw error;
}
