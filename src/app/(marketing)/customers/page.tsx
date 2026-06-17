import type { Metadata } from 'next';
import Image from 'next/image';
import { Icon } from '@iconify/react';
import { Grid, Card, Button, LinkButton, Frame } from '@brikdesigns/bds';
import { getIndustryPages } from '@/lib/supabase/queries';
import { text, heading, label } from '@/lib/styles';
import { color } from '@/lib/tokens';
import { ScrollDownCta } from '@/components/ui/ScrollDownCta';
import '../shared-sections.css';
import './customers.css';

export const metadata: Metadata = {
  title: 'Customers | Who We Work With',
  description: 'Brik helps healthcare, real estate, SaaS, and small businesses with senior-level design and strategic marketing support.',
};

const INDUSTRIES = [
  { name: 'Healthcare & Health Tech', icon: '/icons/industries/healthcare.svg' },
  { name: 'Real Estate & Development', icon: '/icons/industries/real-estate.svg' },
  { name: 'SaaS & Digital Products', icon: '/icons/industries/saas.svg' },
  { name: 'Marketing & Media', icon: '/icons/industries/media.svg' },
  { name: 'Entertainment & Events', icon: '/icons/industries/entertainment.svg' },
  { name: 'Professional Services', icon: '/icons/industries/professional.svg' },
];

const SEGMENTS = [
  {
    title: 'Small Business & Startup Support',
    subtitle: 'Smart external support that doesn’t slow you down',
    desc: 'You’re wearing a lot of hats. You need results, not runaround. With Brik, you get a high-performing creative and operations team that delivers like a full-time department—at a fraction of the cost.',
    fits: [
      'Founders scaling quickly',
      'Fresh perspective on complex challenges',
      'On-demand expertise when you need it',
      'Teams needing branding, systems, or marketing in place',
    ],
  },
  {
    title: 'Mid-Sized & Growing Companies',
    subtitle: 'Your internal team is busy. Let’s lighten the load',
    desc: 'Need fresh perspective or bandwidth to finally get that backlog tackled? We jump in fast, think like your business, and bring clarity to your chaos.',
    fits: [
      'Marketing or ops leads who need execution',
      'Project managers overwhelmed with half-started tools or systems',
      'Growing orgs looking to professionalize or scale',
    ],
  },
  {
    title: 'Enterprise & Corporate Teams',
    subtitle: 'Smart external support that doesn’t slow you down',
    desc: 'You need a partner who can plug in with minimal lift and deliver like they’ve been on your team for years. We’re the fast-moving, no-handholding kind of partner execs love.',
    fits: [
      'Department heads with limited internal resources',
      'Strategy teams needing visual, operational, or digital execution',
      'Brands launching internal tools, apps, or service initiatives',
    ],
  },
];

// Each card uses one of the four primary service-line surface tokens (skipping
// back-office per editorial decision — these read as primary public service
// lines). The mapping is fixed by index so each challenge keeps its color.
const CHALLENGES = [
  { quote: 'We need to look more professional, but don’t have the budget for a full-time designer', bg: color.service.information.bg },
  { quote: 'Our marketing materials aren’t consistent with our brand anymore', bg: color.service.marketing.bg },
  { quote: 'We have a great product, but struggle to explain it simply', bg: color.service.brand.bg },
  { quote: 'We need high-quality design work, but can’t wait weeks for an agency', bg: color.service.product.bg },
];

export const revalidate = 86400;

