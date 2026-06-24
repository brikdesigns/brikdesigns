import type { Metadata } from 'next';
import { Button } from '@brikdesigns/bds';
import { BookACallButton } from '@/components/marketing/BookACallButton';
import { ContactForm } from '@/components/marketing/ContactForm';
import type { ServiceOption } from '@/components/marketing/ServiceMultiSelect';
import { getServiceCategories, getServices, resolveServiceTagCategory } from '@/lib/supabase/queries';
import { text, heading } from '@/lib/styles';
import { color } from '@/lib/tokens';
import '../shared-sections.css';
import './contact.css';

export const metadata: Metadata = {
  title: 'Contact Brik Designs | Start Your Project or Ask a Question',
  description: 'Let\'s build something together. Reach out to Brik Designs for a quote, consultation, or to learn how we can support your business — brik by brik.',
};

export default async function ContactPage() {
  // Build the service-picker options, clustered by service line so the flat
  // MultiSelect groups lines together and each chip is line-colored (mirrors
  // the get-started page / nav modal).
  const [serviceLines, services] = await Promise.all([
    getServiceCategories(),
    getServices(),
  ]);
  const lineRank = new Map<string, number>(
    serviceLines.map((line) => [line.id, line.rank ?? 0]),
  );
  const serviceOptions: ServiceOption[] = [...services]
    .sort(
      (a, b) =>
        (lineRank.get(a.service_line_id) ?? 99) -
          (lineRank.get(b.service_line_id) ?? 99) ||
        (a.rank ?? 0) - (b.rank ?? 0),
    )
    .map((service) => ({
      value: service.slug,
      label: service.name,
      category: resolveServiceTagCategory({
        slug: service.service_lines?.slug ?? service.slug,
      }),
    }));

  return (
    <section className="contact-section">
      <div className="contact-card">
        <div className="contact-hero-row">
          <h1 className="page-hero__title">Get in Touch</h1>
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
          <h2 style={heading.md}>Send Us a Message</h2>
          <p style={{ ...text.bodySm, color: color.text.secondary, margin: 0 }}>Let us know what you&apos;re interested in</p>
          <ContactForm serviceOptions={serviceOptions} />
        </div>
      </div>
    </section>
  );
}
