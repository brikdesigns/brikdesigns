'use client';

import { Button, TextInput } from '@brikdesigns/bds';
import { useFormSubmit } from '@/lib/hooks/useFormSubmit';
import { FormError } from '@/components/marketing/forms/FormError';
import { FormSuccessCard } from '@/components/marketing/forms/FormSuccessCard';
import { gap } from '@/lib/tokens';

/**
 * Public registration / signup form for the event + newsletter landing pages
 * (brikdesigns#335 / #336). Posts to the shared `/api/leads` endpoint with the
 * event UUID, which records an `event_registrations` row and routes the Slack
 * notification (brikdesigns#334). The `event` variant collects a full contact;
 * `newsletter` is the lighter email-capture variant.
 *
 * `/api/leads` takes a single `name`, so first + last are joined before submit.
 */
export interface EventRegistrationFormProps {
  eventId: string;
  variant?: 'event' | 'newsletter';
  /** Lead source written to the contact + event_registrations row. */
  source?: string;
  /** Label override for the practice/company field (events.form_config). */
  companyLabel?: string;
  submitLabel?: string;
}

export function EventRegistrationForm({
  eventId,
  variant = 'event',
  source = 'event_signup',
  companyLabel = 'Practice / Company (optional)',
  submitLabel = 'Register',
}: EventRegistrationFormProps) {
  const isNewsletter = variant === 'newsletter';
  const { isSubmitting, isSuccess, isError, error, submit } = useFormSubmit({
    endpoint: '/api/leads',
  });

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const first = String(form.get('first_name') || '').trim();
    const last = String(form.get('last_name') || '').trim();
    const name = [first, last].filter(Boolean).join(' ');

    await submit({
      name,
      email: form.get('email'),
      company_name: form.get('company_name') || '',
      phone: form.get('phone') || '',
      source,
      event_id: eventId,
      // Honeypot — bots fill every field, real users never see this one.
      website_url: form.get('website_url') || '',
    });
  }

  if (isSuccess) {
    return (
      <FormSuccessCard
        title="You're registered!"
        body="You'll receive a confirmation email shortly."
      />
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{ display: 'flex', flexDirection: 'column', gap: gap.lg }}
    >
      {/* Honeypot — invisible to real users. */}
      <input
        type="text"
        name="website_url"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        style={{ position: 'absolute', width: '1px', height: '1px', padding: 0, margin: '-1px', overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap', border: 0 }}
      />
      <TextInput
        label={isNewsletter ? 'First name (optional)' : 'First name'}
        name="first_name"
        required={!isNewsletter}
        placeholder="Jane"
      />
      <TextInput
        label={isNewsletter ? 'Last name (optional)' : 'Last name'}
        name="last_name"
        placeholder="Smith"
      />
      <TextInput
        label="Email"
        name="email"
        type="email"
        required
        placeholder="jane@example.com"
      />
      <TextInput
        label="Phone (optional)"
        name="phone"
        type="tel"
        placeholder="(555) 123-4567"
      />
      {!isNewsletter && (
        <TextInput label={companyLabel} name="company_name" placeholder="Acme Dental" />
      )}

      {isError && <FormError message={error} />}

      <Button type="submit" variant="primary" size="lg" fullWidth loading={isSubmitting}>
        {isSubmitting ? 'Submitting…' : submitLabel}
      </Button>
    </form>
  );
}
