import { createClient } from '@/lib/supabase/server';
import { pickAndValidate, type FieldSchema } from './_validation';

const SCHEMA: FieldSchema = {
  name: 'string',
  slug: 'string',
  service_line_id: 'uuid',
  tagline: 'string-or-null',
  description: 'string-or-null',
  image_url: 'string-or-null',
  primary_badge_url: 'string-or-null',
  secondary_badge_url: 'string-or-null',
  has_customer_story: 'boolean',
  related_service_slug: 'string-or-null',
  support_plan_slug: 'string-or-null',
  rank: 'number',
  is_public: 'boolean',
};

export const SERVICE_FIELDS = Object.keys(SCHEMA);

export async function listServices(filters: { service_line_id?: string } = {}) {
  const supabase = await createClient();
  let query = supabase
    .from('services')
    .select('id, name, slug, service_line_id, rank, is_public, updated_at, service_lines(name, slug)')
    .order('rank', { ascending: true });
  if (filters.service_line_id) {
    query = query.eq('service_line_id', filters.service_line_id);
  }
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function getServiceById(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('services')
    .select('*, service_lines(id, name, slug)')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data;
}

export async function createService(input: unknown) {
  const payload = pickAndValidate(input, SCHEMA, {
    required: ['name', 'slug', 'service_line_id'],
  });
  if (payload.is_public === undefined) payload.is_public = false;

  const supabase = await createClient();
  const { data, error } = await supabase.from('services').insert(payload).select().single();
  if (error) throw error;
  return data;
}

export async function updateService(id: string, patch: unknown) {
  const payload = pickAndValidate(patch, SCHEMA);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('services')
    .update(payload)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteService(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from('services').delete().eq('id', id);
  if (error) throw error;
}
