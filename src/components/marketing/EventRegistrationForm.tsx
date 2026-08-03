'use client';

import { useState } from 'react';
import { Button, Select, TextInput } from '@brikdesigns/bds';
import {
  BOOLEAN_ANSWER_NO,
  BOOLEAN_ANSWER_YES,
  isCustomFieldVisible,
  toCustomAnswers,
  type CustomField,
} from '@/lib/events';
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
/**
 * One author-defined question. The control follows the question's declared
 * type; `required` is only enforced while the field is visible, so a
 * required follow-up on the branch the registrant didn't take never blocks
 * submission (it isn't in the DOM to be validated).
 */
function CustomFieldInput({
  field,
  value,
  onChange,
}: {
  field: CustomField;
  value: string;
  onChange: (value: string) => void;
}) {
  if (field.type === 'boolean') {
    return (
      <Select
        label={field.label}
        required={field.required}
        placeholder="Select one"
        options={[
          { label: 'Yes', value: BOOLEAN_ANSWER_YES },
          { label: 'No', value: BOOLEAN_ANSWER_NO },
        ]}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }

  if (field.type === 'select') {
    return (
      <Select
        label={field.label}
        required={field.required}
        placeholder="Select one"
        options={(field.options ?? []).map((o) => ({ label: o, value: o }))}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }

  return (
    <TextInput
      label={field.label}
      type={field.type === 'number' ? 'number' : 'text'}
      required={field.required}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

export interface EventRegistrationFormProps {
  eventId: string;
  variant?: 'event' | 'newsletter';
  /** Lead source written to the contact + event_registrations row. */
  source?: string;
  /** Label override for the practice/company field (events.form_config). */
  companyLabel?: string;
  submitLabel?: string;
  /**
   * Author-defined questions from `events.form_config.fields` (#2558),
   * rendered after the built-in fields. Empty for events that define none —
   * the form is then byte-for-byte what it was before.
   */
  customFields?: CustomField[];
  /**
   * Field layout. `2` lays the fields two-up on wide screens (the showcase
   * registration card); the default `1` is the single-column stack used
   * everywhere else — byte-for-byte unchanged when omitted.
   */
  columns?: 1 | 2;
}

export function EventRegistrationForm({
  eventId,
  variant = 'event',
  source = 'event_signup',
  companyLabel = 'Practice / Company (optional)',
  submitLabel = 'Register',
  customFields = [],
  columns = 1,
}: EventRegistrationFormProps) {
  const isGrid = columns === 2;
  const isNewsletter = variant === 'newsletter';
  const { isSubmitting, isSuccess, isError, error, submit } = useFormSubmit({
    endpoint: '/api/leads',
  });

  // Custom answers are controlled (the built-ins stay on FormData): a
  // conditional follow-up has to appear the moment its dependency changes,
  // which needs the answer in React state, not just in the DOM.
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const setAnswer = (key: string, value: string) =>
    setAnswers((prev) => ({ ...prev, [key]: value }));
  const visibleCustomFields = customFields.filter((f) =>
    isCustomFieldVisible(f, answers, customFields),
  );

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
      custom_answers: toCustomAnswers(customFields, answers),
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
      className={isGrid ? 'lp-form-grid' : undefined}
      style={isGrid ? undefined : { display: 'flex', flexDirection: 'column', gap: gap.lg }}
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

      {visibleCustomFields.map((field) => (
        <CustomFieldInput
          key={field.key}
          field={field}
          value={answers[field.key] ?? ''}
          onChange={(value) => setAnswer(field.key, value)}
        />
      ))}

      {/* Error + submit span the full width in grid mode; in stack mode they
          render as plain siblings (unchanged). */}
      {isGrid ? (
        <div
          className="lp-form-grid__full"
          style={{ display: 'flex', flexDirection: 'column', gap: gap.lg }}
        >
          {isError && <FormError message={error} />}
          <Button type="submit" variant="primary" size="lg" fullWidth loading={isSubmitting}>
            {isSubmitting ? 'Submitting…' : submitLabel}
          </Button>
        </div>
      ) : (
        <>
          {isError && <FormError message={error} />}
          <Button type="submit" variant="primary" size="lg" fullWidth loading={isSubmitting}>
            {isSubmitting ? 'Submitting…' : submitLabel}
          </Button>
        </>
      )}
    </form>
  );
}
