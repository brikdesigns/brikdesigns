import type { Metadata } from 'next';
import { Suspense } from 'react';
import { LeadCaptureForm } from '@/components/marketing/LeadCaptureForm';
import { text, heading, label } from '@/lib/styles';
import { color } from '@/lib/tokens';
import './free-marketing-analysis.css';

export const metadata: Metadata = {
  title: 'Free Marketing Analysis | Brik Designs',
  description: 'Get a free marketing analysis from Brik Designs. We\'ll review your brand, website, and marketing presence and give you actionable next steps.',
};

const REVIEW_ITEMS = [
  'Your website (design, SEO, usability)',
  'Local listings (accuracy + visibility)',
  'Online reviews (strengths + red flags)',
  'Brand presence across platforms',
  'Competitors in your area',
];

export default function FreeMarketingAnalysisPage() {
  return (
    <section className="fma-section">
      <div className="fma-layout">
        <div className="fma-content">
          <h1 style={{ ...heading.lg, color: color.text.onColorDark, margin: 0 }}>
            The Brikdown
          </h1>
          <p style={{ ...text.bodyLg, color: color.text.onColorDark, margin: 0, opacity: 0.92 }}>
            Before we discuss, plan, or propose&mdash;we break (or brik) it down.
          </p>
          <p style={{ ...text.body, color: color.text.onColorDark, margin: 0, opacity: 0.9 }}>
            <strong>The Brikdown</strong> is our free marketing assessment that looks at how your business is represented online and where the cracks might be. We&apos;ll review your website, local listings, reviews, branding, and SEO&mdash;then deliver clear insights you can actually use. Strategic, straightforward, and built to give you clarity, fast.
          </p>
          <div className="fma-review">
            <p style={{ ...label.smBold, color: color.text.onColorDark, margin: 0 }}>We&apos;ll review:</p>
            <ul className="fma-review-list">
              {REVIEW_ITEMS.map((item) => (
                <li key={item} style={{ ...text.body, color: color.text.onColorDark, opacity: 0.9 }}>
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <p style={{ ...text.body, color: color.text.onColorDark, margin: 0, opacity: 0.9 }}>
            You&apos;ll walk away with insights you can act on&mdash;whether you work with us or not.
          </p>
        </div>

        <div className="fma-form-card">
          <h2 style={{ ...heading.md, margin: 0 }}>Share your details</h2>
          <p style={{ ...text.bodySm, color: color.text.secondary, margin: 0 }}>
            Provide your contact details and we&apos;ll reach out.
          </p>
          <Suspense fallback={<div>Loading form...</div>}>
            <LeadCaptureForm source="marketing_analysis" />
          </Suspense>
        </div>
      </div>
    </section>
  );
}
