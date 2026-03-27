import type { Metadata } from 'next';
import { LinkButton } from '@bds/components/ui/Button/LinkButton';
import { ContactForm } from '@/components/marketing/ContactForm';
import '../shared-sections.css';
import './contact.css';

export const metadata: Metadata = {
  title: 'Contact Brik Designs | Start Your Project or Ask a Question',
  description: 'Let\'s build something together. Reach out to Brik Designs for a quote, consultation, or to learn how we can support your business — brik by brik.',
};

export default function ContactPage() {
  return (
    <>
      {/* Header + Quick CTAs */}
      <section className="page-hero">
        <div className="page-hero__container">
          <div className="contact-hero-row">
            <h1 className="page-hero__title">Get in touch</h1>
            <div className="button-wrapper">
              <LinkButton href="https://calendly.com/brikdesigns" variant="primary" size="md" target="_blank" rel="noopener noreferrer">
                Book a Call
              </LinkButton>
              <LinkButton href="mailto:hello@brikdesigns.com" variant="primary" size="md">
                Send Email
              </LinkButton>
              <LinkButton href="tel:+15614908714" variant="primary" size="md">
                Click to Call
              </LinkButton>
            </div>
          </div>
        </div>
      </section>

      {/* Contact Form */}
      <section className="content-section contact-form-section">
        <div className="container-lg contact-form-container">
          <h2 className="text-heading-md">Send us a message</h2>
          <p className="text-body-sm text--secondary">Let us know what you&apos;re interested in</p>
          <ContactForm />
        </div>
      </section>
    </>
  );
}
