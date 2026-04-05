/**
 * Shared Supabase row types for the marketing site.
 *
 * Tables are owned by brik-client-portal (same Supabase project).
 * Taxonomy: service_lines → services → offerings → engagements
 */

// ─── Service Lines (categories) ──────────────────────────────

export interface ServiceLine {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  description: string | null;
  is_public: boolean;
  rank: number;
  hero_image_url: string | null;
  card_image_url: string | null;
  brand_color_light: string | null;
  brand_color_base: string | null;
  brand_color_dark: string | null;
  support_plan_slug: string | null;
}

// ─── Services ────────────────────────────────────────────────

export interface Service {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  tagline: string | null;
  image_url: string | null;
  primary_badge_url: string | null;
  secondary_badge_url: string | null;
  active: boolean;
  sort_order: number;
  service_line_id: string;
  has_customer_story: boolean;
  related_service_slug: string | null;
  support_plan_slug: string | null;
}

export interface ServiceWithRelations extends Service {
  service_lines: ServiceLine | null;
  offerings: Offering[];
}

export interface RelatedService {
  name: string;
  slug: string;
  description: string | null;
  image_url: string | null;
  service_line_id: string;
  service_lines: { slug: string } | null;
}

// ─── Offerings ───────────────────────────────────────────────

export interface Offering {
  slug: string;
  name: string;
  price_display: string | null;
  description: string | null;
  what_you_get: string | null;
  price_model: string | null;
  icon_url: string | null;
  active: boolean;
  sort_order: number;
  base_price_cents: number;
}

// ─── Plans ───────────────────────────────────────────────────

export interface SupportPlan {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  plan_type: string;
  is_public: boolean;
  rank: number;
  monthly_price_display: string | null;
  image_url: string | null;
}

// ─── Customer Stories ────────────────────────────────────────

export interface CustomerStory {
  id: string;
  slug: string;
  name: string;
  client_name: string | null;
  short_description: string | null;
  hero_image_url: string | null;
  service_slug: string | null;
  is_public: boolean;
  rank: number;
}
