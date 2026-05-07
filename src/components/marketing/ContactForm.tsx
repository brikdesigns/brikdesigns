'use client';

import { useState } from 'react';
import { Button } from '@brikdesigns/bds';
import { TextInput } from '@brikdesigns/bds';
import { TextArea } from '@brikdesigns/bds';

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
      // Honeypot — bots fill every field, real users don't see this one.
      website_url: form.get('website_url') || '',
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
