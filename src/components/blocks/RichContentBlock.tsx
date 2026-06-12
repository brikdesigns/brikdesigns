import { sanitizeHtml } from '@/lib/sanitize';
import type { RichContentProps } from '@/lib/blocks';

/**
 * rich-content block — sanitized prose body. Maps to prose styling via
 * blocks.css (`.rich-content`); HTML is sanitized server-side at ISR time.
 * Per the catalogue, this absorbs the "we'll review" checklist + benefit copy
 * (they are prose), not bespoke section types.
 */
export function RichContentBlock({ html }: RichContentProps) {
  const clean = sanitizeHtml(html);
  if (!clean) return null;
  return <div className="rich-content" dangerouslySetInnerHTML={{ __html: clean }} />;
}
