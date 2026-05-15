/**
 * Hardcoded image paths per support-plan slug, used by:
 * - MegaNav plan dropdown thumbnails
 * - /plans/[slug] hero priceCard
 * - /plans/[slug] "Other Support Plans" card images
 *
 * Single source of truth so all three surfaces stay in sync. Long-term, these
 * paths should live on `plans.image_url` in Supabase and this lookup retired —
 * but the Supabase values currently point at different illustrations than the
 * established look, so the consumers all read from here for now.
 *
 * Adding a new support plan: add its slug + image path here, or it will render
 * without a thumbnail on the meganav and without a priceCard image on its
 * detail page.
 */
export const PLAN_IMAGES: Record<string, string> = {
  'marketing-support': '/images/marketing_social_media_2x.webp',
  'back-office-support': '/images/service_automated_workflow_2x.webp',
  'product-support': '/images/product_mobile_app_2x.webp',
};

/** Resolve a plan's image by slug; returns null when no fallback is mapped. */
export function planImage(slug: string): string | null {
  return PLAN_IMAGES[slug] ?? null;
}
