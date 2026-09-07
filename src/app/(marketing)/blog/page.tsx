import type { Metadata } from 'next';
import { getAllPosts } from '@/lib/blog';
import { getServiceCategories, getSupportPlans } from '@/lib/supabase/queries';
import { Grid, Button, SectionHeader } from '@brikdesigns/bds';
import { gap } from '@/lib/tokens';
import { BlogIndex } from '@/components/blog/BlogIndex';
import { HomePlanCard } from '@/components/homepage/HomePlanCard';
import '../shared-sections.css';
import '../homepage.css';
import './blog.css';

export const metadata: Metadata = {
  alternates: { canonical: '/blog' },
  title: 'Blog | Tips, Guides & Insights for Small Businesses',
  description: 'Practical tips on branding, marketing, design systems, and running a small business — from the Brik Designs team.',
};

export const revalidate = 600;

export default async function BlogPage() {
  const [posts, categories, plans] = await Promise.all([
    getAllPosts(),
    getServiceCategories(),
    getSupportPlans(),
  ]);

  // Support-plan cards for the "Monthly Subscription" band, mirrored from the
  // home page (src/app/(marketing)/page.tsx). Plan cards render the marketing-
  // line illustration, joined client-side against the fetched service lines via
  // service_plans.display_line_id; Product Support is excluded here as it is on
  // the home band (still live on the Plans page and its detail route).
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
      };
    });

  return (
    <>
      <section className="page-section page-section--top">
        <div className="container-lg">
          <SectionHeader
            className="page-index-header"
            title="Blog"
            titleAs="h1"
            align="start"
            description="Practical tips on branding, marketing, and running a small business — brik by brik."
            style={{ marginBottom: gap.huge }}
          />
          <BlogIndex posts={posts} />
        </div>
      </section>

      {/* ═══ Support Plans ("Monthly Subscription") — mirrored from the home
       * page's .section-plans band. ═══ */}
      <section className="section-plans" data-section="monthly-subscription">
        <div className="section-container">
          <SectionHeader
            title="Monthly Subscription"
            description="We're more than a design studio—we're your strategic marketing partner."
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
              />
            ))}
          </Grid>
        </div>
      </section>

      {/* ═══ CTA ("Get in Touch") — the shared .cta-section-brand /
       * .cta-card-brand pattern (shared-sections.css), identical to the one on
       * /results, /customers and /blog/[slug]. Was a second, /blog-only brand
       * CTA card (.section-cta / .cta-card, homepage.css) until #1260. ═══ */}
      <section className="cta-section-brand" data-section="get-in-touch">
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
