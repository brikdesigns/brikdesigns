import Image from 'next/image';
import type { HeroProps } from '@/lib/blocks';
import { heading, label, text } from '@/lib/styles';
import { color, gap } from '@/lib/tokens';

/**
 * hero block — eyebrow + title + tagline (+ optional media). Content only: the
 * surface (tint / solid / none) is owned by the page-level section
 * (LandingBlocks), which re-points `--text-*` for the whole subtree to the
 * AA-correct pairing — so the hero text inherits the right color on any surface
 * without a per-block override. Prose body copy is a separate `rich-content`
 * block per the catalogue.
 *
 * Deliberately NOT composed from a BDS hero (#1357). Three blockers, in the
 * order they bite:
 *
 *   1. There is no exported content column to compose from. The root entry
 *      ships whole blueprints only — `Hero`, `HeroInteriorMinimal`,
 *      `HeroMediaCard`, `HeroSplitImageCardOverlay` — and `.bds-hero__content`
 *      is a class inside `Hero`, not a component. So "use the content column"
 *      has no target short of adopting the blueprint entire.
 *   2. Every one of those blueprints renders its own `<section>` + ADR-021
 *      shell, and this block does not own its surface. On `split` it renders
 *      inside `lp-split__content` (`LandingBlocks.tsx:75`); on `showcase` the
 *      hero is rendered from parsed props inside a yellow card
 *      (`lp-showcase__hero`, `:144`) whose colours the page owns (#429).
 *      Neither position can host a section shell.
 *   3. `wordmark` has no BDS equivalent — the monochrome SVG is painted as a
 *      CSS mask (`:35`) so it inherits the section's text colour on any
 *      surface. Both live offers pages use it (`/offers/brikdown`,
 *      `/offers/dental-brikdown`) and neither sets `media`.
 *
 * Blocker 2 is the same surface-ownership constraint that ruled
 * `BlueprintDispatcher` out of these routes (#1349), so the fix is not local to
 * this file. What #1366 established for the two page-local MARKETING heroes —
 * direct root-entry import of `Hero` — does not transfer here, because those
 * routes own their section and a landing block does not.
 */
export function HeroBlock({ eyebrow, title, subtitle, media, wordmark }: HeroProps) {
  if (!title && !subtitle && !media && !wordmark) return null;
  return (
    <div className="lp-hero">
      {media && (
        <div className="lp-hero__media">
          <Image
            src={media.url}
            alt={media.alt}
            fill
            sizes="(max-width: 991px) 100vw, 640px"
            style={{ objectFit: 'cover' }}
            priority
          />
        </div>
      )}
      {wordmark && (
        <span
          className="lp-hero__wordmark"
          role="img"
          aria-label={wordmark.alt}
          style={{ maskImage: `url(${wordmark.url})`, WebkitMaskImage: `url(${wordmark.url})` }}
        />
      )}
      {eyebrow && <p style={{ ...label.subtitle, marginBottom: gap.xs }}>{eyebrow}</p>}
      {title && <h1 style={heading.lg}>{title}</h1>}
      {subtitle && (
        <p style={{ ...text.body, color: color.text.secondary, marginTop: gap.sm }}>{subtitle}</p>
      )}
    </div>
  );
}
