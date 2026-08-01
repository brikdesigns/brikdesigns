import type { RawBlock, BlockContext } from '@/lib/blocks';
import type { LandingSurface } from '@/lib/events';
import { BlockRenderer } from './BlockRenderer';

/**
 * Page-level wrapper for a block-rendered landing page (#423). Owns the
 * **section surface** (tint / solid / none — resolved by `landingSurface`,
 * which sets the bg inline + a text-pairing class that re-points `--text-*` for
 * the subtree) and the **layout**:
 *
 *   - `layout="split"` — two columns: content (hero, prose, cta) on the left,
 *     the form on the right, with any `logo-strip` pulled into a full-width
 *     trailer **below** both columns (sponsors read as their own section, not a
 *     left-column tail — BACKLOG-1129). Matches the legacy fma 2-col pages.
 *   - default — a single stacked column.
 *
 * Both routes (`/events/[slug]`, `/marketing/[slug]`) and the vanity landing
 * routes render through this so surface + layout behave identically everywhere.
 */
export function LandingBlocks({
  blocks,
  context,
  layout,
  surface,
}: {
  blocks: RawBlock[];
  context: BlockContext;
  layout: string | null;
  surface: LandingSurface;
}) {
  const sectionClass = ['lp-blocks', surface.className].filter(Boolean).join(' ');
  const style = surface.background ? { backgroundColor: surface.background } : undefined;

  if (layout === 'split') {
    const formBlocks = blocks.filter((b) => b.type === 'form');
    // logo-strip breaks out of the 2-col grid into a full-width trailer below
    // both columns, so sponsors read as their own section (BACKLOG-1129).
    const trailerBlocks = blocks.filter((b) => b.type === 'logo-strip');
    const contentBlocks = blocks.filter(
      (b) => b.type !== 'form' && b.type !== 'logo-strip',
    );
    return (
      <section className={sectionClass} style={style}>
        <div className="lp-blocks__container lp-split">
          <div className="lp-split__content">
            <BlockRenderer blocks={contentBlocks} context={context} />
          </div>
          <div className="lp-split__aside">
            <BlockRenderer blocks={formBlocks} context={context} />
          </div>
        </div>
        {trailerBlocks.length > 0 && (
          <div className="lp-blocks__container lp-split__trailer">
            <BlockRenderer blocks={trailerBlocks} context={context} />
          </div>
        )}
      </section>
    );
  }

  return (
    <section className={sectionClass} style={style}>
      <div className="lp-blocks__container">
        <BlockRenderer blocks={blocks} context={context} />
      </div>
    </section>
  );
}
