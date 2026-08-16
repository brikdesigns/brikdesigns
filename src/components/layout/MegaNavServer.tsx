import { getServiceCategories, getServices, getSupportPlans, getIndustryPages, mapServiceLineSlug } from '@/lib/supabase/queries';
import { NAV_COLUMNS } from '@/lib/meganav-columns';
import { PLAN_IMAGE_OVERRIDES } from '@/lib/plan-image-overrides';
import { MegaNav } from './MegaNav';

/**
 * Server component that fetches nav data from Supabase
 * and passes it to the MegaNav client component.
 */
export async function MegaNavServer() {
  const [categories, services, plans, industries] = await Promise.all([
    getServiceCategories(),
    getServices(),
    getSupportPlans(),
    getIndustryPages(),
  ]);

  const serviceLines = categories.map((cat) => {
    const col = NAV_COLUMNS[cat.slug];
    if (!col) {
      // Category not shown in nav (e.g., product — handled as promo card)
      return {
        name: cat.name,
        slug: cat.slug,
        category: mapServiceLineSlug(cat.slug),
        tagline: '',
        services: [],
        imageUrl: cat.card_image_url ?? null,
      };
    }

    // Pull services by slug from ALL categories — handles cross-category
    // items like patient-experience-mapping (DB: service, nav: marketing)
    const catServices = col.slugs
      .map((slug) => services.find((s: { slug: string }) => s.slug === slug))
      .filter(Boolean)
      .map((s: { name: string; slug: string }) => ({ name: s.name, slug: s.slug }));

    return {
      name: cat.name,
      slug: cat.slug,
      category: mapServiceLineSlug(cat.slug),
      tagline: col.tagline,
      services: catServices,
      imageUrl: cat.card_image_url ?? null,
    };
  });

  const supportPlans = plans.map((plan) => ({
    name: plan.name,
    slug: plan.slug,
    price: plan.monthly_price_display || 'Contact',
    description: plan.home_description || plan.description || '',
    // Service-line illustration is the single CMS source (#467): prefer a
    // per-plan override, then the plan's marketing_line card_image_url, falling
    // back to the plan's own image_url for legacy rows with no marketing line.
    imageUrl: PLAN_IMAGE_OVERRIDES[plan.slug] ?? plan.marketing_line?.card_image_url ?? plan.image_url ?? null,
    // Nav tint on /plans/{slug} (#859). Read straight off marketing_line — the
    // same column the plan hero tints from — so the bar and the band can't
    // disagree. Deliberately NOT routed through mapServiceLineSlug() when the
    // column is null: that helper warns and falls back to 'brand', which would
    // paint every line-less plan yellow. No line set means no tint.
    lineSegment: plan.marketing_line?.slug ? mapServiceLineSlug(plan.marketing_line.slug) : null,
  }));

  const industryItems = (industries || []).map((ind) => ({
    name: ind.name,
    slug: ind.slug,
    tagline: ind.tagline || '',
    imageUrl: ind.image_url || null,
  }));

  return <MegaNav serviceLines={serviceLines} supportPlans={supportPlans} industries={industryItems} />;
}
