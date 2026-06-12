import Image from 'next/image';
import { Icon } from '@iconify/react';
import { Footer as BdsFooter, ServiceTag } from '@brikdesigns/bds';
import type { ServiceLine } from '@brikdesigns/bds';
import { color } from '@/lib/tokens';
import { heading, text } from '@/lib/styles';
import { NewsletterForm } from './NewsletterForm';
import './footer.css';

const aboutLinks: { label: string; href: string; icon: string }[] = [
  { label: 'Who We Are', href: '/about', icon: 'ph:users-three' },
  { label: 'What We Do', href: '/services', icon: 'ph:briefcase' },
  { label: 'Support Plans', href: '/plans', icon: 'ph:lifebuoy' },
  { label: 'Blog', href: '/blog', icon: 'ph:notebook' },
  { label: 'Customer Stories', href: '/customer-stories', icon: 'ph:star' },
];

const customerLinks: { label: string; href: string; icon: string }[] = [
  { label: 'Who We Support', href: '/customers', icon: 'ph:users' },
  { label: 'Dental', href: '/customers/dental', icon: 'ph:tooth' },
  { label: 'Real Estate', href: '/customers/real-estate', icon: 'ph:house' },
  { label: 'Small Business', href: '/customers/small-business', icon: 'ph:storefront' },
];

// Hrefs use the canonical `/services/{route-slug}` segments: brand / marketing
// / information / product / back-office. The back-office route slug differs
// from its FK-stable DB slug `service` (see service-line-routes.ts). The
// long-form Webflow slugs (brand-design, marketing-design, …) DO NOT resolve
// under the Next.js dynamic route `/services/[serviceLineSlug]` — see #113.
const serviceLines: { label: string; href: string; category: ServiceLine }[] = [
  { label: 'Brand Design', href: '/services/brand', category: 'brand' },
  { label: 'Information Design', href: '/services/information', category: 'information' },
  { label: 'Marketing Design', href: '/services/marketing', category: 'marketing' },
  { label: 'Product Design', href: '/services/product', category: 'product' },
  { label: 'Back Office Design', href: '/services/back-office', category: 'back-office' },
];

const socialLinks: { label: string; href: string; icon: string }[] = [
  { label: 'LinkedIn', href: 'https://www.linkedin.com/company/designsbybrik/', icon: 'ph:linkedin-logo' },
  { label: 'Facebook', href: 'https://www.facebook.com/designsbybrik', icon: 'ph:facebook-logo' },
  { label: 'Instagram', href: 'https://www.instagram.com/designsbybrik/', icon: 'ph:instagram-logo' },
];

// 16×16 follows the `footer_link` icon convention used by BDS Footer column
// links + contact rows. One component so column adornments and contact
// adornments share size, flex-shrink, and aria-hidden behavior.
function FooterIcon({ name }: { name: string }) {
  return (
    <Icon
      icon={name}
      aria-hidden="true"
      style={{ flexShrink: 0 }}
      width={16}
      height={16}
    />
  );
}

function ContactItem({ icon, children, href }: { icon: string; children: React.ReactNode; href?: string }) {
  const inner = (
    <>
      <FooterIcon name={icon} />
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
  return <p style={{ ...baseStyle, margin: 0 }}>{inner}</p>;
}

/**
 * Footer — renders the BDS marketing-site Footer for brikdesigns.com.
 *
 * Slot mapping:
 *   aboveTop     → newsletter signup section
 *   logo         → Brik logo
 *   tagline      → agency line
 *   brandExtra   → contact block (phone / email / contact link)
 *   columns      → Follow Us / About / Customers / Services
 *   copyright    → © year Brik Designs
 *   bottomLinks  → Terms / Privacy policy
 *   socialLinks  → "Made with ❤️ in Iowa" (right-aligned bottom-bar slot)
 *   variant      → 'inverse' (dark surface, AA-passing per brik-bds#463)
 *   className    → 'footer-site-width' constrains content to 90% → 1280px
 *                  (same as .mega-nav__container) while keeping full-width bg
 *
 * Two known minor regressions vs the prior bespoke footer, tracked in BDS:
 *   1. Social column links lose target=_blank — brik-bds#461
 *   2. Internal links lose Next.js client-side navigation + prefetching — brik-bds#462
 */
export function Footer() {
  return (
    <BdsFooter
      className="footer-site-width"
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
              // on-color-dark stays grayscale-white in both light and dark modes,
              // ensuring legibility on the fixed-dark inverse footer surface.
              ...heading.md,
              color: color.text.onColorDark,
            }}
          >
            Join Brik by Brik Newsletter
          </h3>
          <p
            style={{
              ...text.bodySm,
              color: color.text.onColorDark,
              opacity: 0.8,
            }}
          >
            Enter your name, email, and subscribe for free right now.
          </p>
          <div style={{ width: '100%', maxWidth: 520 }}>
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
          <ContactItem icon="ph:phone">Office: (561) 490-8714</ContactItem>
          <ContactItem icon="ph:envelope" href="mailto:hello@brikdesigns.com">
            hello@brikdesigns.com
          </ContactItem>
          <ContactItem icon="ph:paper-plane-tilt" href="/contact">
            Send us a message
          </ContactItem>
        </>
      }
      columns={[
        {
          heading: 'Follow us online',
          links: socialLinks.map((link) => ({
            label: link.label,
            href: link.href,
            adornment: <FooterIcon name={link.icon} />,
          })),
        },
        {
          heading: 'About',
          links: aboutLinks.map((link) => ({
            label: link.label,
            href: link.href,
            adornment: <FooterIcon name={link.icon} />,
          })),
        },
        {
          heading: 'Customers',
          links: customerLinks.map((link) => ({
            label: link.label,
            href: link.href,
            adornment: <FooterIcon name={link.icon} />,
          })),
        },
        {
          heading: 'Services',
          links: serviceLines.map((line) => ({
            label: line.label,
            href: line.href,
            adornment: (
              <ServiceTag
                category={line.category}
                variant="icon"
                size="sm"
                aria-hidden="true"
              />
            ),
          })),
        },
      ]}
      copyright={`© ${new Date().getFullYear()} Brik Designs. All rights reserved.`}
      bottomLinks={[
        { label: 'Terms', href: '/terms' },
        { label: 'Privacy policy', href: '/privacy-policy' },
      ]}
      socialLinks={<span>Made with ❤️ in Iowa</span>}
      variant="inverse"
    />
  );
}
