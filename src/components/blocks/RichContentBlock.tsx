import { Prose } from '@brikdesigns/bds';
import { sanitizeHtml } from '@/lib/sanitize';
import type { RichContentProps } from '@/lib/blocks';

/**
 * rich-content block — sanitized prose body, backed by the BDS `Prose` Block
 * primitive (ADR-023, the formalized successor to `.rich-content`). HTML is
 * sanitized server-side at ISR time before handing markup to `Prose`, which
 * owns element-adjacency rhythm. Retained as a thin alias of `ProseBlock` so
 * the legacy `rich-content` block type keeps rendering; new content emits
 * `prose`. Per the catalogue, this absorbs the "we'll review" checklist +
 * benefit copy (they are prose), not bespoke section types.
 */
export function RichContentBlock({ html }: RichContentProps) {
  const clean = sanitizeHtml(html);
  if (!clean) return null;
  return <Prose html={clean} />;
}
