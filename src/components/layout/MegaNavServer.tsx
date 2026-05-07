import { getServiceCategories, getServices, getSupportPlans, getIndustryPages, mapCategorySlug } from '@/lib/supabase/queries';
import { MegaNav } from './MegaNav';

/**
 * Nav content — taglines + service slug-lists per column.
 *
 * Keyed by `service_lines.slug` (short form: brand / marketing / information /
 * service). Slug values match the canonical Brik service catalog as of the
 * 2026-04 reorg, NOT Webflow's old slugs. If a service is renamed in the
 * admin CMS, update the corresponding entry here.
 *
 * Each slug must exist in the `services` table (else that entry is silently
 * dropped from the column). DB-side filtering is `is_public=true`, so a
 * service with `is_public=false` won't appear in the nav even if listed here.
 *
 * TODO: Add a `show_in_nav` boolean column on `services` so this list can
 * be managed in the admin CMS instead of hardcoded here.
 */
const NAV_COLUMNS: Record<string, { tagline: string; slugs: string[] }> = {
  brand: {
    tagline: 'Shape your identity',
    slugs: [
      'logo-design',
      'brand-identity',
      'brand-guidelines',
      'business-stationery',
      'online-business-listings',
    ],
  },
  marketing: {
    tagline: 'Connect and convert',
    slugs: [
      'website-experience-mapping',
      'patient-experience-mapping',
      'web-design-development',
      'email-marketing',
      'landing-pages',
      'social-media-graphics',
      'swag-merchandise-design',
      'marketing-consulting',
    ],
  },
  information: {
    tagline: 'Simplify the complex',
    slugs: [
      'layout-design',
      'sales-resources',
      'welcome-onboarding-kit',
      'infographics',
      'presentation-design',
      'signage-design',
      'intake-forms',
    ],
  },
  // 'service' is the DB slug for the Back Office Design line.
  service: {
    tagline: 'Make work flow',
    slugs: [
      'software-automation-setup',
      'digital-file-organization',
      'sop-creation',
      'training-setup',
      'crm-setup',
      'ai-workflow-integration',
      'customer-journey-mapping',
      'software-subscription-audit',
    ],
  },
};

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
        category: mapCategorySlug(cat.slug),
        tagline: '',
        services: [],
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
      category: mapCategorySlug(cat.slug),
      tagline: col.tagline,
      services: catServices,
    };
  });

  const supportPlans = plans.map((plan) => ({
    name: plan.name,
    slug: plan.slug,
    price: plan.monthly_price_display || 'Contact',
    description: plan.home_description || plan.description || '',
  }));

  const industryItems = (industries || []).map((ind) => ({
    name: ind.name,
    slug: ind.slug,
    tagline: ind.tagline || '',
    imageUrl: ind.card_image_url || ind.hero_image_url || null,
  }));

  return <MegaNav serviceLines={serviceLines} supportPlans={supportPlans} industries={industryItems} />;
}
