import type { Metadata } from 'next';
import { Suspense } from 'react';
import { LeadCaptureForm } from '@/components/marketing/LeadCaptureForm';

export const metadata: Metadata = {
  title: 'Get Started | Tell Us About Your Project',
  description: 'Start your project with Brik Designs. Tell us about your business, your goals, and what you need — and we\'ll take it from there.',
};

export default function GetStartedPage() {
  return (
    <section style={{ maxWidth: 600, margin: '0 auto', padding: 'var(--padding-xl) var(--padding-lg)' }}>
      <h1 style={{ fontFamily: 'var(--font-family-heading)', fontSize: 'var(--heading-xl)', color: 'var(--text-primary)', margin: 0 }}>
        Get Started
      </h1>
      <p style={{ fontFamily: 'var(--font-family-body)', fontSize: 'var(--body-lg)', color: 'var(--text-secondary)', marginTop: 'var(--gap-md)' }}>
        Tell us about your business and what you&apos;re looking for.
        We&apos;ll be in touch within 1 business day.
      </p>
      <div style={{ marginTop: 'var(--gap-xl)' }}>
        <Suspense>
          <LeadCaptureForm source="get_started" />
        </Suspense>
      </div>
    </section>
  );
}
