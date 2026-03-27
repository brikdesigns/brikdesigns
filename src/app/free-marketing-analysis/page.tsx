import type { Metadata } from 'next';
import Image from 'next/image';
import { Suspense } from 'react';
import { LeadCaptureForm } from '@/components/marketing/LeadCaptureForm';
import '../shared-sections.css';
import './free-marketing-analysis.css';

export const metadata: Metadata = {
  title: 'Free Marketing Analysis | Brik Designs',
  description: 'Get a free marketing analysis from Brik Designs. We\'ll review your brand, website, and marketing presence and give you actionable next steps.',
};

export default function FreeMarketingAnalysisPage() {
  return (
    <>
      <section className="page-hero">
        <div className="page-hero__container">
          <div className="fma-hero-layout">
            <div className="fma-hero-content">
              <h1 className="page-hero__title">
                Not sure what you need yet?
              </h1>
              <p className="text-heading-md">
                Start with a <em>free</em> marketing assessment.
              </p>
              <p className="page-hero__description">
                We&apos;ll review your current marketing, systems, and tools &mdash; and send you
                a 3-part plan to fix what&apos;s holding you back.
              </p>
              <div className="fma-form-wrapper">
                <Suspense fallback={<div>Loading form...</div>}>
                  <LeadCaptureForm source="marketing_analysis" />
                </Suspense>
              </div>
            </div>
            <div className="fma-hero-image">
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
