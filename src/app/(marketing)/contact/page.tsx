import type { Metadata } from 'next';
import { Button, Grid } from '@brikdesigns/bds';
import { BookACallButton } from '@/components/marketing/BookACallButton';
import { ContactForm } from '@/components/marketing/ContactForm';
import { HomePlanCard } from '@/components/homepage/HomePlanCard';
import type { ServiceOption } from '@/components/marketing/ServiceMultiSelect';
import { getServiceCategories, getServices, getSupportPlans, resolveServiceTagCategory } from '@/lib/supabase/queries';
import { text, heading } from '@/lib/styles';
import { color } from '@/lib/tokens';
import '../shared-sections.css';
import './contact.css';

export const metadata: Metadata = {
  title: 'Contact Brik Designs | Start Your Project or Ask a Question',
  description: 'Let\'s build something together. Reach out to Brik Designs for a quote, consultation, or to learn how we can support your business — brik by brik.',
};

export default async function ContactPage() {
  // Build the service-picker options, clustered by service line so the flat
  // MultiSelect groups lines together and each chip is line-colored (mirrors
  // the get-started page / nav modal).
  const [serviceLines, services, plans] = await Promise.all([
    getServiceCategories(),
    getServices(),
    getSupportPlans(),
  ]);

  // Support-plan cards for the "Monthly Subscription" band, repurposed from the
  // home page. Plan cards render the marketing-line illustration, joined
  // client-side against the already-fetched service lines via
  // service_plans.marketing_line_id (mirrors src/app/(marketing)/page.tsx).
  const serviceLineById = new Map(serviceLines.map((line) => [line.id, line]));
  const supportPlans = plans.map((plan) => {
    const marketingLineId = (plan as { marketing_line_id?: string | null }).marketing_line_id;
    const line = marketingLineId ? serviceLineById.get(marketingLineId) : null;
    return {
      name: plan.name,
      slug: plan.slug,
      price: plan.monthly_price_display || 'Contact',
      description: plan.home_description || plan.description || '',
      image_url: line?.card_image_url ?? plan.image_url ?? null,
    };
  });
  const lineRank = new Map<string, number>(
    serviceLines.map((line) => [line.id, line.rank ?? 0]),
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

  return (
    <>
      <section className="contact-section">
        <div className="contact-card">
          <div className="contact-hero-row">
            <h1 className="page-hero__title">Get in Touch</h1>
            <div className="contact-cta-row">
              <BookACallButton />
              <Button href="mailto:hello@brikdesigns.com" variant="secondary" size="md">
                Send Email
              </Button>
              <Button href="tel:+15614908714" variant="secondary" size="md">
                Click to Call
              </Button>
            </div>
          </div>

          <div className="contact-form-block">
            <h2 style={heading.md}>Send Us a Message</h2>
            <p style={{ ...text.bodySm, color: color.text.secondary, margin: 0 }}>Let us know what you&apos;re interested in</p>
            <ContactForm serviceOptions={serviceOptions} />
          </div>
        </div>
      </section>

      {/* ═══ Support Plans ("Monthly Subscription") — repurposed from the home
       * page's .section-plans band. Sits below the contact form on a secondary
       * surface. ═══ */}
      <section className="contact-plans">
        <div className="contact-plans__container">
          <div className="contact-plans__header">
            <h2 style={{ ...heading.lg, margin: 0 }}>Monthly Subscription</h2>
            <p style={{ ...text.body, color: color.text.secondary, margin: 0 }}>
              We&apos;re more than a design studio&mdash;we&apos;re your strategic marketing partner.
            </p>
          </div>
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
    </>
  );
}
