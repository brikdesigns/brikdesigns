import { createServiceClient } from './server';
import type { ServiceLine, Service, ServiceWithRelations, RelatedService, SupportPlan, CustomerStory, Offering } from './types';

/**
 * Typed Supabase queries for marketing content.
 * Uses service role client because several tables (services, offerings)
 * have RLS policies referencing is_public which doesn't exist yet.
 * Safe: these are server-only read queries, never exposed to the client.
 *
 * Tables are shared with brik-client-portal (same Supabase project).
 * service_lines has marketing fields (is_public, rank, tagline, etc.).
 * services uses `active` + `sort_order` (no is_public/rank columns).
 *
 * Taxonomy (4-tier hierarchy):
 *   service_lines → services → offerings → engagements
 */

// Map category slugs to BDS ServiceBadge category names.
// Canonical slugs are the long form (brand-design, marketing-design, etc.).
// Short slugs kept for backward URL compatibility only.
const CATEGORY_MAP: Record<string, 'brand' | 'marketing' | 'information' | 'product' | 'service'> = {
  'brand-design': 'brand',
  'marketing-design': 'marketing',
  'information-design': 'information',
  'back-office-design': 'service',
  'product-design': 'product',
  // Legacy short slugs (backward compat for old URLs / portal color_token)
  brand: 'brand',
  marketing: 'marketing',
  information: 'information',
  service: 'service',
  product: 'product',
};

export function mapCategorySlug(slug: string) {
  return CATEGORY_MAP[slug] || 'brand';
}

// ============================================================
// Service Lines (was: Service Categories)
// ============================================================

export async function getServiceCategories() {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('service_lines')
    .select('*')
    .eq('is_public', true)
    .order('rank', { ascending: true });

  if (error) throw error;
  return data;
}

export async function getCategoryBySlug(slug: string) {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('service_lines')
    .select('*')
    .eq('slug', slug)
    .eq('is_public', true)
    .single();

  if (error) throw error;
  return data;
}

// ============================================================
// Services (discipline-level groupings, was: queried as 'services' view)
// ============================================================

export async function getServices() {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('services')
    .select('*, service_lines(id, slug, name)')
    .eq('active', true)
    .order('sort_order', { ascending: true });

  if (error) throw error;
  return data;
}

export async function getServicesByCategory(categoryId: string) {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('services')
    .select('*')
    .eq('service_line_id', categoryId)
    .eq('active', true)
    .order('sort_order', { ascending: true });

  if (error) throw error;
  return data;
}

export async function getServiceBySlug(slug: string) {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('services')
    .select('*, service_lines(id, slug, name, hero_image_url, brand_color_light, brand_color_base, brand_color_dark), offerings(*)')
    .eq('slug', slug)
    .eq('active', true)
    .single();

  if (error) throw error;
  return data;
}

/** Get a service by slug for the "related service" / add-on section */
export async function getRelatedService(slug: string) {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from('services')
    .select('name, slug, description, image_url, service_line_id, service_lines(slug)')
    .eq('slug', slug)
    .eq('active', true)
    .single();

  return data;
}

// ============================================================
// Support Plans (was: queried as 'support_plans' view)
// ============================================================

export async function getSupportPlans() {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('plans')
    .select('*')
    .eq('plan_type', 'support')
    .eq('is_public', true)
    .order('rank', { ascending: true });

  if (error) throw error;
  return data;
}

export async function getSupportPlanBySlug(slug: string) {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('plans')
    .select('*')
    .eq('plan_type', 'support')
    .eq('slug', slug)
    .eq('is_public', true)
    .single();

  if (error) throw error;
  return data;
}

// ============================================================
// Customer Stories
// ============================================================

export async function getCustomerStories() {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('customer_stories')
    .select('*')
    .eq('is_public', true)
    .order('rank', { ascending: true });

  if (error) throw error;
  return data;
}

export async function getCustomerStoryBySlug(slug: string) {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('customer_stories')
    .select('*')
    .eq('slug', slug)
    .eq('is_public', true)
    .single();

  if (error) throw error;
  return data;
}

/** Get customer stories related to a specific service */
export async function getStoriesByService(serviceSlug: string) {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from('customer_stories')
    .select('*')
    .eq('service_slug', serviceSlug)
    .eq('is_public', true)
    .order('rank', { ascending: true })
    .limit(3);

  return data || [];
}

// ============================================================
// Industry Pages
// ============================================================

export async function getIndustryPages() {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('industry_pages')
    .select('*')
    .eq('is_public', true)
    .order('rank', { ascending: true });

  if (error) throw error;
  return data;
}

export async function getIndustryPageBySlug(slug: string) {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('industry_pages')
    .select('*, industry_page_topics(*)')
    .eq('slug', slug)
    .eq('is_public', true)
    .single();

  if (error) throw error;
  return data;
}
