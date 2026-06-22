'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button, TextInput, TextArea } from '@brikdesigns/bds';
import { useFormSubmit } from '@/lib/hooks/useFormSubmit';
import { FormError } from '@/components/marketing/forms/FormError';
import { FormSuccessCard } from '@/components/marketing/forms/FormSuccessCard';
import { ServiceMultiSelect, type ServiceOption } from '@/components/marketing/ServiceMultiSelect';

export function LeadCaptureForm({
  source = 'get_started',
  plan: planProp,
  planName = '',
  serviceOptions = [],
  defaultServices,
}: { source?: string; plan?: string; planName?: string; serviceOptions?: ServiceOption[]; defaultServices?: string[] }) {
  const searchParams = useSearchParams();
  // In the modal there is no `?plan=` in the URL — take the slug as a prop and
  // fall back to the query param for the standalone /get-started route. #401.
  const plan = planProp ?? searchParams.get('plan') ?? '';
  const service = searchParams.get('service') || '';
  // Multi-select service picker. Preselect comes from the service-page modal
  // (`defaultServices`) or the standalone /get-started?service= param (#577).
  // #578 persists the array server-side; it's submitted as `services`.
  const [selectedServices, setSelectedServices] = useState<string[]>(
    defaultServices ?? (service ? [service] : []),
  );

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
      services: selectedServices,
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
      {serviceOptions.length > 0 && (
        <ServiceMultiSelect
          options={serviceOptions}
          value={selectedServices}
          onChange={setSelectedServices}
        />
      )}
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
