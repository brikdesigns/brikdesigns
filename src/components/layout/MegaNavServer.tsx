import { getServiceCategories, getServices, getSupportPlans, mapCategorySlug } from '@/lib/supabase/queries';
import { MegaNav } from './MegaNav';

/**
 * Server component that fetches nav data from Supabase
 * and passes it to the MegaNav client component.
 */
export async function MegaNavServer() {
  const [categories, services, plans] = await Promise.all([
    getServiceCategories(),
    getServices(),
    getSupportPlans(),
  ]);

  const serviceLines = categories.map((cat) => ({
    name: cat.name,
    slug: cat.slug,
    category: mapCategorySlug(cat.slug),
    tagline: cat.tagline || '',
    services: services
      .filter((s: { category_id: string }) => s.category_id === cat.id)
      .slice(0, 8)
      .map((s: { name: string; slug: string }) => ({ name: s.name, slug: s.slug })),
  }));

  const supportPlans = plans.map((plan) => ({
    name: plan.name,
    slug: plan.slug,
    price: plan.monthly_price_display || 'Contact',
    description: plan.home_description || plan.description || '',
  }));

  return <MegaNav serviceLines={serviceLines} supportPlans={supportPlans} />;
}
