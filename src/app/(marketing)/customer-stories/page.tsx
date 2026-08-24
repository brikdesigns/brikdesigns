import type { Metadata } from 'next';
import { Grid, Button, SectionHeader } from '@brikdesigns/bds';
import type { ServiceLine } from '@brikdesigns/bds';
import { getCustomerStories, getServiceCategories, getSupportPlans, mapServiceLineSlug } from '@/lib/supabase/queries';
import { CustomerStoriesList } from './CustomerStoriesList';
import { HomePlanCard } from '@/components/homepage/HomePlanCard';
import { text } from '@/lib/styles';
import { color, gap } from '@/lib/tokens';
import { ScrollDownCta } from '@/components/ui/ScrollDownCta';
import '../shared-sections.css';
import './customer-stories.css';

export const metadata: Metadata = {
  title: 'Customer Stories | Brik Design Portfolio & Client Projects',
  description: 'Explore Brik\'s portfolio of brand, marketing, service, and product design. See how we build impactful design for our customers, brik by brik.',
};

export const revalidate = 3600;

export default async function CustomerStoriesPage() {
  const [stories, categories, plans] = await Promise.all([
    getCustomerStories(),
    getServiceCategories(),
    getSupportPlans(),
  ]);

  // Subscription-plan cards for the "Our Services" band, mirroring the home
  // page's Monthly Subscription mapping. Plan cards render the marketing-line
  // illustration, joined client-side against the fetched service lines via
  // service_plans.display_line_id. Product Support is a niche plan — excluded
  // here (still live on the Plans page and its detail route).
  const serviceLineById = new Map(categories.map((cat) => [cat.id, cat]));
  const supportPlans = plans
    .filter((plan) => plan.slug !== 'product-support')
    .map((plan) => {
      const displayLineId = (plan as { display_line_id?: string | null }).display_line_id;
      const line = displayLineId ? serviceLineById.get(displayLineId) : null;
      return {
        name: plan.name,
        slug: plan.slug,
        price: plan.monthly_price_display || 'Contact',
        description: plan.home_description || plan.description || '',
        image_url: line?.card_image_url ?? plan.image_url ?? null,
        // Same display-line join drives the CTA tint — the card links to
        // /plans/{slug}, whose own CTAs are tinted from this line (#1001).
        service_line_slug: line?.slug ?? null,
      };
    });

  return (
    <>
      <section className="page-hero">
        <div className="page-hero__container">
          <h1 className="page-hero__title">Customer Stories</h1>
          <p className="page-hero__description">
            Real results from real businesses. See how we help our clients build stronger brands and grow faster — brik by brik.
          </p>
        </div>
        <ScrollDownCta />
      </section>

      <section className="page-section page-section--top">
        <div className="container-lg">
          <SectionHeader
            title="Latest Stories"
            style={{ marginBottom: gap.xl }}
          />
          {stories && stories.length > 0 ? (
            <CustomerStoriesList
              stories={stories.map((story) => {
                const serviceLineCategory = story.service_line_slug
                  ? (mapServiceLineSlug(story.service_line_slug) as ServiceLine)
                  : null;
                const serviceLineName = (story as { service_lines?: { name: string } | null }).service_lines?.name ?? null;
                const serviceName = (story as { services?: { name: string } | null }).services?.name ?? null;
                const iconServiceName = serviceLineCategory && serviceName ? serviceName : undefined;

                return {
                  slug: story.slug,
                  name: story.name,
                  clientName: story.client_name,
                  industry: story.industry ?? null,
                  launchDate: story.launch_date ?? null,
                  serviceLineName,
                  serviceLineCategory,
                  serviceName,
                  shortDescription: story.short_description ?? null,
                  imageUrl: story.thumbnail_url ?? story.hero_image_url ?? null,
                  iconServiceName,
                };
              })}
            />
          ) : (
            <p style={{ ...text.body, color: color.text.secondary, textAlign: 'center' }}>Customer stories coming soon.</p>
          )}
        </div>
      </section>

      {supportPlans.length > 0 && (
        <section className="page-section page-section--accent">
          <div className="container-lg container-lg--comfortable">
            <SectionHeader
              title="Our Services"
              description="Ongoing design support at every stage of your business growth — from marketing to back office."
            />
            <Grid columns={3} gap="lg">
              {supportPlans.map((plan) => (
                <HomePlanCard
                  key={plan.slug}
                  name={plan.name}
                  slug={plan.slug}
                  price={plan.price}
                  description={plan.description}
                  imageUrl={plan.image_url}
                  serviceLineSlug={plan.service_line_slug}
                />
              ))}
            </Grid>
          </div>
        </section>
      )}

      <section className="cta-section-brand">
        <div className="cta-card-brand">
          <SectionHeader
            onColor
            title="Get in Touch"
            description="Starting a new project or want to collaborate with us?"
            actions={
              <Button href="/contact" variant="on-color" size="lg">
                Let&apos;s Talk
              </Button>
            }
          />
        </div>
      </section>
    </>
  );
}
