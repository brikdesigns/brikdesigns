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

// Map `service_lines.slug` → BDS ServiceTag category enum.
//
// Canonical slugs are the short form (brand / marketing / information /
// product / service) — matches what's stored in Supabase and what the
// Next.js dynamic route `/services/[categorySlug]` resolves. Webflow's
// long-form URLs (`/services/brand-design`, etc.) are handled at the
// edge: `/detail_service/*` → `/services/:splat` in netlify.toml. Long
// form never reaches this map. See #113, #121, #132.
const CATEGORY_MAP: Record<string, 'brand' | 'marketing' | 'information' | 'product' | 'service'> = {
  brand: 'brand',
  marketing: 'marketing',
  information: 'information',
  service: 'service',
  product: 'product',
};

export function mapCategorySlug(
  slug: string,
): 'brand' | 'marketing' | 'information' | 'product' | 'service' {
  const mapped = CATEGORY_MAP[slug];
  if (mapped) return mapped;
  // Loud fallback: silent `|| 'brand'` hid 3 NULL service_line_id rows for
  // weeks on the support-plan pages — every detail page rendered with the
  // brand-yellow tint instead of its own service-line color until a
  // screenshot caught it (PR #143 retrospective). Surfacing the input via
  // console.warn means the next regression shows up in Netlify function
  // logs and `npm run dev` output, not in a user report days later.
  console.warn(
    `[mapCategorySlug] Unknown service-line slug "${slug}" — falling back to 'brand'. ` +
      `Check service_lines.slug and the upstream FK (plans.service_line_id, ` +
      `services.service_line_id, etc.) in Supabase.`,
  );
  return 'brand';
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
// Support Plans — reads from service_plans + service_plan_items (#206)
// ============================================================

export async function getSupportPlans() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('service_plans')
    .select('*')
    .eq('is_public', true)
    .order('rank', { ascending: true });

  if (error) throw error;
  return data;
}

export async function getSupportPlanBySlug(slug: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('service_plans')
    .select(
      `*,
       service_plan_items(
         sort_order,
         service:services(
           slug,
           name,
           description,
           image_url,
           service_lines(slug, name)
         )
       )`
    )
    .eq('slug', slug)
    .eq('is_public', true)
    .single();

  if (error) throw error;
  return data;
}

export async function getOtherSupportPlans(excludeSlug: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('service_plans')
    .select('name, slug, monthly_price_display, description, image_url, discount_label')
    .eq('is_public', true)
    .neq('slug', excludeSlug)
    .order('rank', { ascending: true });

  if (error) throw error;
  return data;
}

// Reverse lookup: given a service UUID, return all public plans that include it.
// Replaces the legacy service.support_plan_slug denorm column (#206).
export async function getSupportPlansByServiceId(serviceId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('service_plans')
    .select('*, service_plan_items!inner(service_id, sort_order)')
    .eq('service_plan_items.service_id', serviceId)
    .eq('is_public', true)
    .order('rank', { ascending: true });

  if (error) throw error;
  return data ?? [];
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

/**
 * "Other customer stories" — populates the 3-col cross-promo grid on the
 * customer-story detail page. Prefers same `service_line_slug` for topical
 * fit; falls back to any next-ranked stories when the line pool would be
 * empty (e.g. only one story exists in that line) so the section never
 * disappears for isolated lines.
 *
 * Replaces the prior in-page `getCustomerStories().slice(0, 3)` pattern from
 * #171 — that variant pulled the full public list and silently lost the
 * line-fit selection criteria.
 */
export async function getOtherCustomerStories(opts: {
  excludeSlug: string;
  serviceLineSlug: string | null;
  limit?: number;
}) {
  const supabase = await createClient();
  const limit = opts.limit ?? 3;

  if (opts.serviceLineSlug) {
    const { data } = await supabase
      .from('customer_stories')
      .select('*')
      .eq('service_line_slug', opts.serviceLineSlug)
      .eq('is_public', true)
      .neq('slug', opts.excludeSlug)
      .order('rank', { ascending: true })
      .limit(limit);
    if (data && data.length > 0) return data;
  }

  const { data } = await supabase
    .from('customer_stories')
    .select('*')
    .eq('is_public', true)
    .neq('slug', opts.excludeSlug)
    .order('rank', { ascending: true })
    .limit(limit);
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
    .select(`
      *,
      industry_page_topics(
        id, topic_number, title, description, service_line_slug, image_url, sort_order,
        industry_page_topic_services(
          sort_order,
          services(
            id, slug, name, tagline, description, image_url,
            service_lines(slug, name)
          )
        )
      )
    `)
    .eq('slug', slug)
    .eq('is_public', true)
    .single();

  if (error) throw error;
  return data;
}

export async function getCustomerStoriesByIndustry(industrySlug: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from('customer_stories')
    .select('*, service_lines!customer_stories_primary_category_id_fkey(name, slug), offerings!customer_stories_primary_service_id_fkey(name)')
    .eq('industry_slug', industrySlug)
    .eq('is_public', true)
    .order('rank', { ascending: true });
  return data || [];
}
