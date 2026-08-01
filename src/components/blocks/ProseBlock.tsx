import { Prose } from '@brikdesigns/bds';
import { sanitizeHtml } from '@/lib/sanitize';
import type { RichContentProps } from '@/lib/blocks';

/**
 * prose — free-form CMS-HTML body, backed by the BDS `Prose` Block primitive
 * (ADR-023, the formalized successor to `rich-content`/`.rich-content`). BDS
 * does not sanitize; we sanitize server-side at ISR time before handing markup
 * to `Prose`, mirroring RichContentBlock. Prose owns element-adjacency rhythm.
 */
export function ProseBlock({ html }: RichContentProps) {
  const clean = sanitizeHtml(html);
  if (!clean) return null;
  return <Prose html={clean} />;
}
