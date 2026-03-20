import type { Metadata } from 'next';
import Image from 'next/image';
import { Suspense } from 'react';
import { LeadCaptureForm } from '@/components/marketing/LeadCaptureForm';
import '../shared-sections.css';

export const metadata: Metadata = {
  title: 'Free Marketing Analysis | Brik Designs',
  description: 'Get a free marketing analysis from Brik Designs. We\'ll review your brand, website, and marketing presence and give you actionable next steps.',
};

export default function FreeMarketingAnalysisPage() {
  return (
    <>
      {/* Hero — 2 column: form + illustration */}
      <section className="page-hero">
        <div className="page-hero__container">
          <div style={{ display: 'flex', gap: 'var(--gap-xl)', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 400px' }}>
              <h1 className="page-hero__title">
                Not sure what you need yet?
              </h1>
              <p className="page-hero__tagline" style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: 'var(--heading-lg)' }}>
                Start with a <em>free</em> marketing assessment.
              </p>
              <p className="page-hero__description">
                We&apos;ll review your current marketing, systems, and tools — and send you
                a 3-part plan to fix what&apos;s holding you back.
              </p>
              <div style={{ marginTop: 'var(--gap-xl)' }}>
                <Suspense fallback={<div>Loading form...</div>}>
                  <LeadCaptureForm source="marketing_analysis" />
                </Suspense>
              </div>
            </div>
            <div style={{ flex: '0 0 320px' }}>
              <div className="img-frame">
                <Image
                  src="/images/3d-form-robot.png"
                  alt="3D clay form illustration"
                  width={504}
                  height={504}
                  style={{ width: '100%', height: 'auto' }}
                />
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
