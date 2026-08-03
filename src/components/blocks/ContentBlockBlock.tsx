import { ContentBlock } from '@brikdesigns/bds';
import type { ContentBlockProps } from '@/lib/blocks';

/**
 * content-block — fixed-slot content lead (title / subtitle / description),
 * backed by the BDS `ContentBlock` Block primitive (ADR-023). Owns the vertical
 * rhythm between its slots; the page section owns surface + text pairing.
 *
 * `titleAs="h2"` because the section title sits one level under the hero `h1`
 * (HeroBlock). A non-accent block — no per-block color.
 */
export function ContentBlockBlock({ title, subtitle, description }: ContentBlockProps) {
  if (!title && !subtitle && !description) return null;
  return (
    <ContentBlock title={title} subtitle={subtitle} description={description} titleAs="h2" />
  );
}
