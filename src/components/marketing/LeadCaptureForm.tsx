'use client';

import { useSearchParams } from 'next/navigation';
import { Button, TextInput, TextArea } from '@brikdesigns/bds';
import { useFormSubmit } from '@/lib/hooks/useFormSubmit';
import { FormError } from '@/components/marketing/forms/FormError';
import { FormSuccessCard } from '@/components/marketing/forms/FormSuccessCard';

export function LeadCaptureForm({
  source = 'get_started',
  planName = '',
}: { source?: string; planName?: string }) {
  const searchParams = useSearchParams();
  const plan = searchParams.get('plan') || '';
  const service = searchParams.get('service') || '';

  const { isSubmitting, isSuccess, isError, error, submit } = useFormSubmit({
    endpoint: '/api/leads',
  });

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    await submit({
      name: form.get('name'),
      email: form.get('email'),
      company_name: form.get('company_name'),
      phone: form.get('phone') || '',
      plan: plan || form.get('plan') || '',
      service: service || '',
      message: form.get('message') || '',
      source,
      // Honeypot — bots fill every field, real users don't see this one.
      website_url: form.get('website_url') || '',
    });
  }

  if (isSuccess) {
    return (
      <FormSuccessCard
        title="Thanks! We'll be in touch."
        body="We typically respond within 1 business day."
      />
    );
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap-lg)' }}>
      {plan && (
        <div
          style={{
            padding: 'var(--padding-md)',
            backgroundColor: 'var(--surface-secondary)',
            borderRadius: 'var(--border-radius-md)',
          }}
        >
          <span style={{ fontFamily: 'var(--font-family-label)', fontSize: 'var(--label-sm)', color: 'var(--text-secondary)' }}>
            Selected plan:
          </span>
          <span style={{ fontFamily: 'var(--font-family-label)', fontSize: 'var(--label-md)', color: 'var(--text-primary)', marginLeft: 'var(--gap-xs)' }}>
            {/* Prefer the resolved CMS name (passed from the get-started page);
                fall back to humanizing the slug only when the name is unknown. */}
            {planName || plan.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
          </span>
          <input type="hidden" name="plan" value={plan} />
        </div>
      )}

      {/* Honeypot — invisible to real users, fills bots in. */}
      <input
        type="text"
        name="website_url"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        style={{ position: 'absolute', width: '1px', height: '1px', padding: 0, margin: '-1px', overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap', border: 0 }}
      />
      <TextInput
        label="Your name"
        name="name"
        required
        placeholder="Jane Smith"
      />
      <TextInput
        label="Email"
        name="email"
        type="email"
        required
        placeholder="jane@example.com"
      />
      <TextInput
        label="Company name"
        name="company_name"
        required
        placeholder="Acme Design Co."
      />
      <TextInput
        label="Phone (optional)"
        name="phone"
        type="tel"
        placeholder="(555) 123-4567"
      />
      <TextArea
        label="Tell us about your project (optional)"
        name="message"
        placeholder="What are you looking to accomplish?"
        rows={4}
      />

      {isError && <FormError message={error} />}

      <Button
        type="submit"
        variant="primary"
        size="lg"
        fullWidth
        loading={isSubmitting}
      >
        {isSubmitting ? 'Sending...' : 'Submit'}
      </Button>
    </form>
  );
}
