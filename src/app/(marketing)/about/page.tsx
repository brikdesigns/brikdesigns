import type { Metadata } from 'next';
import Image from 'next/image';
import { Icon } from '@/lib/icon';
import { Grid, Button, SectionHeader } from '@brikdesigns/bds';
import { getServiceCategories, getSupportPlans } from '@/lib/supabase/queries';
import { text, heading, label } from '@/lib/styles';
import { color } from '@/lib/tokens';
import { ScrollDownCta } from '@/components/ui/ScrollDownCta';
import { HomePlanCard } from '@/components/homepage/HomePlanCard';
import '../shared-sections.css';
import './about.css';

export const metadata: Metadata = {
  title: 'About Brik Designs | Your Marketing & Design Partner',
  description: 'Meet the team behind Brik Designs. We help businesses thrive through practical design, streamlined systems, and strategic creative support.',
};

export const revalidate = 3600;

const TEAM = [
  {
    name: 'Abbey',
    fullName: 'Abbey Stanerson',
    role: 'Co-founder, Marketing and Operations',
    image: '/images/Abbey-Headshot.webp',
    bio: [
      'Abbey brings over a decade of experience in marketing and operations, ranging from working at a startup marketing agency to a Fortune 500 marketing agency focused on private practices, particularly in the dental industry. She has collaborated with hundreds of clients to craft strategies that drive meaningful results. Known for her bubbly personality and "yay!" enthusiasm, Abbey combines her approachable demeanor with a deep understanding of what works.',
      'Her open, honest communication style ensures clients feel informed and confident while her expertise in deciphering what\'s right for each project delivers solutions that truly make an impact.',
    ],
    linkedin: 'https://www.linkedin.com/in/abbeystanerson',
    email: 'abbey@brikdesigns.com',
  },
  {
    name: 'Nick',
    fullName: 'Nick Stanerson',
    role: 'Co-founder, Creative',
    image: '/images/Nick-Headshot.webp',
    bio: [
      'Nick is a meticulous designer with extensive experience as a lead designer at prestigious product companies, including iHeartRadio, SimplePractice, and Built. His expertise lies in transforming complex ideas into intuitive, user-friendly designs through thorough research, testing, and refinement.',
      'Nick\'s work goes beyond aesthetics\u2014he ensures every design is both functional and impactful, creating experiences that connect with users and drive results. With a relentless commitment to excellence, Nick delivers designs that balance beauty, functionality, and innovation.',
    ],
    linkedin: 'https://www.linkedin.com/in/nickstanerson',
    email: 'nick@brikdesigns.com',
    website: 'https://nickstanerson.com',
  },
];

const PILLARS = [
  {
    number: '01',
    title: 'Approach',
    body: 'Our approach is simple: it\u2019s not about being the biggest agency; it\u2019s about doing right by our clients. We deliver creative, functional, and effective solutions designed to help businesses succeed\u2014whether they\u2019re just getting started or leading the way.',
  },
  {
    number: '02',
    title: 'Mission',
    body: 'Our mission is to simplify the complex through intentional design. We create high-quality, customized solutions that help businesses of all sizes connect with their audiences, reduce confusion, and focus on what they love. By staying lean and focused, we deliver personal, impactful strategies that make navigating information easier and more effective.',
  },
  {
    number: '03',
    title: 'Vision',
    body: 'We envision a world where design makes life simpler, more intentional, and impactful. In a world overwhelmed by complexity and noise, we aim to show how thoughtful design can help businesses and their audiences navigate with ease, spend time on what matters, and create deeper connections.',
  },
];

