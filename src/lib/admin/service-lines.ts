import { createClient } from '@/lib/supabase/server';
import { pickAndValidate, type FieldSchema } from './_validation';

const SCHEMA: FieldSchema = {
  name: 'string',
  slug: 'string',
  tagline: 'string-or-null',
  description: 'string-or-null',
  hero_image_url: 'string-or-null',
  card_image_url: 'string-or-null',
  color_light: 'string-or-null',
  color_base: 'string-or-null',
  color_dark: 'string-or-null',
  brand_color_light: 'string-or-null',
  brand_color_base: 'string-or-null',
  brand_color_dark: 'string-or-null',
  support_plan_slug: 'string-or-null',
  support_plan_image_url: 'string-or-null',
  rank: 'number',
  is_public: 'boolean',
};

export const SERVICE_LINE_FIELDS = Object.keys(SCHEMA);

export async function listServiceLines() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('service_lines')
    .select('id, name, slug, tagline, rank, is_public, updated_at')
    .order('rank', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function getServiceLineById(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('service_lines')
    .select('*')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data;
}

export async function getServiceLineBySlug(slug: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('service_lines')
    .select('*')
    .eq('slug', slug)
    .single();
  if (error) throw error;
  return data;
}

export async function createServiceLine(input: unknown) {
  const payload = pickAndValidate(input, SCHEMA, { required: ['name', 'slug'] });
  if (payload.is_public === undefined) payload.is_public = false;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('service_lines')
    .insert(payload)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateServiceLine(id: string, patch: unknown) {
  const payload = pickAndValidate(patch, SCHEMA);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('service_lines')
    .update(payload)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteServiceLine(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from('service_lines').delete().eq('id', id);
  if (error) throw error;
}
