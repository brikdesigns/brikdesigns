import type { Metadata } from 'next';
import { Button } from '@brikdesigns/bds';
import { BookACallButton } from '@/components/marketing/BookACallButton';
import { ContactForm } from '@/components/marketing/ContactForm';
import { text, heading } from '@/lib/styles';
import { color } from '@/lib/tokens';
import './contact.css';

export const metadata: Metadata = {
  title: 'Contact Brik Designs | Start Your Project or Ask a Question',
  description: 'Let\'s build something together. Reach out to Brik Designs for a quote, consultation, or to learn how we can support your business — brik by brik.',
};

export default function ContactPage() {
  return (
    <section className="contact-section">
      <div className="contact-card">
        <div className="contact-hero-row">
          <h1 style={heading.lg}>Get in touch</h1>
          <div className="contact-cta-row">
            <BookACallButton />
            <Button href="mailto:hello@brikdesigns.com" variant="secondary" size="md">
              Send Email
            </Button>
            <Button href="tel:+15614908714" variant="secondary" size="md">
              Click to Call
            </Button>
          </div>
        </div>

        <div className="contact-form-block">
          <h2 style={heading.md}>Send us a message</h2>
          <p style={{ ...text.bodySm, color: color.text.secondary, margin: 0 }}>Let us know what you&apos;re interested in</p>
          <ContactForm />
        </div>
      </div>
    </section>
  );
}
