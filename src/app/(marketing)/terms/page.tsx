import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Terms and Conditions',
  description:
    'Website terms and conditions for brikdesigns.com — site use, intellectual property, refunds, governing law, and contact.',
};

// No "Last updated" date is shown because the Webflow source page
// (www.brikdesigns.com/toc) doesn't display one. Don't synthesize a date —
// legal "last updated" should reflect when the terms themselves changed, not
// when the page was migrated. Add a real date here next time the content is
// reviewed.

export default function TermsPage() {
  return (
    <article style={containerStyle}>
      <h1 style={h1Style}>Website Terms and Conditions</h1>

      <Section title="1. Website Use">
        <p>
          This site is owned and operated by Brik Designs, LLC. All content is
          provided for general information purposes only. You may not misuse the
          site or its content.
        </p>
      </Section>

      <Section title="2. Intellectual Property">
        <p>
          All content, images, and logos are the property of Brik Designs, LLC
          unless otherwise stated. You may not use them without permission.
        </p>
      </Section>

      <Section title="3. Third-Party Links">
        <p>
          We may link to other websites for your convenience. We are not
          responsible for their content or privacy practices.
        </p>
      </Section>

      <Section title="4. Disclaimer">
        <p>
          Information on this site is not legal, financial, or professional
          advice. Always consult a qualified professional before taking action
          based on our content.
        </p>
      </Section>

      <Section title="5. Limitation of Liability">
        <p>
          We do our best to provide accurate, up-to-date information, but we
          make no warranties and are not liable for any damages resulting from
          use of the site.
        </p>
      </Section>

      <Section title="6. Refund &amp; Cancellation Policy">
        <p>
          We accept refund or return requests for eligible services within 5
          days of purchase. To request a refund, contact us at{' '}
          <a href="mailto:hello@brikdesigns.com" style={linkStyle}>hello@brikdesigns.com</a>{' '}
          with your order number and reason.
        </p>
      </Section>

      <Section title="7. Governing Law">
        <p>
          These terms are governed by the laws of the State of Florida, and any
          disputes shall be resolved in the courts of Palm Beach County, Florida.
        </p>
      </Section>

      <Section title="8. Accessibility">
        <p>
          We&apos;re committed to providing a website that&apos;s accessible to
          all users. If you encounter any issues, please contact us.
        </p>
      </Section>

      <Section title="9. Contact Information">
        <p>
          Questions about these terms? Contact us at:{' '}
          <a href="mailto:hello@brikdesigns.com" style={linkStyle}>hello@brikdesigns.com</a>{' '}
          or <a href="tel:+15614908714" style={linkStyle}>(561) 490-8714</a>.
        </p>
      </Section>

      <p style={metaStyle}>
        See also our{' '}
        <Link href="/privacy-policy" style={linkStyle}>Privacy policy</Link>.
      </p>

      <p style={backLinkStyle}>
        <Link href="/" style={linkStyle}>← Back to brikdesigns.com</Link>
      </p>
    </article>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginTop: 'var(--gap-xl)' }}>
      <h2
        style={{
          fontFamily: 'var(--font-family-heading)',
          fontSize: 'var(--heading-md)',
          margin: '0 0 var(--gap-md)',
        }}
      >
        {title}
      </h2>
      {children}
    </section>
  );
}

const containerStyle: React.CSSProperties = {
  maxWidth: '720px',
  margin: '0 auto',
  padding: 'var(--padding-xl) var(--padding-lg)',
  fontFamily: 'var(--font-family-body)',
  color: 'var(--text-primary)',
  lineHeight: 1.6,
};

const h1Style: React.CSSProperties = {
  fontFamily: 'var(--font-family-heading)',
  fontSize: 'var(--heading-xl)',
  margin: 0,
  lineHeight: 1.15,
};

const metaStyle: React.CSSProperties = {
  marginTop: 'var(--gap-xl)',
  fontFamily: 'var(--font-family-label)',
  fontSize: 'var(--body-sm)',
  color: 'var(--text-secondary)',
};

const backLinkStyle: React.CSSProperties = {
  marginTop: 'var(--gap-huge)',
  paddingTop: 'var(--padding-md)',
  borderTop: 'var(--border-width-md) solid var(--border-primary)',
  fontFamily: 'var(--font-family-label)',
  fontSize: 'var(--body-sm)',
  color: 'var(--text-secondary)',
};

const linkStyle: React.CSSProperties = {
  color: 'var(--text-link)',
  textDecoration: 'underline',
};
