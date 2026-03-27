import type { Metadata } from 'next';
import { getServiceCategories, mapCategorySlug } from '@/lib/supabase/queries';
import { ServiceLineCard, ServiceCallout } from './ServiceLineCard';
import '../shared-sections.css';
import './services.css';

export const metadata: Metadata = {
  title: 'Design Services | Branding, Marketing, Web & Back-Office',
  description: 'Brik Designs offers branding, marketing, information, product, and back-office design services for small businesses — one-time or subscription-based.',
};

export const revalidate = 3600;

/** Service lines shown as main cards (3-col grid) */
const MAIN_LINES = ['brand', 'marketing', 'service'];

/** Service lines shown as callout sections (image + text) */
const CALLOUT_LINES = ['product', 'information'];

/** Custom headings/subheadings for callout sections (from live Webflow site) */
const CALLOUT_COPY: Record<string, { heading: string; subheading: string }> = {
  product: {
    heading: 'Have a product to refresh or idea in mind?',
    subheading: 'We can help with product design. Please reach out for project ideas.',
  },
  information: {
    heading: 'Need in-house design services?',
    subheading: 'We can help handle additional marketing needs including presentations and sales resources.',
  },
};

export default async function ServicesPage() {
  const categories = await getServiceCategories();

  const mainLines = categories.filter((c) => MAIN_LINES.includes(c.slug));
  const calloutLines = categories.filter((c) => CALLOUT_LINES.includes(c.slug));

  return (
    <>
      {/* ═══ Hero ═══ */}
      <section className="page-hero page-hero--brand">
        <div className="page-hero__container">
          <h1 className="page-hero__title">Design Services</h1>
          <p className="page-hero__description">
            We&apos;re more than a design studio—we&apos;re your strategic marketing partner.
            From branding to websites to behind-the-scenes systems, we help you build a
            business that looks good <em>and</em> works better.
          </p>
          <a href="/contact" className="bds-button bds-button--inverse bds-button--lg">
            Let&apos;s Talk
          </a>
        </div>
      </section>

      {/* ═══ Main service lines (3-col grid) ═══ */}
      <section className="content-section">
        <div className="container-lg container-lg--comfortable">
          <div className="content-wrapper content-wrapper--center content-wrapper--narrow">
            <h2 className="text-heading-lg text--center">Our Services</h2>
            <p className="text-body-md text--secondary text--center">
              We offer design services at every stage of your business growth — from establishment to maturity.
            </p>
          </div>
          <div className="grid-3">
            {mainLines.map((cat) => (
              <ServiceLineCard
                key={cat.slug}
                name={cat.name}
                slug={cat.slug}
                category={mapCategorySlug(cat.slug)}
                tagline={cat.tagline || cat.description || ''}
                imageUrl={cat.card_image_url}
              />
            ))}
          </div>
        </div>
      </section>

      {/* ═══ Callout sections (Product, Information) ═══ */}
      {calloutLines.map((cat, i) => {
        const copy = CALLOUT_COPY[cat.slug];
        return (
          <section key={cat.slug} className={i % 2 === 0 ? 'content-section content-section--accent' : 'content-section'}>
            <div className="container-lg">
              {copy && (
                <div className="content-wrapper content-wrapper--center" style={{ marginBottom: 'var(--gap-xl)' }}>
                  <h2 className="text-heading-lg text--center">{copy.heading}</h2>
                  <p className="text-body-md text--secondary text--center">{copy.subheading}</p>
                </div>
              )}
              <ServiceCallout
                name={cat.name}
                slug={cat.slug}
                category={mapCategorySlug(cat.slug)}
                description={cat.description || cat.tagline || ''}
                imageUrl={cat.card_image_url}
              />
            </div>
          </section>
        );
      })}
    </>
  );
}
