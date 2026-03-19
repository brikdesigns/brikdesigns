import type { Metadata } from 'next';
import { ContactForm } from '@/components/marketing/ContactForm';

export const metadata: Metadata = {
  title: 'Contact',
  description: 'Get in touch with Brik Designs. We\'d love to hear about your project.',
};

export default function ContactPage() {
  return (
    <section style={{ maxWidth: 600, margin: '0 auto', padding: 'var(--padding-xl) var(--padding-lg)' }}>
      <h1 style={{ fontFamily: 'var(--font-family-heading)', fontSize: 'var(--heading-xl)', color: 'var(--text-primary)', margin: 0 }}>
        Get in Touch
      </h1>
      <p style={{ fontFamily: 'var(--font-family-body)', fontSize: 'var(--body-lg)', color: 'var(--text-secondary)', marginTop: 'var(--gap-md)' }}>
        Starting a new project or want to collaborate with us? We&apos;d love to hear from you.
      </p>
      <div style={{ marginTop: 'var(--gap-xl)' }}>
        <ContactForm />
      </div>

      {/* Direct contact info */}
      <div
        style={{
          marginTop: 'var(--gap-xl)',
          padding: 'var(--padding-lg)',
          backgroundColor: 'var(--surface-secondary)',
          borderRadius: 'var(--border-radius-lg)',
        }}
      >
        <h3 style={{ fontFamily: 'var(--font-family-heading)', fontSize: 'var(--heading-sm)', color: 'var(--text-primary)', margin: 0 }}>
          Or reach us directly
        </h3>
        <div style={{ marginTop: 'var(--gap-md)', display: 'flex', flexDirection: 'column', gap: 'var(--gap-sm)' }}>
          <p style={{ fontFamily: 'var(--font-family-body)', fontSize: 'var(--body-md)', color: 'var(--text-secondary)', margin: 0 }}>
            hello@brikdesigns.com
          </p>
        </div>
      </div>
    </section>
  );
}
