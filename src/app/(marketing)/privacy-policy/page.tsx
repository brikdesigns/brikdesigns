import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description:
    'How Brik Designs collects, uses, and protects information about visitors to brikdesigns.com.',
};

const LAST_UPDATED = '2026-05-07';

export default function PrivacyPolicyPage() {
  return (
    <article
      style={{
        maxWidth: '720px',
        margin: '0 auto',
        padding: 'var(--padding-xl) var(--padding-lg)',
        fontFamily: 'var(--font-family-body)',
        color: 'var(--text-primary)',
        lineHeight: 1.6,
      }}
    >
      <h1
        style={{
          fontFamily: 'var(--font-family-heading)',
          fontSize: 'var(--heading-xl)',
          margin: 0,
          lineHeight: 1.15,
        }}
      >
        Privacy Policy
      </h1>
      <p
        style={{
          fontFamily: 'var(--font-family-label)',
          fontSize: 'var(--body-sm)',
          color: 'var(--text-secondary)',
          marginTop: 'var(--gap-sm)',
        }}
      >
        Last updated: {LAST_UPDATED}
      </p>

      <Section title="The Short Version">
        <p>
          We collect what you give us — and only what we need to do good work. We
          don&apos;t sell anything to anyone. We don&apos;t use third-party
          advertising trackers. If you ever want a copy of what we have or want
          us to delete it, email us and we&apos;ll handle it within 30 days.
        </p>
      </Section>

      <Section title="What We Collect">
        <p>When you fill out a form on brikdesigns.com (Contact, Get Started, Free Marketing Analysis), we collect:</p>
        <ul style={listStyle}>
          <li>Your name</li>
          <li>Your email</li>
          <li>Your company name</li>
          <li>Your phone number, if you provide one</li>
          <li>Whatever you write in the message field</li>
          <li>Which page or service you came from</li>
        </ul>
        <p>
          When you simply browse the site, our error-monitoring service (Sentry) may
          capture technical information about errors that happen in your browser —
          for example, the page URL, browser version, and a stack trace of the
          error. This is used only to fix bugs.
        </p>
        <p>
          We don&apos;t use Google Analytics, advertising trackers, or fingerprinting.
          The site sets a small number of functional cookies tied to authenticated
          admin sessions, but none for marketing visitors.
        </p>
      </Section>

      <Section title="What We Do With It">
        <p>Form submissions go to two places:</p>
        <ul style={listStyle}>
          <li>
            Our customer database (Supabase), where they become a record so we can
            follow up.
          </li>
          <li>
            Our team&apos;s email and Slack, so someone responds quickly.
          </li>
        </ul>
        <p>
          We never sell or rent your information. We never share it with third
          parties for their own marketing. We keep it only as long as we need it
          to do work for you (or, for prospects who didn&apos;t become clients,
          for up to 24 months in case you come back).
        </p>
      </Section>

      <Section title="Who Else Sees It">
        <p>The services that process your information on our behalf:</p>
        <ul style={listStyle}>
          <li>
            <strong>Supabase</strong> — hosts our customer database.
          </li>
          <li>
            <strong>Resend</strong> — sends transactional email (lead notifications, replies).
          </li>
          <li>
            <strong>Sentry</strong> — captures application errors so we can fix them.
          </li>
          <li>
            <strong>Netlify</strong> — hosts and serves the website.
          </li>
        </ul>
        <p>
          Each of these has its own privacy policy and is contractually limited to
          processing data on our behalf. They don&apos;t use it for their own
          purposes.
        </p>
      </Section>

      <Section title="Your Rights">
        <p>You can ask us to:</p>
        <ul style={listStyle}>
          <li>Send you a copy of the information we have about you.</li>
          <li>Correct anything that&apos;s wrong.</li>
          <li>Delete your information entirely.</li>
          <li>Stop sending you marketing emails (unsubscribe is in every email).</li>
        </ul>
        <p>
          Email <a href="mailto:hello@brikdesigns.com" style={linkStyle}>hello@brikdesigns.com</a> with what
          you need. We&apos;ll respond within 30 days.
        </p>
      </Section>

      <Section title="Children">
        <p>
          Brikdesigns.com is for businesses. We don&apos;t knowingly collect
          information from anyone under 16. If you&apos;re a parent and believe
          your child has submitted information, email us and we&apos;ll delete it.
        </p>
      </Section>

      <Section title="Changes">
        <p>
          We&apos;ll update this page when we change anything substantive. The
          &ldquo;last updated&rdquo; date at the top reflects the latest revision.
          For material changes, we&apos;ll post a banner on the homepage for at
          least 30 days.
        </p>
      </Section>

      <Section title="Contact">
        <p>
          Questions about this policy or your data — email{' '}
          <a href="mailto:hello@brikdesigns.com" style={linkStyle}>hello@brikdesigns.com</a>.
        </p>
      </Section>

      <p
        style={{
          marginTop: 'var(--gap-huge)',
          paddingTop: 'var(--padding-md)',
          borderTop: 'var(--border-width-md) solid var(--border-primary)',
          fontFamily: 'var(--font-family-label)',
          fontSize: 'var(--body-sm)',
          color: 'var(--text-secondary)',
        }}
      >
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

const listStyle: React.CSSProperties = {
  paddingLeft: 'var(--padding-lg)',
  margin: 'var(--gap-md) 0',
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--gap-xs)',
};

const linkStyle: React.CSSProperties = {
  color: 'var(--text-link)',
  textDecoration: 'underline',
};