export default async function AboutPage() {
  const [categories, plans] = await Promise.all([
    getServiceCategories(),
    getSupportPlans(),
  ]);

  // Support-plan cards for the "Monthly Subscription" band, repurposed from the
  // home page. Plan cards render the marketing-line illustration, joined
  // client-side against the already-fetched service lines via
  // service_plans.display_line_id (mirrors src/app/(marketing)/page.tsx).
  const serviceLineById = new Map(categories.map((cat) => [cat.id, cat]));
  const supportPlans = plans
    // Product Support is a niche plan — excluded from the Monthly Subscription
    // band (mirrors the home page; still live on the Plans page).
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
      {/* ═══ Hero ═══ */}
      {/* Webflow: white bg, h1 "About", intro paragraph, scroll indicator */}
      <section className="page-hero about-hero">
        <div className="page-hero__container">
          <h1 className="page-hero__title">About</h1>
          <p className="about-hero__intro">
            With over 20 years of combined experience, Abbey and Nick form a dynamic partnership
            that challenges the status quo. They don&apos;t settle for &ldquo;how it&apos;s always been done&rdquo;&mdash;instead,
            they strive to make every project better, smarter, and more impactful. Their shared
            commitment to clear communication, high-quality work, and quick turnarounds ensures
            their clients feel supported every step of the way.
          </p>
          <p className="about-hero__intro">
            At the core of their work is a focus on people&mdash;whether it&apos;s their customers or their
            customers&apos; customers&mdash;creating designs and strategies that work for everyone.
          </p>
        </div>
        <ScrollDownCta />
      </section>

      {/* ═══ Team ═══ */}
      {/* Webflow: 2-col bordered cards, large circle headshots, social links, full bios */}
      <section className="page-section">
        <div className="container-lg">
          <Grid columns={2} gap="lg">
            {TEAM.map((member) => (
              <div key={member.name} className="about-team-card">
                <div className="about-team-avatar">
                  <Image
                    src={member.image}
                    alt={member.fullName}
                    width={300}
                    height={300}
                    style={{ objectFit: 'cover', width: '100%', height: '100%' }}
                  />
                </div>
                <h3 className="about-team-name" style={heading.md}>Meet {member.name}</h3>
                <p style={{ ...label.smBold, color: color.text.secondary }}>{member.role}</p>
                <div className="about-team-social">
                  <Button
                    href={member.linkedin}
                    target="_blank"
                    rel="noopener noreferrer"
                    variant="secondary"
                    size="sm"
                    icon={<Icon icon="ph:linkedin-logo" />}
                    label={`${member.name} on LinkedIn`}
                  />
                  <Button
                    href={`mailto:${member.email}`}
                    variant="secondary"
                    size="sm"
                    icon={<Icon icon="ph:envelope-simple" />}
                    label={`Email ${member.name}`}
                  />
                  {member.website && (
                    <Button
                      href={member.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      variant="secondary"
                      size="sm"
                      icon={<Icon icon="ph:globe" />}
                      label={`${member.name}'s website`}
                    />
                  )}
                </div>
                <div className="about-team-bio">
                  {member.bio.map((paragraph, i) => (
                    <p key={i} style={{ ...text.body, color: color.text.secondary }}>{paragraph}</p>
                  ))}
                </div>
              </div>
            ))}
          </Grid>
        </div>
      </section>

      {/* ═══ Value of Design CTA ═══ */}
      {/* Webflow: bordered card, 2-col: text left + 3D diamond image right */}
      <section className="page-section">
        <div className="container-lg">
          <div className="about-value-card">
            <div className="about-value-text">
              <h2 style={heading.lg}>The Value of Design</h2>
              <p style={{ ...text.body, color: color.text.secondary }}>Learn about the value of design in 4 steps.</p>
              <Button href="/value" variant="primary" size="md">Learn More</Button>
            </div>
            <div className="about-value-card__media">
              <Image
                src="/images/value_of_design_4x.webp"
                alt="The Value of Design"
                width={400}
                height={400}
                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
              />
            </div>
          </div>
        </div>
      </section>

      {/* ═══ Pillars (Approach / Mission / Vision) ═══ */}
      {/* Webflow: tan bg, stacked rows: number+title left, body text right */}
      <section className="page-section page-section--accent">
        <div className="container-lg container-lg--comfortable">
          {PILLARS.map((pillar) => (
            <div key={pillar.number} className="about-pillar-row">
              <div className="about-pillar-label">
                <span style={{ ...heading.md, color: color.text.brand }}>{pillar.number}</span>
                <h3 style={heading.md}>{pillar.title}</h3>
              </div>
              <div className="about-pillar-body">
                <p style={{ ...text.body, color: color.text.secondary }}>{pillar.body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ═══ Support Plans ("Monthly Subscription") ═══ */}
      {/* Repurposed from the home page's plans band; replaced the former
       * "Our Services" grid here. */}
      <section className="page-section">
        <div className="container-lg container-lg--comfortable">
          <SectionHeader
            title="Monthly Subscription"
            description={<>We&apos;re more than a design studio&mdash;we&apos;re your strategic marketing partner.</>}
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
    </>
  );
}
