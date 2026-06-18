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
 */
export function HeroBlock({ eyebrow, title, subtitle, media }: HeroProps) {
  if (!title && !subtitle && !media) return null;
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
      {eyebrow && <p style={{ ...label.subtitle, marginBottom: gap.xs }}>{eyebrow}</p>}
      {title && <h1 style={heading.lg}>{title}</h1>}
      {subtitle && (
        <p style={{ ...text.body, color: color.text.secondary, marginTop: gap.sm }}>{subtitle}</p>
      )}
    </div>
  );
}
