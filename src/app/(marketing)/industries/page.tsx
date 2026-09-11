import type { Metadata } from 'next';
import Image from 'next/image';
import { Grid, Card, CardDescription, LinkButton, Frame } from '@brikdesigns/bds';
import { getIndustryPages } from '@/lib/supabase/queries';
import { text, heading } from '@/lib/styles';
// Hero reuses the home page's `.section-hero` / `.hero-*` block (the sanctioned
// section-hero reuse path — marketing-section-reuse.md), re-themed dark by
// `.industries-hero` the same way `.plans-hero` re-themes to accent-blue.
import '../homepage.css';
import '../shared-sections.css';
import './industries.css';

export const metadata: Metadata = {
  alternates: { canonical: '/industries' },
  title: 'Industries | Brik',
  description:
    'Brik works with dental practices, real estate professionals, and small businesses. We handle the marketing and back office — starting with a free BrikDown audit.',
};

export const revalidate = 86400;

export default async function IndustriesPage() {
  const industryCards = await getIndustryPages();

  return (
    <>
      {/* Hero — dark inverse card (Figma section-hero, node 26149:27554). Copy
       * from the Notion "Industries" page, not the Figma placeholder. */}
      <section className="section-hero industries-hero" data-section="hero">
        <div className="hero-container">
          <div className="hero-layout">
            <div className="hero-text">
              <h1 className="hero-title">No learning curve. We already speak your language.</h1>
              <p className="hero-description">
                Brik works with dental practices, real estate professionals, and small
                businesses&mdash;industries we know well enough to skip the learning curve.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Industry cards — CMS-driven (getIndustryPages). Figma section-process
       * (node 26149:27556); its "Before we build, we learn" header is Marketing-plan
       * placeholder and is not in the Notion Industries copy, so it is omitted per
       * operator (#1406). White band → cards inherit border + no shadow from the
       * shared card-chrome-by-band rule. */}
      {industryCards.length > 0 && (
        <section className="page-section" data-section="industries">
          <div className="container-lg container-lg--comfortable">
            <Grid columns={3} gap="lg">
              {industryCards.map(
                (ind: { slug: string; name: string; tagline: string | null; image_url: string | null }) => (
                  <Card
                    key={ind.slug}
                    layout="stack"
                    title={ind.name}
                    media={
                      ind.image_url ? (
                        <Frame ratio="square" fit="contain" className="illustration-media-bg">
                          <Image src={ind.image_url} alt="" width={240} height={240} />
                        </Frame>
                      ) : undefined
                    }
                    action={
                      <LinkButton href={`/industries/${ind.slug}`} variant="primary" size="md">
                        Learn More
                      </LinkButton>
                    }
                    className="industry-card"
                  >
                    {ind.tagline ? <CardDescription>{ind.tagline}</CardDescription> : undefined}
                  </Card>
                )
              )}
            </Grid>
          </div>
        </section>
      )}

      {/* Customer story — the BrikDown 2-col block (Figma section-customer-story,
       * node 26156:3059). Copy from the Notion "Industries" page's closing section.
       * The 4:3 media is an operator-approved placeholder (#1406). */}
      <section className="page-section" data-section="brikdown">
        <div className="container-lg container-lg--comfortable">
          <div className="customer-story">
            <div className="customer-story__content">
              <h2 className="customer-story__title" style={heading.lg}>
                The BrikDown tells us both whether we&apos;re the right fit.
              </h2>
              <p style={text.body}>
                It&apos;s a 60-minute audit&mdash;not a sales call. We pull the data, show you
                what we found, and give you an honest picture of what we&apos;d work on and
                whether Brik makes sense for your business.
              </p>
              <p style={text.body}>
                We work with a focused number of clients at a time. The BrikDown is how we
                figure out if we&apos;re a fit for each other. You work directly with Abbey and
                Nick from day one&mdash;not a coordinator, not a rotating team.
              </p>
              <LinkButton href="/contact" variant="primary" size="lg" className="customer-story__cta">
                Schedule Your Free BrikDown
              </LinkButton>
            </div>
            {/* UNSOURCED: customer-story image (4:3) — placeholder well per operator
             * "placeholder for now" (#1406). No <img> so no broken-asset request. */}
            <div className="customer-story__media" aria-hidden="true" />
          </div>
        </div>
      </section>
    </>
  );
}
