import { getServiceCategories, getServices, getSupportPlans, getIndustryPages, mapCategorySlug } from '@/lib/supabase/queries';
import { MegaNav } from './MegaNav';

/**
 * Nav content — hardcoded marketing copy matching the Webflow site.
 * Service slugs resolve to display names via Supabase, but taglines are
 * brand-voice decisions that live here, not in the DB.
 *
 * Some slugs live under a different DB category than the nav column they
 * appear in (e.g., patient-experience-mapping is DB "service" but Webflow
 * shows it under Marketing). The server component resolves cross-category
 * items by looking up slugs across ALL categories.
 *
 * TODO: Add a `show_in_nav` boolean column to Supabase so the slug lists
 * can be managed in the portal instead of hardcoded.
 */
const NAV_COLUMNS: Record<string, { tagline: string; slugs: string[] }> = {
  'brand-design': {
    tagline: 'Shape your identity',
    slugs: [
      'logo-design', 'brand-guidelines', 'stationary',
      'business-card', 'email-signature', 'business-listings',
    ],
  },
  'marketing-design': {
    tagline: 'Connect and convert',
    slugs: [
      'website-experience-mapping', 'patient-experience-mapping',
      'web-design', 'email-marketing',
      'landing-page', 'social', 'swag', 'marketing-consulting',
      'software-automation-setup',
    ],
  },
  'information-design': {
    tagline: 'Simplify the complex',
    slugs: [
      'layout-design', 'sales-resources', 'welcome-onboarding-kit',
      'infographic', 'presentation-design', 'signage-design', 'intake-forms',
    ],
  },
  'back-office-design': {
    tagline: 'Make work flow',
    slugs: [
      'automated-workflow-and-ai-integration', 'digital-file-organization',
      'sop-creation', 'training-setup-organization',
      'crm-setup-and-data-cleanup', 'journey-map', 'software-subscription-audit',
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
