'use client';

import { useState } from 'react';
import { Button } from '@bds/components/ui/Button/Button';
import { TextInput } from '@bds/components/ui/TextInput/TextInput';
import { TextArea } from '@bds/components/ui/TextArea/TextArea';

export function ContactForm() {
  const [formState, setFormState] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormState('submitting');

    const form = new FormData(e.currentTarget);
    const body = {
      name: form.get('name'),
      email: form.get('email'),
      company_name: form.get('company_name') || 'Not provided',
      message: form.get('message') || '',
      source: 'contact',
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
          Message sent!
        </h2>
        <p style={{ fontFamily: 'var(--font-family-body)', fontSize: 'var(--body-md)', color: 'var(--text-secondary)', marginTop: 'var(--gap-sm)' }}>
          We&apos;ll get back to you within 1 business day.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap-lg)' }}>
      <TextInput label="Your name" name="name" required placeholder="Jane Smith" />
      <TextInput label="Email" name="email" type="email" required placeholder="jane@example.com" />
      <TextInput label="Company (optional)" name="company_name" placeholder="Acme Design Co." />
      <TextArea
        label="How can we help?"
        name="message"
        required
        placeholder="Tell us about your project, question, or idea."
        rows={5}
      />

      {formState === 'error' && (
        <p style={{ fontFamily: 'var(--font-family-body)', fontSize: 'var(--body-sm)', color: 'var(--text-negative)' }}>
          {errorMessage}
        </p>
      )}

      <Button type="submit" variant="primary" size="lg" fullWidth loading={formState === 'submitting'}>
        {formState === 'submitting' ? 'Sending...' : 'Send Message'}
      </Button>
    </form>
  );
}
