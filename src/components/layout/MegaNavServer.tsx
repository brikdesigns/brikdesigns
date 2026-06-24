import { getServiceCategories, getServices, getSupportPlans, getIndustryPages, mapServiceLineSlug, resolveServiceTagCategory } from '@/lib/supabase/queries';
import type { ServiceOption } from '@/components/marketing/ServiceMultiSelect';
import { NAV_COLUMNS } from '@/lib/meganav-columns';
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
    // Service-line illustration is the single CMS source (#467): prefer the
    // plan's marketing_line card_image_url, falling back to the plan's own
    // image_url for legacy rows with no marketing line set.
    imageUrl: plan.marketing_line?.card_image_url ?? plan.image_url ?? null,
  }));

  const industryItems = (industries || []).map((ind) => ({
    name: ind.name,
    slug: ind.slug,
    tagline: ind.tagline || '',
    imageUrl: ind.image_url || null,
  }));

  // Service-picker options for the nav "Let's Talk" modal — services (not
  // offerings), clustered by service line so chips are line-colored. Mirrors
  // the get-started / contact mapping.
  const lineRank = new Map<string, number>(
    categories.map((cat) => [cat.id, cat.rank ?? 0]),
  );
  const serviceOptions: ServiceOption[] = [...services]
    .sort(
      (a, b) =>
        (lineRank.get(a.service_line_id) ?? 99) -
          (lineRank.get(b.service_line_id) ?? 99) ||
        (a.rank ?? 0) - (b.rank ?? 0),
    )
    .map((service) => ({
      value: service.slug,
      label: service.name,
      category: resolveServiceTagCategory({
        slug: service.service_lines?.slug ?? service.slug,
      }),
    }));

  return <MegaNav serviceLines={serviceLines} supportPlans={supportPlans} industries={industryItems} serviceOptions={serviceOptions} />;
}