export default async function CustomersPage() {
  const industryCards = await getIndustryPages();

  return (
    <>
      {/* Hero — full-viewport interior hero. The intro paragraph (formerly its
       * own section) now lives inside the hero block alongside the title. */}
      <section className="page-hero">
        <div className="page-hero__container">
          <h1 className="page-hero__title">Customers</h1>
          <p className="page-hero__description">
            Whether you&apos;re launching something new or streamlining something complex&mdash;we&apos;re
            here to help you make it real, effective, and beautifully executed.
            You don&apos;t need to hire a full in-house team to move like one. Brik
            gives you access to senior-level design and strategic support&mdash;without
            the full-time overhead.
          </p>
        </div>
        <ScrollDownCta />
      </section>

      {/* Industries we know — hardcoded list of verticals with experience.
       * Icons drive recognition; the name reads as a label below. */}
      <section className="page-section page-section--accent">
        <div className="container-lg container-lg--comfortable">
          <div className="content-wrapper content-wrapper--center">
            <h2 style={{ ...heading.lg, textAlign: 'center' }}>Industries We Know Inside-Out</h2>
            <p style={{ ...text.body, color: color.text.secondary, textAlign: 'center' }}>
              We don&apos;t just &ldquo;dabble&rdquo;&mdash;we bring depth. Our team has hands-on experience in:
            </p>
          </div>
          <Grid columns={3} gap="lg">
            {INDUSTRIES.map((ind) => (
              <Card key={ind.name} variant="elevated" padding="lg" className="industry-know-card">
                <div className="industry-know-card__icon" aria-hidden="true">
                  <Image src={ind.icon} alt="" width={32} height={32} />
                </div>
                <p style={{ ...label.md, textAlign: 'center', margin: 0 }}>{ind.name}</p>
              </Card>
            ))}
          </Grid>
        </div>
      </section>

      {/* Company size segments — horizontal cards via Card preset="display-row".
       * The eyebrow (number + subtitle) sits in the image slot; the fits-list
       * sits in the extras slot between description and action. */}
      <section className="page-section page-section--secondary">
        <div className="container-lg container-lg--comfortable">
          <div className="customers-segments">
            {SEGMENTS.map((seg, idx) => (
              <Card
                key={seg.title}
                preset="display-row"
                imageWidth="narrow"
                image={
                  <div className="segment-card__eyebrow">
                    <span style={{ ...heading.lg, color: color.text.brand, lineHeight: 1 }}>
                      {String(idx + 1).padStart(2, '0')}
                    </span>
                    {/* label.smBold bakes in white-space: nowrap (intended for
                     * chip-style labels). Override here so the subtitle wraps
                     * inside the narrow image column. */}
                    <p style={{ ...label.smBold, color: color.text.brand, whiteSpace: 'normal' }}>{seg.subtitle}</p>
                  </div>
                }
                title={seg.title}
                description={seg.desc}
                extras={
                  <>
                    <p style={label.smBold}>Great fit for:</p>
                    <ul className="customers-segment-list">
                      {seg.fits.map((fit) => (
                        <li key={fit} className="customers-segment-list__item" style={{ ...text.bodySm, color: color.text.secondary }}>
                          <Icon icon="ph:check" className="customers-segment-list__check" aria-hidden="true" />
                          {fit}
                        </li>
                      ))}
                    </ul>
                  </>
                }
                action={
                  <Button href="/contact" variant="primary" size="md">
                    Let&apos;s Talk
                  </Button>
                }
              />
            ))}
          </div>
        </div>
      </section>

      {/* Industry detail cards — DB-driven. Image from industry_pages.image_url
       * drives the card icon (same field used by the detail hero + meganav). */}
      {industryCards.length > 0 && (
        <section className="page-section">
          <div className="container-lg container-lg--comfortable">
            <div className="content-wrapper content-wrapper--center">
              <h2 style={{ ...heading.lg, textAlign: 'center' }}>Industries We Serve</h2>
              <p style={{ ...text.body, color: color.text.secondary, textAlign: 'center' }}>
                Explore detailed playbooks for the verticals we work in most.
              </p>
            </div>
            <Grid columns={4}>
              {industryCards.map((ind: { slug: string; name: string; tagline: string | null; image_url: string | null }) => (
                <Card
                  key={ind.slug}
                  preset="display"
                  title={ind.name}
                  description={ind.tagline ?? undefined}
                  image={ind.image_url ? (
                    <Frame ratio="square" fit="contain" className="illustration-media-bg">
                      <Image src={ind.image_url} alt="" width={240} height={240} />
                    </Frame>
                  ) : undefined}
                  action={
                    <Button href={`/customers/${ind.slug}`} variant="primary" size="md">
                      Learn More
                    </Button>
                  }
                  className="industries-cms-card"
                />
              ))}
            </Grid>
          </div>
        </section>
      )}

      {/* Common challenges — pull-quote cards using --background-service-{name}
       * tokens. Quotation mark and primary color treatment match the Webflow
       * source. */}
      <section className="page-section page-section--secondary">
        <div className="container-lg container-lg--comfortable">
          <div className="content-wrapper content-wrapper--center">
            <h2 style={{ ...heading.lg, textAlign: 'center' }}>Common Challenges We Solve</h2>
            <p style={{ ...text.body, color: color.text.secondary, textAlign: 'center' }}>
              Here are some of the things we hear most often from teams ready to make a change.
            </p>
          </div>
          <Grid columns={2}>
            {CHALLENGES.map((challenge) => (
              <Card
                key={challenge.quote}
                variant="borderless"
                padding="lg"
                className="challenge-card service-surface"
                style={{ backgroundColor: challenge.bg }}
              >
                <span className="challenge-card__quote-mark" aria-hidden="true">&ldquo;</span>
                <p style={text.bodyHuge}>{challenge.quote}</p>
              </Card>
            ))}
          </Grid>
        </div>
      </section>

      {/* Get in Touch — brand-orange CTA card. Uses the established
       * .cta-card-brand pattern shared with customer-stories and the
       * industry detail pages (functionally equivalent to the homepage
       * .cta-card variant). */}
      <section className="cta-section-brand">
        <div className="cta-card-brand">
          <h2 style={{ ...heading.lg, color: color.text.onColorDark, textAlign: 'center', margin: 0 }}>
            Get in touch
          </h2>
          <p style={{ ...text.body, color: color.text.onColorDark, textAlign: 'center', margin: 0, opacity: 0.9 }}>
            Starting a new project or want to collaborate with us?
          </p>
          <LinkButton href="/contact" variant="on-color" size="lg">
            Let&apos;s Talk
          </LinkButton>
        </div>
      </section>
    </>
  );
}
