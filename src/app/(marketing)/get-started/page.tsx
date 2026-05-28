import type { Metadata } from 'next';
import { Suspense } from 'react';
import { LeadCaptureForm } from '@/components/marketing/LeadCaptureForm';
import '../shared-sections.css';

export const metadata: Metadata = {
  title: 'Get Started | Tell Us About Your Project',
  description: 'Start your project with Brik Designs. Tell us about your business, your goals, and what you need — and we\'ll take it from there.',
};

export default function GetStartedPage() {
  return (
    <>
      <section className="page-hero">
        <div className="page-hero__container">
          <h1 className="page-hero__title">Get Started</h1>
          <p className="page-hero__description">
            Tell us about your business and what you&apos;re looking for.
            We&apos;ll be in touch within 1 business day.
          </p>
        </div>
      </section>

      <section className="content-section">
        <div className="container-lg" style={{ maxWidth: 600, alignItems: 'flex-start' }}>
          <Suspense>
            <LeadCaptureForm source="get_started" />
          </Suspense>
        </div>
      </section>
    </>
  );
}
