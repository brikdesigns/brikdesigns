'use client';

import { useSearchParams } from 'next/navigation';
import { FormSuccessCard } from '@/components/marketing/forms/FormSuccessCard';

/**
 * Renders the outcome of a Stripe Checkout round trip (#899).
 *
 * The portal sets both return URLs when it mints the session
 * (`checkout-writer.ts` → `?registration=paid` / `?registration=cancelled`), so
 * this is the arm that reads them.
 *
 * ## Why a client component and not `searchParams`
 *
 * `/events/[slug]` is statically generated — `generateStaticParams` plus
 * `revalidate = 3600`. Reading `searchParams` in the page would opt the whole
 * route out of static rendering to serve one query param that only exists on a
 * return trip from Stripe. Reading it client-side keeps every event page on
 * ISR and costs nothing on the 99% of loads that carry no param.
 */
export function EventCheckoutReturn() {
  const registration = useSearchParams().get('registration');

  if (registration === 'paid') {
    return (
      <FormSuccessCard
        title="You're registered and paid!"
        body="Your seat is confirmed. You'll receive a receipt and event details by email."
      />
    );
  }

  // Cancelled is not a failure: the registration row was written before
  // checkout started, so they ARE on the list — just unpaid, which is exactly
  // what the portal shows. Re-submitting the form below re-uses the still-open
  // Stripe session rather than minting a second one, so pointing them back at
  // it is safe.
  if (registration === 'cancelled') {
    return (
      <FormSuccessCard
        title="Payment Cancelled"
        body="You're still on the list — your spot just isn't paid for yet. Register again below to finish payment."
      />
    );
  }

  return null;
}
