'use client';

import { useState } from 'react';
import { Button } from '@brikdesigns/bds';

/**
 * Newsletter signup form using Kit.com (Klaviyo).
 * Kit.com form UID from the existing Webflow site: 08469c7a1c
 */
export function NewsletterForm() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;

    setStatus('submitting');
    try {
      // Kit.com API endpoint for form submission
      const res = await fetch('https://app.kit.com/forms/08469c7a1c/subscriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email_address: email }),
      });

      if (res.ok || res.status === 200) {
        setStatus('success');
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
      <p style={{ fontFamily: 'var(--font-family-body)', fontSize: 'var(--body-sm)', color: 'var(--text-success)' }}>
        You&apos;re subscribed!
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', gap: 'var(--gap-xs)', flexWrap: 'wrap' }}>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="your@email.com"
        required
        style={{
          flex: '1 1 180px',
          padding: 'var(--padding-xs) var(--padding-sm)',
          fontFamily: 'var(--font-family-body)',
          fontSize: 'var(--body-sm)',
          border: '1px solid var(--border-input)',
          borderRadius: 'var(--border-radius-md)',
          backgroundColor: 'var(--background-input)',
          color: 'var(--text-primary)',
          outline: 'none',
        }}
      />
      <Button type="submit" variant="primary" size="sm" loading={status === 'submitting'}>
        Subscribe
      </Button>
      {status === 'error' && (
        <p style={{ fontFamily: 'var(--font-family-body)', fontSize: 'var(--body-xs)', color: 'var(--text-negative)', width: '100%' }}>
          Something went wrong. Try again.
        </p>
      )}
    </form>
  );
}
