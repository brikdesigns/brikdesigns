'use client';

import { useState } from 'react';
import { Button } from '@bds/components/ui/Button/Button';

/**
 * Newsletter signup form using Kit.com (Klaviyo).
 * Webflow layout: stacked First Name + Email inputs with full-width Subscribe button.
 * Kit.com form UID from the existing Webflow site: 08469c7a1c
 */
export function NewsletterForm() {
  const [name, setName] = useState('');
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
        body: JSON.stringify({ email_address: email, first_name: name }),
      });

      if (res.ok || res.status === 200) {
        setStatus('success');
        setEmail('');
        setName('');
      } else {
        setStatus('error');
      }
    } catch {
      setStatus('error');
    }
  }

  if (status === 'success') {
    return <p className="newsletter-form__success">You&apos;re subscribed!</p>;
  }

  return (
    <form onSubmit={handleSubmit} className="newsletter-form">
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="First Name"
        className="newsletter-form__input"
      />
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email Address"
        required
        className="newsletter-form__input"
      />
      <Button type="submit" variant="primary" size="lg" fullWidth loading={status === 'submitting'}>
        Subscribe
      </Button>
      <p className="newsletter-form__privacy">We respect your privacy. Unsubscribe at any time.</p>
      {status === 'error' && (
        <p className="newsletter-form__error">Something went wrong. Try again.</p>
      )}
    </form>
  );
}
