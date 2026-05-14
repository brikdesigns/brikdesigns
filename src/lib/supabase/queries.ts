import { createClient } from './server';

/**
 * Typed Supabase queries for marketing content.
 * All queries use the anon key (public read via RLS).
 *
 * Tables are shared with brik-client-portal (same Supabase project).
 * Marketing fields (image_url, tagline, rank, is_public) were added in
 * migration 00044_marketing_cms_schema.sql. Badge URL columns from that
 * migration are scheduled for removal in the brik-client-portal
 * `drop-marketing-badge-columns` migration — service tags are now rendered
 * via BDS `<ServiceTag>` driven by category + service name.
 *
 * Taxonomy (4-tier hierarchy):
 *   service_lines → services → offerings → engagements
 */

// Map category slugs to BDS ServiceTag category names.
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

/**
 * Resolve the BDS <ServiceTag> category for a service_lines row.
 *
 * Prefers the CMS-editable `service_tag_category` column (portal migration
 * 00182, brikdesigns#129). Falls back to slug-derivation via mapCategorySlug
 * when the column is NULL — preserves rendering for legacy rows during
 * rollout. Cast is safe because the DB check constraint enforces the 5
 * canonical BDS values.
 */
export function resolveServiceTagCategory(row: {
  slug: string;
  service_tag_category?: string | null;
}): 'brand' | 'marketing' | 'information' | 'product' | 'service' {
  return (row.service_tag_category ?? mapCategorySlug(row.slug)) as
    'brand' | 'marketing' | 'information' | 'product' | 'service';
}

// ============================================================
// Service Lines (was: Service Categories)
// ============================================================

export async function getServiceCategories() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('service_lines')
    .select('*')
    .eq('is_public', true)
    .order('rank', { ascending: true });

  if (error) throw error;
  return data;
}

export async function getCategoryBySlug(slug: string) {
  const supabase = await createClient();
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
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('services')
    .select('*, service_lines(id, slug, name)')
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
    .eq('service_line_id', categoryId)
    .eq('is_public', true)
    .order('rank', { ascending: true });

  if (error) throw error;
  return data;
}

export async function getServiceBySlug(slug: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('services')
    .select('*, service_lines(id, slug, name, brand_color_light, brand_color_base, brand_color_dark), offerings(*)')
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
    .select('name, slug, tagline, description, image_url, service_lines(slug)')
    .eq('slug', slug)
    .eq('is_public', true)
    .single();

  return data;
}

// ============================================================
// Support Plans (was: queried as 'support_plans' view)
// ============================================================

export async function getSupportPlans() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('plans')
    .select('*, service_lines(slug)')
    .eq('plan_type', 'support')
    .eq('is_public', true)
    .order('rank', { ascending: true });

  if (error) throw error;
  return data;
}

export async function getSupportPlanBySlug(slug: string) {
  const supabase = await createClient();
  // plan_items.service_id is an FK to offerings (not services) — services
  // have many offerings (1:N), so we traverse plan_items → offerings →
  // services → service_lines. The page dedupes by service.slug to show
  // one card per service even when multiple offerings of the same service
  // are included in the plan.
  const { data, error } = await supabase
    .from('plans')
    .select(
      `*,
       service_lines(slug, name),
       plan_items(
         sort_order,
         offering:offerings(
           service:services(
             slug,
             name,
             description,
             image_url,
             service_lines(slug, name)
           )
         )
       )`
    )
    .eq('plan_type', 'support')
    .eq('slug', slug)
    .eq('is_public', true)
    .single();

  if (error) throw error;
  return data;
}

export async function getOtherSupportPlans(excludeSlug: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('plans')
    .select('name, slug, monthly_price_display, description, image_url, discount_label, service_lines(slug)')
    .eq('plan_type', 'support')
    .eq('is_public', true)
    .neq('slug', excludeSlug)
    .order('rank', { ascending: true });

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
    .select('*, service_lines!customer_stories_primary_category_id_fkey(name, slug), offerings!customer_stories_primary_service_id_fkey(name)')
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
