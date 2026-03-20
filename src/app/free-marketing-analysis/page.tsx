import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Free Marketing Analysis | Brik Designs',
  description: 'Get a free marketing analysis from Brik Designs. We\'ll review your brand, website, and marketing presence and give you actionable next steps.',
};

export default function FreeMarketingAnalysisPage() {
  return (
    <section style={{ maxWidth: 700, margin: '0 auto', padding: 'var(--padding-xl) var(--padding-lg)' }}>
      <h1 style={{ fontFamily: 'var(--font-family-heading)', fontSize: 'var(--heading-xl)', color: 'var(--text-primary)' }}>
        Free Marketing Analysis
      </h1>
      <p style={{ fontFamily: 'var(--font-family-body)', fontSize: 'var(--body-lg)', color: 'var(--text-secondary)', marginTop: 'var(--gap-md)' }}>
        Not sure what you need yet? Start with a free marketing assessment.
      </p>
      {/* TODO: Analysis form → POST /api/leads with source='marketing_analysis' */}
    </section>
  );
}
