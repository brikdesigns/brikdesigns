import type { Metadata } from 'next';
import { ServiceLineGrid } from '@/components/marketing/ServiceLineGrid';

export const metadata: Metadata = {
  title: 'Services',
  description: 'Branding, marketing, web design, and back-office services for small businesses.',
};

// TODO: Replace with getServiceCategories() + getServices() from Supabase
const serviceLines = [
  {
    name: 'Brand Design',
    slug: 'brand-design',
    category: 'brand' as const,
    tagline: 'Build a lasting, consistent brand that builds trust',
    description: 'A strong brand starts with a clear identity — logo, colors, fonts, and the story that ties them together.',
    services: [
      { name: 'Logo Design', slug: 'logo-design' },
      { name: 'Brand Guidelines', slug: 'brand-guidelines' },
      { name: 'Business Card', slug: 'business-card' },
      { name: 'Email Signature', slug: 'email-signature' },
      { name: 'Business Listings', slug: 'business-listings' },
      { name: 'Stationery', slug: 'stationary' },
    ],
  },
  {
    name: 'Marketing Design',
    slug: 'marketing-design',
    category: 'marketing' as const,
    tagline: 'Show up where it matters — and make it count',
    description: 'From websites to social media to email campaigns, we make sure your marketing looks sharp and performs.',
    services: [
      { name: 'Web Design', slug: 'web-design' },
      { name: 'Email Marketing', slug: 'email-marketing' },
      { name: 'Landing Page', slug: 'landing-page' },
      { name: 'Social Media', slug: 'social' },
      { name: 'Swag', slug: 'swag' },
      { name: 'Marketing Consulting', slug: 'marketing-consulting' },
    ],
  },
  {
    name: 'Information Design',
    slug: 'information-design',
    category: 'information' as const,
    tagline: 'Make the complicated simple',
    description: 'Presentations, training materials, onboarding kits — we turn dense information into clear, beautiful content.',
    services: [
      { name: 'Presentation Design', slug: 'presentation-design' },
      { name: 'Layout Design', slug: 'layout-design' },
      { name: 'Sales Resources', slug: 'sales-resources' },
      { name: 'Infographic', slug: 'infographic' },
      { name: 'Welcome/Onboarding Kit', slug: 'welcome-onboarding-kit' },
      { name: 'Signage Design', slug: 'signage-design' },
      { name: 'Intake Forms', slug: 'intake-forms' },
    ],
  },
  {
    name: 'Back-Office Design',
    slug: 'back-office-design',
    category: 'service' as const,
    tagline: 'The systems behind the scenes that keep you running',
    description: 'SOPs, file organization, CRM setup, and automation — the infrastructure that lets you scale without chaos.',
    services: [
      { name: 'Digital File Organization', slug: 'digital-file-organization' },
      { name: 'SOP Creation', slug: 'sop-creation' },
      { name: 'CRM Setup & Data Cleanup', slug: 'crm-setup-and-data-cleanup' },
      { name: 'Software Automation Setup', slug: 'software-automation-setup' },
      { name: 'Training Setup & Organization', slug: 'training-setup-organization' },
      { name: 'Journey Map', slug: 'journey-map' },
      { name: 'Software Subscription Audit', slug: 'software-subscription-audit' },
      { name: 'AI Integration', slug: 'automated-workflow-and-ai-integration' },
    ],
  },
  {
    name: 'Product Design',
    slug: 'product-design',
    category: 'product' as const,
    tagline: 'Build digital products people actually use',
    description: 'SaaS platforms, mobile apps, design systems — we design and build the products that power your business.',
    services: [
      { name: 'SaaS', slug: 'saas' },
      { name: 'Mobile App', slug: 'mobile-app' },
      { name: 'Design Systems', slug: 'design-systems' },
      { name: 'Content Design', slug: 'content-design' },
    ],
  },
];

export default function ServicesPage() {
  return (
    <>
      {/* Hero */}
      <section style={{ maxWidth: 1200, margin: '0 auto', padding: 'var(--padding-xl) var(--padding-lg)' }}>
        <h1 style={{ fontFamily: 'var(--font-family-heading)', fontSize: 'var(--heading-xl)', color: 'var(--text-primary)', margin: 0 }}>
          Our Services
        </h1>
        <p style={{ fontFamily: 'var(--font-family-body)', fontSize: 'var(--body-lg)', color: 'var(--text-secondary)', marginTop: 'var(--gap-md)', maxWidth: 700 }}>
          We offer design services at every stage of your business growth — from establishment to maturity.
        </p>
      </section>

      {/* Service line grid */}
      <section style={{ backgroundColor: 'var(--surface-secondary)', padding: 'var(--padding-xl) var(--padding-lg)' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <ServiceLineGrid items={serviceLines} />
        </div>
      </section>

      {/* Service lines expanded */}
      {serviceLines.map((line) => (
        <section
          key={line.slug}
          id={line.slug}
          style={{ padding: 'var(--padding-xl) var(--padding-lg)' }}
        >
          <div style={{ maxWidth: 1200, margin: '0 auto' }}>
            <h2 style={{ fontFamily: 'var(--font-family-heading)', fontSize: 'var(--heading-lg)', color: 'var(--text-primary)', margin: 0 }}>
              {line.name}
            </h2>
            <p style={{ fontFamily: 'var(--font-family-body)', fontSize: 'var(--body-md)', color: 'var(--text-secondary)', marginTop: 'var(--gap-sm)', maxWidth: 600 }}>
              {line.description}
            </p>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
                gap: 'var(--gap-md)',
                marginTop: 'var(--gap-lg)',
              }}
            >
              {line.services.map((svc) => (
                <a
                  key={svc.slug}
                  href={`/services/${line.slug}/${svc.slug}`}
                  style={{
                    display: 'block',
                    padding: 'var(--padding-md)',
                    backgroundColor: 'var(--surface-primary)',
                    border: '1px solid var(--border-secondary)',
                    borderRadius: 'var(--border-radius-md)',
                    textDecoration: 'none',
                    transition: 'border-color 0.15s ease',
                  }}
                >
                  <span style={{ fontFamily: 'var(--font-family-label)', fontSize: 'var(--label-md)', color: 'var(--text-primary)' }}>
                    {svc.name}
                  </span>
                </a>
              ))}
            </div>
          </div>
        </section>
      ))}
    </>
  );
}
