import type { Metadata } from 'next';
import Link from 'next/link';
import { LinkButton } from '@bds/components/ui/Button/LinkButton';
import '../shared-sections.css';
import './customers.css';

export const metadata: Metadata = {
  title: 'Customers | Who We Work With',
  description: 'Brik helps healthcare, real estate, SaaS, and small businesses with senior-level design and strategic marketing support.',
};

const INDUSTRIES = [
  'Healthcare & Health Tech',
  'Real Estate & Development',
  'SaaS & Digital Products',
  'Marketing & Media',
  'Entertainment & Events',
  'Professional Services',
];

const SEGMENTS = [
  {
    heading: 'Small Business & Startup Support',
    subheading: 'Smart external support that doesn\u2019t slow you down',
    desc: 'You\u2019re wearing a lot of hats. You need results, not runaround. With Brik, you get a high-performing creative and operations team that delivers like a full-time department\u2014at a fraction of the cost.',
    fits: [
      'Founders scaling quickly',
      'Fresh perspective on complex challenges',
      'On-demand expertise when you need it',
      'Teams needing branding, systems, or marketing in place',
    ],
  },
  {
    heading: 'Mid-Sized & Growing Companies',
    subheading: 'Your internal team is busy. Let\u2019s lighten the load',
    desc: 'Need fresh perspective or bandwidth to finally get that backlog tackled? We jump in fast, think like your business, and bring clarity to your chaos.',
    fits: [
      'Marketing or ops leads who need execution',
      'Project managers overwhelmed with half-started tools or systems',
      'Growing orgs looking to professionalize or scale',
    ],
  },
  {
    heading: 'Enterprise & Corporate Teams',
    subheading: 'Smart external support that doesn\u2019t slow you down',
    desc: 'You need a partner who can plug in with minimal lift and deliver like they\u2019ve been on your team for years. We\u2019re the fast-moving, no-handholding kind of partner execs love.',
    fits: [
      'Department heads with limited internal resources',
      'Strategy teams needing visual, operational, or digital execution',
      'Brands launching internal tools, apps, or service initiatives',
    ],
  },
];

const INDUSTRY_CARDS = [
  { name: 'SaaS', slug: 'product', tagline: 'Clarity from screen to system.' },
  { name: 'Small Business', slug: 'small-business', tagline: 'Build smart, scale fast.' },
  { name: 'Real Estate', slug: 'real-estate', tagline: 'Attract tenants, fill vacancies' },
  { name: 'Dental', slug: 'dental', tagline: 'Build trust, grow referrals.' },
];

const CHALLENGES = [
  'We need to look more professional, but don\u2019t have the budget for a full-time designer',
  'Our marketing materials aren\u2019t consistent with our brand anymore',
  'We have a great product, but struggle to explain it simply',
  'We need high-quality design work, but can\u2019t wait weeks for an agency',
];

export default function CustomersPage() {
  return (
    <>
      {/* Hero */}
      <section className="page-hero page-hero--brand">
        <div className="page-hero__container">
          <h1 className="page-hero__title">Customers</h1>
          <p className="page-hero__description">
            Whether you&apos;re launching something new or streamlining something complex&mdash;we&apos;re
            here to help you make it real, effective, and beautifully executed.
          </p>
        </div>
      </section>

      {/* Intro */}
      <section className="content-section customers-section">
        <div className="container-lg container-lg--comfortable">
          <div className="content-wrapper content-wrapper--center content-wrapper--narrow">
            <p className="text-body-lg text--center">
              You don&apos;t need to hire a full in-house team to move like one. Brik gives you access
              to senior-level design and strategic support&mdash;without the full-time overhead.
            </p>
          </div>
        </div>
      </section>

      {/* Industries we know */}
      <section className="content-section content-section--accent customers-section">
        <div className="container-lg container-lg--comfortable">
          <div className="content-wrapper content-wrapper--center content-wrapper--narrow">
            <h2 className="text-heading-lg text--center">Industries We Know Inside-Out</h2>
            <p className="text-body-md text--secondary text--center">
              We don&apos;t just &ldquo;dabble&rdquo;&mdash;we bring depth. Our team has hands-on experience in:
            </p>
          </div>
          <div className="customers-industry-grid">
            {INDUSTRIES.map((name) => (
              <div key={name} className="customers-industry-card">
                <h3 className="text-heading-sm text--center">{name}</h3>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Company size segments */}
      <section className="content-section content-section--secondary customers-section">
        <div className="container-lg container-lg--comfortable">
          <div className="grid-3">
            {SEGMENTS.map((seg) => (
              <div key={seg.heading} className="customers-segment-card">
                <h3 className="text-heading-sm">{seg.heading}</h3>
                <p className="text-label-sm text--brand">{seg.subheading}</p>
                <p className="text-body-sm text--secondary">{seg.desc}</p>
                <div className="customers-segment-fits">
                  <p className="text-label-sm">Great fit for:</p>
                  <ul className="customers-segment-list">
                    {seg.fits.map((fit) => (
                      <li key={fit} className="text-body-sm text--secondary">{fit}</li>
                    ))}
                  </ul>
                </div>
                <LinkButton href="/contact" variant="primary" size="sm">
                  Let&apos;s Talk
                </LinkButton>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Industry detail cards */}
      <section className="content-section customers-section">
        <div className="container-lg container-lg--comfortable">
          <div className="customers-detail-grid">
            {INDUSTRY_CARDS.map((ind) => (
              <Link key={ind.slug} href={`/customers/${ind.slug}`} className="customers-detail-card">
                <h3 className="text-heading-sm">{ind.name}</h3>
                <p className="text-body-sm text--secondary">{ind.tagline}</p>
                <span className="bds-button bds-button--secondary bds-button--sm">Learn More</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Common challenges */}
      <section className="content-section content-section--secondary customers-section">
        <div className="container-lg container-lg--comfortable">
          <div className="content-wrapper content-wrapper--center content-wrapper--narrow">
            <h2 className="text-heading-lg text--center">Common Challenges We Solve</h2>
          </div>
          <div className="customers-challenges">
            {CHALLENGES.map((challenge) => (
              <div key={challenge} className="customers-challenge">
                <p className="text-body-md">{challenge}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="content-section customers-section">
        <div className="container-lg">
          <div className="content-wrapper content-wrapper--center">
            <h2 className="text-heading-lg text--center">Get in Touch</h2>
            <p className="text-body-md text--secondary text--center">
              Starting a new project or want to collaborate with us?
            </p>
            <div className="button-wrapper button-wrapper--center">
              <LinkButton href="/contact" variant="primary" size="lg">Let&apos;s Talk</LinkButton>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
