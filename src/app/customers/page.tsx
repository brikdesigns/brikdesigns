/**
 * Customers Page — transcribed from Paper artboard "Customers Page"
 * Built from Webflow source HTML sections: section_hero, section_all-industries,
 * section_customer-types, section_industries, section_challenges, section_cta.
 */
import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { Icon } from '@iconify/react';
import { LinkButton } from '@bds/components/ui/Button/LinkButton';
import { getIndustryPages } from '@/lib/supabase/queries';
import '../shared-sections.css';
import './customers.css';

export const metadata: Metadata = {
  title: 'Customers | Who We Work With',
  description: 'Brik helps healthcare, real estate, SaaS, and small businesses with senior-level design and strategic marketing support.',
};

export const revalidate = 3600;

const INDUSTRIES_WE_KNOW = [
  { name: 'Healthcare & Health Tech', icon: 'lucide:hospital' },
  { name: 'Real Estate & Development', icon: 'lucide:building' },
  { name: 'SaaS & Digital Products', icon: 'lucide:smartphone' },
  { name: 'Marketing & Media', icon: 'lucide:megaphone' },
  { name: 'Entertainment & Events', icon: 'lucide:clapperboard' },
  { name: 'Professional Services', icon: 'lucide:briefcase' },
];

const SEGMENTS = [
  {
    icon: 'lucide:rocket',
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
    icon: 'lucide:building-2',
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
    icon: 'lucide:landmark',
    heading: 'Enterprise & Corporate Teams',
    subheading: 'Smart external support that doesn\u2019t slow you down',
    desc: 'You need a partner who can plug in with minimal lift and deliver like they\u2019ve been on your team for years. We\u2019re the fast-moving, no-handholding kind of partner execs love.',
    fits: [
      'Execs who want a reliable creative partner',
      'Teams launching campaigns across multiple brands or regions',
      'Companies needing consistent, scalable design systems',
    ],
  },
];

// Challenge quote colors — mapped to service line brand_color_light values
const CHALLENGES = [
  { text: 'We need to look more professional, but don\u2019t have the budget for a full-time designer', color: 'var(--services--purple-light)' },
  { text: 'Our marketing materials aren\u2019t consistent with our brand anymore', color: 'var(--services--green)' },
  { text: 'We have a great product, but struggle to explain it simply', color: 'var(--services--blue)' },
  { text: 'We need high-quality design work, but can\u2019t wait weeks for an agency', color: 'var(--services--purple-light)' },
];

export default async function CustomersPage() {
  const industries = await getIndustryPages();

  return (
    <>
      {/* ═══ Section 1: Hero ═══ */}
      <section className="customers-hero">
        <div className="container-lg customers-hero__container">
          <h1 className="text-display-sm">Customers</h1>
          <div className="customers-hero__body">
            <p className="text-body-huge">
              Whether you&apos;re launching something new or streamlining something complex&mdash;we&apos;re
              here to help you make it real, effective, and beautifully executed.
            </p>
            <p className="text-body-huge">
              You don&apos;t need to hire a full in-house team to move like one. Brik gives you access
              to senior-level design and strategic support&mdash;without the full-time overhead.
            </p>
          </div>
          <div className="customers-hero__scroll">
            <a href="#industry" className="customers-hero__scroll-link">
              Scroll down
            </a>
          </div>
        </div>
      </section>

      {/* ═══ Section 2: Industries We Know Inside-Out ═══ */}
      <section id="industry" className="svc-page__section">
        <div className="container-lg container-lg--comfortable" style={{ alignItems: 'center' }}>
          <div className="content-wrapper content-wrapper--center">
            <h2 className="text-heading-xl text--center">Industries We Know Inside-Out</h2>
            <p className="text-body-md text--center">
              We don&apos;t just &ldquo;dabble&rdquo;&mdash;we bring depth. Our team has hands-on experience in:
            </p>
          </div>
          <div className="customers-industry-grid">
            {INDUSTRIES_WE_KNOW.map((ind) => (
              <div key={ind.name} className="customers-industry-card">
                <Icon icon={ind.icon} width={36} height={36} />
                <span className="text-label-md text--center">{ind.name}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ Section 3: Customer Types ═══ */}
      <section className="svc-page__section">
        <div className="container-lg">
          <div className="customers-segment-list-wrap">
            {SEGMENTS.map((seg) => (
              <div key={seg.heading} className="customers-segment-card">
                <div className="customers-segment-card__inner">
                  <div className="customers-segment-card__left">
                    <Icon icon={seg.icon} width={36} height={36} />
                    <div className="customers-segment-card__header">
                      <span className="text-heading-md">{seg.heading}</span>
                      <span className="text-body-lg text--secondary">{seg.subheading}</span>
                    </div>
                    <p className="text-body-md">{seg.desc}</p>
                    <div>
                      <LinkButton href="/contact" variant="primary" size="md">Let&apos;s Talk</LinkButton>
                    </div>
                  </div>
                  <div className="customers-segment-card__right">
                    <span className="text-label-md text--secondary">Great fit for</span>
                    <div className="customers-segment-fits">
                      {seg.fits.map((fit) => (
                        <div key={fit} className="customers-segment-fit">
                          <span className="text-body-sm">&bull;</span>
                          <span className="text-body-sm">{fit}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ Section 4: Industries (CMS cards) ═══ */}
      <section className="svc-page__section">
        <div className="container-lg container-lg--comfortable" style={{ alignItems: 'center' }}>
          <div className="content-wrapper content-wrapper--center">
            <h2 className="text-heading-xl text--center">Industries</h2>
            <p className="text-body-md">Learn more about the industries we specifically support</p>
          </div>
          <div className="customers-detail-grid">
            {industries.map((ind) => (
              <Link key={ind.slug} href={`/industries/${ind.slug}`} className="customers-detail-card">
                {ind.hero_image_url && (
                  <Image src={ind.hero_image_url} alt="" width={48} height={48} style={{ objectFit: 'contain' }} />
                )}
                <span className="text-heading-sm text--center">{ind.name}</span>
                {ind.tagline && <span className="text-body-sm text--secondary text--center">{ind.tagline}</span>}
                <span className="bds-button bds-button--primary bds-button--sm">Learn More</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ Section 5: Common Challenges We Solve ═══ */}
      <section className="svc-page__section customers-challenges-section">
        <div className="container-lg container-lg--comfortable" style={{ alignItems: 'center' }}>
          <div className="content-wrapper content-wrapper--center content-wrapper--narrow">
            <h2 className="text-heading-xl text--center">Common Challenges We Solve</h2>
            <p className="text-body-md text--secondary text--center">
              Sound familiar? You&apos;re in the right place. Our clients choose us because we understand
              their challenges and deliver solutions that work.
            </p>
          </div>
          <div className="customers-challenges">
            {CHALLENGES.map((challenge) => (
              <div
                key={challenge.text}
                className="customers-challenge"
                style={{ backgroundColor: challenge.color }}
              >
                <span className="customers-challenge__quote">&ldquo;</span>
                <p className="customers-challenge__text">{challenge.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ Section 6: Get in Touch CTA ═══ */}
      <section className="svc-page__section">
        <div className="container-lg" style={{ display: 'flex', justifyContent: 'center' }}>
          <div className="customers-cta">
            <h2 className="text-heading-lg text--center text--inverse">Get in Touch</h2>
            <p className="text-body-lg text--center text--inverse">
              Starting a new project or want to collaborate with us?
            </p>
            <LinkButton href="/contact" variant="inverse" size="lg">Let&apos;s Talk</LinkButton>
          </div>
        </div>
      </section>
    </>
  );
}
