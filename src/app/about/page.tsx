import type { Metadata } from 'next';
import Link from 'next/link';
import { HeroButtons } from '@/components/marketing/HeroButtons';

export const metadata: Metadata = {
  title: 'About Brik Designs | Your Marketing & Design Partner',
  description: 'Meet the team behind Brik Designs. We help businesses thrive through practical design, streamlined systems, and strategic creative support — brik by brik.',
};

export default function AboutPage() {
  return (
    <>
      {/* Hero */}
      <section style={{ maxWidth: 800, margin: '0 auto', padding: 'var(--padding-xl) var(--padding-lg)' }}>
        <h1 style={{ fontFamily: 'var(--font-family-heading)', fontSize: 'var(--heading-xl)', color: 'var(--text-primary)', margin: 0 }}>
          Who We Are
        </h1>
        <p style={{ fontFamily: 'var(--font-family-body)', fontSize: 'var(--body-lg)', color: 'var(--text-secondary)', marginTop: 'var(--gap-lg)', lineHeight: 1.7 }}>
          Brik Designs is a full-service design and marketing studio built for small businesses.
          We believe great design shouldn&apos;t be out of reach — and that the businesses doing
          the hardest work deserve marketing that actually works.
        </p>
        <p style={{ fontFamily: 'var(--font-family-body)', fontSize: 'var(--body-lg)', color: 'var(--text-secondary)', marginTop: 'var(--gap-md)', lineHeight: 1.7 }}>
          From branding to websites to the behind-the-scenes systems that keep you running,
          we help you build a business that looks good and works better — brik by brik.
        </p>
      </section>

      {/* Approach */}
      <section style={{ backgroundColor: 'var(--surface-secondary)', padding: 'var(--padding-xl) var(--padding-lg)' }}>
        <div style={{ maxWidth: 800, margin: '0 auto' }}>
          <h2 style={{ fontFamily: 'var(--font-family-heading)', fontSize: 'var(--heading-lg)', color: 'var(--text-primary)', margin: 0 }}>
            Our Approach
          </h2>
          <p style={{ fontFamily: 'var(--font-family-body)', fontSize: 'var(--body-md)', color: 'var(--text-secondary)', marginTop: 'var(--gap-md)', lineHeight: 1.7 }}>
            We don&apos;t do hard sells. We don&apos;t do pressure tactics. Here&apos;s what we offer.
            Here&apos;s what it costs. If we&apos;re a fit, amazing. If not, that&apos;s okay too.
          </p>

          <div style={{ marginTop: 'var(--gap-xl)', display: 'flex', flexDirection: 'column', gap: 'var(--gap-lg)' }}>
            {[
              { title: 'Clear is kind', body: 'We believe in transparency — in pricing, in timelines, and in what we can (and can\'t) do for you.' },
              { title: 'Design that builds', body: 'Every project should make your business stronger. We\'re not here to make pretty things — we\'re here to make things that work.' },
              { title: 'Systems, not just surfaces', body: 'Great marketing is more than a logo. It\'s the SOPs, the CRM, the automations, and the workflows that keep everything moving.' },
            ].map((item) => (
              <div key={item.title}>
                <h3 style={{ fontFamily: 'var(--font-family-heading)', fontSize: 'var(--heading-sm)', color: 'var(--text-primary)', margin: 0 }}>
                  {item.title}
                </h3>
                <p style={{ fontFamily: 'var(--font-family-body)', fontSize: 'var(--body-md)', color: 'var(--text-secondary)', marginTop: 'var(--gap-xs)', lineHeight: 1.6 }}>
                  {item.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section style={{ maxWidth: 800, margin: '0 auto', padding: 'var(--padding-xl) var(--padding-lg)', textAlign: 'center' }}>
        <h2 style={{ fontFamily: 'var(--font-family-heading)', fontSize: 'var(--heading-lg)', color: 'var(--text-primary)', margin: 0 }}>
          Ready to build something?
        </h2>
        <p style={{ fontFamily: 'var(--font-family-body)', fontSize: 'var(--body-md)', color: 'var(--text-secondary)', marginTop: 'var(--gap-md)' }}>
          Whether you need a full rebrand or just someone to handle your monthly marketing,
          we&apos;d love to chat.
        </p>
        <HeroButtons />
      </section>
    </>
  );
}
