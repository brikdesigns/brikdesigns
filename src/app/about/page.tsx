import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { LinkButton } from '@bds/components/ui/Button/LinkButton';
import { getServiceCategories, mapCategorySlug } from '@/lib/supabase/queries';
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
    image: '/images/Abbey-Headshot.png',
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
    image: '/images/Nick-Headshot.png',
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
  const categories = await getServiceCategories();

  const serviceLines = categories
    .filter((cat) => cat.slug !== 'product')
    .map((cat) => ({
      name: cat.name,
      slug: cat.slug,
      category: mapCategorySlug(cat.slug),
      description: cat.tagline || cat.description || '',
      imageUrl: cat.card_image_url || null,
    }));

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
          <div className="about-hero__scroll">
            <span className="text-label-sm text--secondary">Scroll down</span>
          </div>
        </div>
      </section>

      {/* ═══ Team ═══ */}
      {/* Webflow: 2-col bordered cards, large circle headshots, social links, full bios */}
      <section className="content-section about-team-section">
        <div className="container-lg">
          <div className="about-team-grid">
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
                <h3 className="text-heading-md about-team-name">Meet {member.name}</h3>
                <p className="text-label-sm text--secondary">{member.role}</p>
                <div className="about-team-social">
                  <a href={member.linkedin} target="_blank" rel="noopener noreferrer" aria-label="LinkedIn" className="about-social-link">
                    <svg width="16" height="16" viewBox="0 0 448 512" fill="currentColor"><path d="M100.3 448H7.4V148.9h92.9zM53.8 108.1C24.1 108.1 0 83.5 0 53.8a53.8 53.8 0 0 1 107.6 0c0 29.7-24.1 54.3-53.8 54.3zM447.9 448h-92.7V302.4c0-34.7-.7-79.2-48.3-79.2-48.3 0-55.7 37.7-55.7 76.7V448h-92.8V148.9h89.1v40.8h1.3c12.4-23.5 42.7-48.3 87.9-48.3 94 0 111.3 61.9 111.3 142.3V448z" /></svg>
                  </a>
                  <a href={`mailto:${member.email}`} aria-label="Email" className="about-social-link">
                    <svg width="16" height="16" viewBox="0 0 512 512" fill="currentColor"><path d="M48 64C21.5 64 0 85.5 0 112c0 15.1 7.1 29.3 19.2 38.4L236.8 313.6c11.4 8.5 27 8.5 38.4 0L492.8 150.4c12.1-9.1 19.2-23.3 19.2-38.4c0-26.5-21.5-48-48-48H48zM0 176V384c0 35.3 28.7 64 64 64H448c35.3 0 64-28.7 64-64V176L294.4 339.2c-22.8 17.1-54 17.1-76.8 0L0 176z" /></svg>
                  </a>
                  {member.website && (
                    <a href={member.website} target="_blank" rel="noopener noreferrer" aria-label="Website" className="about-social-link">
                      <svg width="16" height="16" viewBox="0 0 512 512" fill="currentColor"><path d="M352 256c0 22.2-1.2 43.6-3.3 64H163.3c-2.2-20.4-3.3-41.8-3.3-64s1.2-43.6 3.3-64H348.7c2.2 20.4 3.3 41.8 3.3 64zm28.8-64H503.9c5.3 20.5 8.1 41.9 8.1 64s-2.8 43.5-8.1 64H380.8c2.1-20.6 3.2-42 3.2-64s-1.1-43.4-3.2-64zm112.6-32H376.7c-10-63.9-29.8-117.4-55.3-151.6c78.3 20.7 142 77.5 172.9 151.6zm-420.7 0c30.9-74.1 94.6-130.9 172.9-151.6c-25.5 34.2-45.2 87.7-55.3 151.6H72.7zM256 32c-32 0-67.1 60.4-82 160h164c-14.9-99.6-50-160-82-160zM8.1 192H131.2c-2.1 20.6-3.2 42-3.2 64s1.1 43.4 3.2 64H8.1C2.8 299.5 0 278.1 0 256s2.8-43.5 8.1-64zM194.7 446.6c-25.5-34.2-45.2-87.7-55.3-151.6H72.7c30.9 74.1 94.6 130.9 172.9 151.6zm122.6 0c78.3-20.7 142-77.5 172.9-151.6H376.7c-10 63.9-29.8 117.4-55.3 151.6zM256 480c32 0 67.1-60.4 82-160H174c14.9 99.6 50 160 82 160z" /></svg>
                    </a>
                  )}
                </div>
                <div className="about-team-bio">
                  {member.bio.map((paragraph, i) => (
                    <p key={i} className="text-body-sm text--secondary">{paragraph}</p>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ Value of Design CTA ═══ */}
      {/* Webflow: bordered card, 2-col: text left + 3D diamond image right */}
      <section className="content-section about-value-section">
        <div className="container-lg">
          <div className="about-value-card">
            <div className="about-value-text">
              <h2 className="text-heading-md">The Value of Design</h2>
              <p className="text-body-md text--secondary">Learn about the value of design in 4 steps.</p>
              <LinkButton href="/value" variant="primary" size="md">Learn More</LinkButton>
            </div>
            <div className="about-value-image">
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
      <section className="content-section content-section--accent about-pillars-section">
        <div className="container-lg container-lg--comfortable">
          {PILLARS.map((pillar) => (
            <div key={pillar.number} className="about-pillar-row">
              <div className="about-pillar-label">
                <span className="text-label-sm text--brand">{pillar.number}</span>
                <h3 className="text-heading-md">{pillar.title}</h3>
              </div>
              <div className="about-pillar-body">
                <p className="text-body-md text--secondary">{pillar.body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ═══ Our Services ═══ */}
      {/* Webflow: header text + 3-col grid of image cards with "Learn more" buttons */}
      <section className="content-section about-services-section">
        <div className="container-lg container-lg--comfortable">
          <div className="content-wrapper content-wrapper--center">
            <p className="text-body-md text--secondary text--center">
              From branding to websites to behind-the-scenes systems, we help you build a business that looks good and works better.
            </p>
          </div>
          <div className="about-services-grid">
            {serviceLines.map((line) => (
              <Link key={line.slug} href={`/services/${line.slug}`} className="about-service-card">
                <div className="about-service-image">
                  {line.imageUrl ? (
                    <Image
                      src={line.imageUrl}
                      alt={line.name}
                      width={400}
                      height={400}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  ) : (
                    <div style={{ width: '100%', height: '100%', backgroundColor: 'var(--surface-accent)' }} />
                  )}
                </div>
                <h3 className="text-heading-sm">{line.name}</h3>
                <p className="text-body-sm text--secondary">{line.description}</p>
                <span className="bds-button bds-button--secondary bds-button--sm about-service-cta">Learn more</span>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
