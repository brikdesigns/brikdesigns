import { createClient } from '@/lib/supabase/server';
import { pickAndValidate, type FieldSchema } from './_validation';

/**
 * Offerings carry both marketing and operational data on a SHARED Supabase
 * table with `brik-client-portal`. Ownership split:
 *
 * - Both admins write `base_price_cents`, `billing_frequency`, `service_type`,
 *   `included_scope` — last-edit-wins. Per 2026-05-11 decision: marketers
 *   need to edit these from brikdesigns admin, portal still syncs from
 *   Stripe. Risk: drift if a manual edit here later gets overwritten by
 *   Stripe sync. Operators should know the field is canonical to Stripe.
 *
 * - Portal admin owns Stripe identifiers (`stripe_product_id`,
 *   `stripe_price_id`, `stripe_last_synced`, `stripe_sync_status`) and
 *   proposal/contract copy. Never expose those here.
 */
const SCHEMA: FieldSchema = {
  name: 'string',
  slug: 'string',
  service_id: 'uuid',
  service_line_id: 'uuid',
  tagline: 'string-or-null',
  description: 'string-or-null',
  marketing_description: 'string-or-null',
  image_url: 'string-or-null',
  hero_image_url: 'string-or-null',
  card_image_url: 'string-or-null',
  base_price_cents: 'number-or-null',
  billing_frequency: 'string-or-null',
  service_type: 'string-or-null',
  included_scope: 'string-or-null',
  is_featured: 'boolean',
  has_customer_story: 'boolean',
  has_multiple_offerings: 'boolean',
  has_maintenance_add_on: 'boolean',
  related_service_slug: 'string-or-null',
  support_plan_slug: 'string-or-null',
  rank: 'number',
  is_public: 'boolean',
};

export const OFFERING_FIELDS = Object.keys(SCHEMA);

export async function listOfferings(filters: { service_id?: string } = {}) {
  const supabase = await createClient();
  let query = supabase
    .from('offerings')
    .select(
      'id, name, slug, service_id, service_line_id, rank, is_public, updated_at, services(name, slug)',
    )
    .order('rank', { ascending: true });
  if (filters.service_id) {
    query = query.eq('service_id', filters.service_id);
  }
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function getOfferingById(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('offerings')
    .select('*, services(id, name, slug, service_lines(slug, name))')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data;
}

export async function createOffering(input: unknown) {
  const payload = pickAndValidate(input, SCHEMA, {
    required: ['name', 'slug', 'service_id'],
  });
  if (payload.is_public === undefined) payload.is_public = false;

  const supabase = await createClient();
  const { data, error } = await supabase.from('offerings').insert(payload).select().single();
  if (error) throw error;
  return data;
}

export async function updateOffering(id: string, patch: unknown) {
  const payload = pickAndValidate(patch, SCHEMA);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('offerings')
    .update(payload)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteOffering(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from('offerings').delete().eq('id', id);
  if (error) throw error;
}
