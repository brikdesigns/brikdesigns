'use client';

import { useState } from 'react';
import { Button, TextInput, TextArea } from '@brikdesigns/bds';
import { useFormSubmit } from '@/lib/hooks/useFormSubmit';
import { FormError } from '@/components/marketing/forms/FormError';
import { FormSuccessCard } from '@/components/marketing/forms/FormSuccessCard';
import { ServiceMultiSelect, type ServiceOption } from '@/components/marketing/ServiceMultiSelect';

export function ContactForm({ serviceOptions = [] }: { serviceOptions?: ServiceOption[] }) {
  // Services the visitor is interested in. The contact form carries services
  // (not offerings) — there's no offering/tier context from this entry point.
  const [selectedServices, setSelectedServices] = useState<string[]>([]);

  const { isSubmitting, isSuccess, isError, error, submit } = useFormSubmit({
    endpoint: '/api/leads',
  });

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    await submit({
      name: form.get('name'),
      email: form.get('email'),
      company_name: form.get('company_name') || 'Not provided',
      services: selectedServices,
      message: form.get('message') || '',
      source: 'contact',
      // Honeypot — bots fill every field, real users don't see this one.
      website_url: form.get('website_url') || '',
    });
  }

  if (isSuccess) {
    return (
      <FormSuccessCard
        title="Message sent!"
        body="We'll get back to you within 1 business day."
      />
    );
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap-lg)' }}>
      {/* Honeypot — invisible to real users, fills bots in. Server drops requests where this is non-empty. */}
      <input
        type="text"
        name="website_url"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        style={{ position: 'absolute', width: '1px', height: '1px', padding: 0, margin: '-1px', overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap', border: 0 }}
      />
      <TextInput label="Your name" name="name" required placeholder="Jane Smith" />
      <TextInput label="Email" name="email" type="email" required placeholder="jane@example.com" />
      <TextInput label="Company (optional)" name="company_name" placeholder="Acme Design Co." />
      {serviceOptions.length > 0 && (
        <ServiceMultiSelect
          options={serviceOptions}
          value={selectedServices}
          onChange={setSelectedServices}
        />
      )}
      <TextArea
        label="How can we help?"
        name="message"
        required
        placeholder="Tell us about your project, question, or idea."
        rows={5}
      />

      {isError && <FormError message={error} />}

      <Button type="submit" variant="primary" size="lg" fullWidth loading={isSubmitting}>
        {isSubmitting ? 'Sending...' : 'Send Message'}
      </Button>
    </form>
  );
}
