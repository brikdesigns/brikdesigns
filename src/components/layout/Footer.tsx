import Image from 'next/image';
import { Footer as BdsFooter } from '@brikdesigns/bds';
import { NewsletterForm } from './NewsletterForm';

const aboutLinks = [
  { label: 'Who We Are', href: '/about' },
  { label: 'What We Do', href: '/services' },
  { label: 'Support Plans', href: '/plans' },
  { label: 'Blog', href: '/blog' },
  { label: 'Customer Stories', href: '/customer-stories' },
];

const customerLinks = [
  { label: 'Who We Support', href: '/customers' },
  { label: 'Dental', href: '/industries/dental' },
  { label: 'Real Estate', href: '/industries/real-estate' },
  { label: 'Small Business', href: '/industries/small-business' },
];

const serviceLines: { label: string; href: string; category: 'brand' | 'information' | 'marketing' | 'product' | 'service' }[] = [
  { label: 'Brand Design', href: '/services/brand-design', category: 'brand' },
  { label: 'Information Design', href: '/services/information-design', category: 'information' },
  { label: 'Marketing Design', href: '/services/marketing-design', category: 'marketing' },
  { label: 'Product Design', href: '/services/product-design', category: 'product' },
  { label: 'Back Office Design', href: '/services/back-office-design', category: 'service' },
];

const socialLinks = [
  { label: 'LinkedIn', href: 'https://www.linkedin.com/company/designsbybrik/' },
  { label: 'Facebook', href: 'https://www.facebook.com/designsbybrik' },
  { label: 'Instagram', href: 'https://www.instagram.com/designsbybrik/' },
];

const SERVICE_DOT_VAR: Record<typeof serviceLines[number]['category'], string> = {
  brand: 'var(--services--yellow)',
  marketing: 'var(--services--green)',
  information: 'var(--services--blue)',
  product: 'var(--services--purple)',
  service: 'var(--services--orange)',
};

function ServiceDot({ color }: { color: string }) {
  return (
    <span
      aria-hidden="true"
      style={{
        display: 'inline-block',
        width: 10,
        height: 10,
        borderRadius: '50%',
        backgroundColor: color,
        flexShrink: 0,
      }}
    />
  );
}

function ContactItem({ icon, children, href }: { icon: string; children: React.ReactNode; href?: string }) {
  const inner = (
    <>
      <span aria-hidden="true" style={{ opacity: 0.6 }}>{icon}</span>
      <span>{children}</span>
    </>
  );
  const baseStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--gap-sm)',
    fontFamily: 'var(--font-family-body)',
    fontSize: 'var(--body-sm)',
    color: 'inherit',
    textDecoration: 'none',
  };
  if (href) {
    return <a href={href} style={baseStyle}>{inner}</a>;
  }
  return <div style={baseStyle}>{inner}</div>;
}

/**
 * Footer — renders the BDS marketing-site Footer for brikdesigns.com.
 *
 * Slot mapping:
 *   aboveTop     → newsletter signup section
 *   logo         → Brik logo
 *   tagline      → agency line
 *   brandExtra   → contact block (phone / email / contact link)
 *   columns      → Follow Us / About / Customers / Services (with category dots)
 *   copyright    → © year Brik Designs
 *   bottomLinks  → Terms / Privacy policy
 *   socialLinks  → "Made with ❤️ in Palm Beach, FL" (right-aligned bottom-bar slot)
 *   variant      → 'inverse' (dark surface, AA-passing per brik-bds#463)
 *
 * Two known minor regressions vs the prior bespoke footer, tracked in BDS:
 *   1. Social column links lose target=_blank — brik-bds#461
 *   2. Internal links lose Next.js client-side navigation + prefetching — brik-bds#462
 */
export function Footer() {
  return (
    <BdsFooter
      aboveTop={
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 'var(--gap-md)',
            textAlign: 'center',
            padding: 'var(--padding-md) 0',
          }}
        >
          <h3
            style={{
              fontFamily: 'var(--font-family-heading)',
              fontSize: 'var(--heading-md)',
              fontWeight: 'var(--font-weight-bold)' as unknown as number,
              margin: 0,
            }}
          >
            Join Brik by Brik Newsletter
          </h3>
          <p
            style={{
              fontFamily: 'var(--font-family-body)',
              fontSize: 'var(--body-sm)',
              margin: 0,
              opacity: 0.8,
            }}
          >
            Enter your name, email, and subscribe for free right now.
          </p>
          <div style={{ width: '100%', maxWidth: 400 }}>
            <NewsletterForm />
          </div>
        </div>
      }
      logo={
        <Image
          src="/images/Brik-logo.svg"
          alt="Brik Designs logo"
          width={100}
          height={40}
          className="site-logo"
        />
      }
      tagline="We're a digital marketing and design agency."
      brandExtra={
        <>
          <ContactItem icon="☎">Office: (561) 490-8714</ContactItem>
          <ContactItem icon="✉" href="mailto:hello@brikdesigns.com">
            hello@brikdesigns.com
          </ContactItem>
          <ContactItem icon="✉" href="/contact">
            Send us a message
          </ContactItem>
        </>
      }
      columns={[
        { heading: 'Follow Us Online', links: socialLinks },
        { heading: 'About', links: aboutLinks },
        { heading: 'Customers', links: customerLinks },
        {
          heading: 'Services',
          links: serviceLines.map((line) => ({
            label: line.label,
            href: line.href,
            adornment: <ServiceDot color={SERVICE_DOT_VAR[line.category]} />,
          })),
        },
      ]}
      copyright={`© ${new Date().getFullYear()} Brik Designs. All rights reserved.`}
      bottomLinks={[
        { label: 'Terms', href: '/terms' },
        { label: 'Privacy policy', href: '/privacy-policy' },
      ]}
      socialLinks={<span>Made with ❤️ in Palm Beach, FL</span>}
      variant="inverse"
    />
  );
}
