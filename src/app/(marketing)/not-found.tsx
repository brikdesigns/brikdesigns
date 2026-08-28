import type { Metadata } from 'next';
import { LinkButton } from '@brikdesigns/bds';
import { heading, text } from '@/lib/styles';
import { gap } from '@/lib/tokens';
import './shared-sections.css';

export const metadata: Metadata = {
  title: 'Page Not Found',
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <section className="page-section page-section--top" data-section="not-found">
      <div className="container-lg" style={{ textAlign: 'center', gap: gap.md }}>
        <h1 style={heading.page}>Page Not Found</h1>
        <p style={text.bodyLg}>
          The page you’re looking for doesn’t exist or has moved.
        </p>
        <div style={{ display: 'flex', gap: gap.sm, justifyContent: 'center', flexWrap: 'wrap' }}>
          <LinkButton href="/" variant="primary" size="md">Back to home</LinkButton>
          <LinkButton href="/blog" variant="secondary" size="md">Read the blog</LinkButton>
        </div>
      </div>
    </section>
  );
}
