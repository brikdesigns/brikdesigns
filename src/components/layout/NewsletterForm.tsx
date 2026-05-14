'use client';

import { useState } from 'react';
import { TextInput, Button } from '@brikdesigns/bds';
import { color } from '@/lib/tokens';

export function NewsletterForm() {
  const [firstName, setFirstName] = useState('');
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;

    setStatus('submitting');
    try {
      const res = await fetch('https://app.kit.com/forms/08469c7a1c/subscriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email_address: email, first_name: firstName }),
      });

      if (res.ok || res.status === 200) {
        setStatus('success');
        setFirstName('');
        setEmail('');
      } else {
        setStatus('error');
      }
    } catch {
      setStatus('error');
    }
  }

  if (status === 'success') {
    return (
      <p style={{ fontFamily: 'var(--font-family-body)', fontSize: 'var(--body-sm)', color: color.text.success }}>
        You&apos;re subscribed!
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap-sm)', width: '100%' }}>
      <TextInput
        size="lg"
        fullWidth
        type="text"
        placeholder="First Name"
        value={firstName}
        onChange={(e) => setFirstName(e.target.value)}
        autoComplete="given-name"
      />
      <TextInput
        size="lg"
        fullWidth
        type="email"
        placeholder="Email Address"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
        autoComplete="email"
      />
      <Button type="submit" variant="primary" size="lg" fullWidth loading={status === 'submitting'}>
        Subscribe
      </Button>
      {status === 'error' && (
        <p style={{ fontFamily: 'var(--font-family-body)', fontSize: 'var(--body-xs)', color: color.text.negative, margin: 0 }}>
          Something went wrong. Try again.
        </p>
      )}
      <p style={{ fontFamily: 'var(--font-family-body)', fontSize: 'var(--body-xs)', color: 'var(--text-on-color-dark)', opacity: 0.6, margin: 0, textAlign: 'center' }}>
        We respect your privacy. Unsubscribe at any time.
      </p>
    </form>
  );
}
