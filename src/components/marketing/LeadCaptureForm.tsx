'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button } from '@bds/components/ui/Button/Button';
import { TextInput } from '@bds/components/ui/TextInput/TextInput';
import { TextArea } from '@bds/components/ui/TextArea/TextArea';

export function LeadCaptureForm({ source = 'get_started' }: { source?: string }) {
  const searchParams = useSearchParams();
  const plan = searchParams.get('plan') || '';
  const service = searchParams.get('service') || '';

  const [formState, setFormState] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormState('submitting');

    const form = new FormData(e.currentTarget);
    const body = {
      name: form.get('name'),
      email: form.get('email'),
      company_name: form.get('company_name'),
      phone: form.get('phone') || '',
      plan: plan || form.get('plan') || '',
      service: service || '',
      message: form.get('message') || '',
      source,
    };

    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Something went wrong.');
      }

      setFormState('success');
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Something went wrong.');
      setFormState('error');
    }
  }

  if (formState === 'success') {
    return (
      <div
        style={{
          padding: 'var(--padding-xl)',
          backgroundColor: 'var(--surface-success)',
          borderRadius: 'var(--border-radius-lg)',
          textAlign: 'center',
        }}
      >
        <h2 style={{ fontFamily: 'var(--font-family-heading)', fontSize: 'var(--heading-md)', color: 'var(--text-success)' }}>
          Thanks! We&apos;ll be in touch.
        </h2>
        <p style={{ fontFamily: 'var(--font-family-body)', fontSize: 'var(--body-md)', color: 'var(--text-secondary)', marginTop: 'var(--gap-sm)' }}>
          We typically respond within 1 business day.
        </p>
      </div>
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
            {plan.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
          </span>
          <input type="hidden" name="plan" value={plan} />
        </div>
      )}

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

      {formState === 'error' && (
        <p style={{ fontFamily: 'var(--font-family-body)', fontSize: 'var(--body-sm)', color: 'var(--text-negative)' }}>
          {errorMessage}
        </p>
      )}

      <Button
        type="submit"
        variant="primary"
        size="lg"
        fullWidth
        loading={formState === 'submitting'}
      >
        {formState === 'submitting' ? 'Sending...' : 'Submit'}
      </Button>
    </form>
  );
}
