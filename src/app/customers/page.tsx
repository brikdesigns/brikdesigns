import type { Metadata } from 'next';
import { Grid, Card, CardFooter, Button } from '@brikdesigns/bds';
import { getIndustryPages } from '@/lib/supabase/queries';
import { text, heading, label } from '@/lib/styles';
import { color } from '@/lib/tokens';
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

// Light tints matching the brikdesigns.com (Webflow) target \u2014 decorative pastels
// per challenge card, in a fixed order. Text uses text.primary so contrast holds.
const CHALLENGES = [
  { text: 'We need to look more professional, but don\u2019t have the budget for a full-time designer', bg: '#bcdfeb' },
  { text: 'Our marketing materials aren\u2019t consistent with our brand anymore', bg: '#c8e6c9' },
  { text: 'We have a great product, but struggle to explain it simply', bg: '#fff4ad' },
  { text: 'We need high-quality design work, but can\u2019t wait weeks for an agency', bg: '#d8c5e8' },
];

export const revalidate = 86400;

export default async function CustomersPage() {
  const industryCards = await getIndustryPages();

  return (
    <>
      {/* Hero */}
      <section className="page-hero">
        <div className="page-hero__container">
          <h1 className="page-hero__title">Customers</h1>
          <p className="page-hero__description">
            Whether you&apos;re launching something new or streamlining something complex&mdash;we&apos;re
            here to help you make it real, effective, and beautifully executed.
          </p>
        </div>
      </section>

      {/* Intro */}
      <section className="content-section">
        <div className="container-lg container-lg--comfortable">
          <div className="content-wrapper content-wrapper--center content-wrapper--narrow">
            <p style={{ ...text.bodyLg, textAlign: 'center' }}>
              You don&apos;t need to hire a full in-house team to move like one. Brik gives you access
              to senior-level design and strategic support&mdash;without the full-time overhead.
            </p>
          </div>
        </div>
      </section>

      {/* Industries we know */}
      <section className="content-section content-section--accent">
        <div className="container-lg container-lg--comfortable">
          <div className="content-wrapper content-wrapper--center content-wrapper--narrow">
            <h2 style={{ ...heading.lg, textAlign: 'center' }}>Industries We Know Inside-Out</h2>
            <p style={{ ...text.body, color: color.text.secondary, textAlign: 'center' }}>
              We don&apos;t just &ldquo;dabble&rdquo;&mdash;we bring depth. Our team has hands-on experience in:
            </p>
          </div>
          <Grid columns={3} gap="lg">
            {INDUSTRIES.map((name) => (
              <Card key={name} variant="elevated" padding="lg" style={{ textAlign: 'center' }}>
                <h3 style={heading.sm}>{name}</h3>
              </Card>
            ))}
          </Grid>
        </div>
      </section>

      {/* Company size segments */}
      <section className="content-section content-section--secondary">
        <div className="container-lg container-lg--comfortable">
          <Grid columns={3} gap="md">
            {SEGMENTS.map((seg) => (
              <Card key={seg.heading} variant="outlined" padding="md">
                <h3 style={heading.sm}>{seg.heading}</h3>
                <p style={{ ...label.smBold, color: color.text.brand }}>{seg.subheading}</p>
                <p style={{ ...text.bodySm, color: color.text.secondary }}>{seg.desc}</p>
                <div className="customers-segment-fits">
                  <p style={label.smBold}>Great fit for:</p>
                  <ul className="customers-segment-list">
                    {seg.fits.map((fit) => (
                      <li key={fit} style={{ ...text.bodySm, color: color.text.secondary }}>{fit}</li>
                    ))}
                  </ul>
                </div>
                <CardFooter>
                  <Button href="/contact" variant="primary" size="sm">
                    Let&apos;s Talk
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </Grid>
        </div>
      </section>

      {/* Industry detail cards — DB-driven */}
      {industryCards.length > 0 && (
        <section className="content-section">
          <div className="container-lg container-lg--comfortable">
            <Grid columns={4}>
              {industryCards.map((ind: { slug: string; name: string; tagline: string | null }) => (
                <Card
                  key={ind.slug}
                  preset="display"
                  href={`/customers/${ind.slug}`}
                  title={ind.name}
                  description={ind.tagline ?? undefined}
                />
              ))}
            </Grid>
          </div>
        </section>
      )}

      {/* Common challenges */}
      <section className="content-section content-section--secondary">
        <div className="container-lg container-lg--comfortable">
          <div className="content-wrapper content-wrapper--center content-wrapper--narrow">
            <h2 style={{ ...heading.lg, textAlign: 'center' }}>Common Challenges We Solve</h2>
          </div>
          <Grid columns={2}>
            {CHALLENGES.map((challenge) => (
              <Card
                key={challenge.text}
                variant="outlined"
                padding="md"
                style={{ backgroundColor: challenge.bg }}
              >
                <p style={text.body}>{challenge.text}</p>
              </Card>
            ))}
          </Grid>
        </div>
      </section>

      {/* CTA */}
      <section className="content-section">
        <div className="container-lg">
          <div className="content-wrapper content-wrapper--center">
            <h2 style={{ ...heading.lg, textAlign: 'center' }}>Get in Touch</h2>
            <p style={{ ...text.body, color: color.text.secondary, textAlign: 'center' }}>
              Starting a new project or want to collaborate with us?
            </p>
            <div className="button-wrapper button-wrapper--center">
              <Button href="/contact" variant="primary" size="lg">Let&apos;s Talk</Button>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
