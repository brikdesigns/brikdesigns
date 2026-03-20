import type { Metadata } from 'next';
import { ContactForm } from '@/components/marketing/ContactForm';
import '../shared-sections.css';

export const metadata: Metadata = {
  title: 'Contact Brik Designs | Start Your Project or Ask a Question',
  description: 'Let\'s build something together. Reach out to Brik Designs for a quote, consultation, or to learn how we can support your business — brik by brik.',
};

export default function ContactPage() {
  return (
    <>
      {/* Header + Quick CTAs — Webflow: .section_contact .inner-container-contact */}
      <section className="page-hero">
        <div className="page-hero__container">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--gap-lg)' }}>
            <h1 className="page-hero__title">Get in touch</h1>
            {/* Webflow: 3 icon CTA buttons (Book a Call, Email, Phone) */}
            <div style={{ display: 'flex', gap: 'var(--gap-sm)', flexWrap: 'wrap' }}>
              <a
                href="https://calendly.com/brikdesigns"
                target="_blank"
                rel="noopener noreferrer"
                className="btn-primary"
                style={{ gap: 'var(--gap-sm)' }}
              >
                <span>📅</span> Book a Call
              </a>
              <a href="mailto:hello@brikdesigns.com" className="btn-primary" style={{ gap: 'var(--gap-sm)' }}>
                <span>✉️</span> Send Email
              </a>
              <a href="tel:+15614908714" className="btn-primary" style={{ gap: 'var(--gap-sm)' }}>
                <span>📞</span> Click to Call
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Contact Form — Webflow: .form-contact.bottom */}
      <section className="content-section" style={{ padding: 'var(--padding-huge) 0' }}>
        <div className="content-section__container" style={{ maxWidth: 800 }}>
          <h2 style={{ fontFamily: 'var(--font-family-heading)', fontSize: 'var(--heading-md)', color: 'var(--text-primary)', margin: '0 0 var(--gap-xs)' }}>
            Send us a message
          </h2>
          <p style={{ fontFamily: 'var(--font-family-body)', fontSize: 'var(--body-sm)', color: 'var(--text-secondary)', margin: '0 0 var(--gap-xl)' }}>
            Let us know what you&apos;re interested in
          </p>
          <ContactForm />
        </div>
      </section>
    </>
  );
}
