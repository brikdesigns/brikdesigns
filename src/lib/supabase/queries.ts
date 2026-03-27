import { createClient } from './server';

/**
 * Typed Supabase queries for marketing content.
 * All queries use the anon key (public read via RLS).
 *
 * Tables are shared with brik-client-portal (same Supabase project).
 * Marketing fields (image_url, badges, tagline, rank, is_public) were added
 * in migration 00044_marketing_cms_schema.sql.
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
// Service Categories (service lines)
// ============================================================

export async function getServiceCategories() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('service_categories')
    .select('*')
    .eq('is_public', true)
    .order('rank', { ascending: true });

  if (error) throw error;
  return data;
}

export async function getCategoryBySlug(slug: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('service_categories')
    .select('*')
    .eq('slug', slug)
    .eq('is_public', true)
    .single();

  if (error) throw error;
  return data;
}

// ============================================================
// Services
// ============================================================

export async function getServices() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('services')
    .select('*, service_categories(id, slug, name)')
    .eq('is_public', true)
    .order('rank', { ascending: true });

  if (error) throw error;
  return data;
}

export async function getServicesByCategory(categoryId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('services')
    .select('*')
    .eq('category_id', categoryId)
    .eq('is_public', true)
    .order('rank', { ascending: true });

  if (error) throw error;
  return data;
}

export async function getServiceBySlug(slug: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('services')
    .select('*, service_categories(id, slug, name, brand_color_light, brand_color_base, brand_color_dark), offerings(*)')
    .eq('slug', slug)
    .eq('is_public', true)
    .single();

  if (error) throw error;
  return data;
}

/** Get a service by slug for the "related service" / add-on section */
export async function getRelatedService(slug: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from('services')
    .select('name, slug, tagline, marketing_description, image_url, primary_badge_url, service_categories(slug)')
    .eq('slug', slug)
    .eq('is_public', true)
    .single();

  return data;
}

// ============================================================
// Support Plans
// ============================================================

export async function getSupportPlans() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('support_plans')
    .select('*')
    .eq('is_public', true)
    .order('rank', { ascending: true });

  if (error) throw error;
  return data;
}

export async function getSupportPlanBySlug(slug: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('support_plans')
    .select('*')
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
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('customer_stories')
    .select('*')
    .eq('is_public', true)
    .order('rank', { ascending: true });

  if (error) throw error;
  return data;
}

export async function getCustomerStoryBySlug(slug: string) {
  const supabase = await createClient();
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
  const supabase = await createClient();
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
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('industry_pages')
    .select('*')
    .eq('is_public', true)
    .order('rank', { ascending: true });

  if (error) throw error;
  return data;
}

export async function getIndustryPageBySlug(slug: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('industry_pages')
    .select('*, industry_page_topics(*)')
    .eq('slug', slug)
    .eq('is_public', true)
    .single();

  if (error) throw error;
  return data;
}
