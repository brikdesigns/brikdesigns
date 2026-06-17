import Image from 'next/image';
import type { HeroProps, BlockContext } from '@/lib/blocks';
import { heading, label, text } from '@/lib/styles';
import { color, gap } from '@/lib/tokens';

/**
 * hero block — eyebrow + title + tagline (+ optional media). The section tint
 * is the page accent (threaded via BlockContext). The accent `-light` surfaces
 * are fixed-light in both themes, so the theme-responsive `--text-*` tokens go
 * light-on-light in dark mode (the #502 failure, caught by the axe dark pass).
 * The `service-surface` class is the consumer dark-pin (globals.css) that holds
 * the inherited text dark on the tint — the same mechanism the legacy
 * event-page hero uses. The form card is a separate sibling block (not nested
 * here), so the pin doesn't reach it. Prose body copy is a separate
 * `rich-content` block per the catalogue.
 */
export function HeroBlock({
  eyebrow,
  title,
  subtitle,
  media,
  accent,
}: HeroProps & { accent: BlockContext['accent'] }) {
  if (!title && !subtitle && !media) return null;
  return (
    <section className="lp-hero service-surface" style={{ backgroundColor: accent.surfaceLight }}>
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
    </section>
  );
}
