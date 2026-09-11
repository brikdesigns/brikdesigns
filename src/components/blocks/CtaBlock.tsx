import { LinkButton } from '@brikdesigns/bds';
import type { CtaProps } from '@/lib/blocks';
import { heading, text } from '@/lib/styles';
import { gap } from '@/lib/tokens';

/**
 * cta block — heading + body + one or more link buttons. Buttons render with
 * their native BDS variant (default `primary`), so contrast is accessible by
 * construction — blocks never re-point a token to dodge a pairing (#429).
 *
 * Exempt from the section-id convention (#1420), and this is the one place in
 * either scanned tree that is. The convention governs TOP-LEVEL sections and
 * wants a page-unique key; this is a repeatable block nested inside the page
 * section `LandingBlocks` owns, and an author may place several on one page.
 * `RawBlock` is `{ type, props }` with no id (`@/lib/blocks`) and `BlockRenderer`
 * keys by array index, so the only key derivable here is positional — which
 * `.claude/references/section-identification.md` rules out by name ("derive the
 * key from the loop's stable key, not its index"). A duplicated or index-shifting
 * `data-section` is worse than none: it would satisfy the gate while giving the
 * figma-parity selector a target that silently re-points when an author reorders
 * blocks.
 *
 * The fix, if this ever needs addressing, is an id on the block data — not a key
 * invented at render time. Nothing needs it today: no figma-declared route
 * renders a `cta` block.
 */
export function CtaBlock({ heading: ctaHeading, body, buttons }: CtaProps) {
  if (!ctaHeading && !body && buttons.length === 0) return null;
  return (
    <section className="lp-cta" /* lint-section-id-ignore */>
      {ctaHeading && <h2 style={heading.section}>{ctaHeading}</h2>}
      {body && <p style={{ ...text.body, marginTop: gap.xs }}>{body}</p>}
      {buttons.length > 0 && (
        <div className="lp-cta__actions">
          {buttons.map((button, i) => (
            <LinkButton
              key={`${button.href}-${i}`}
              href={button.href}
              variant={button.variant ?? 'primary'}
              size="lg"
            >
              {button.label}
            </LinkButton>
          ))}
        </div>
      )}
    </section>
  );
}
