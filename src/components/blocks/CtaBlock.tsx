import { LinkButton } from '@brikdesigns/bds';
import type { CtaProps } from '@/lib/blocks';
import { heading, text } from '@/lib/styles';
import { gap } from '@/lib/tokens';

/**
 * cta block — heading + body + one or more link buttons. Buttons render with
 * their native BDS variant (default `primary`), so contrast is accessible by
 * construction — blocks never re-point a token to dodge a pairing (#429).
 */
export function CtaBlock({ heading: ctaHeading, body, buttons }: CtaProps) {
  if (!ctaHeading && !body && buttons.length === 0) return null;
  return (
    <section className="lp-cta">
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
