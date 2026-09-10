import { Card, SocialIcon, Tag } from '@brikdesigns/bds';
import { Icon } from '@/lib/icon';
import { resolvePlanCoverageIcon } from '@/lib/plan-coverage-icons';

/**
 * One row of a plan's coverage list — the Figma `card-vertical` shared by
 * `section-intro` (node `26170:5761`) and `section-details` (node `26144:9074`).
 * Identical geometry in both frames, so one component serves both (#1371).
 *
 * `clause` is the optional second line. Q3 of #1371 resolved which frame keeps
 * it against Notion: `section-intro`'s Foundation rows carry the em-dash clause
 * ("Marketing audit — what exists, what's working, what's off"), `section-details`
 * renders title-only because Notion authors those as bare bullets. Figma's
 * "5 hours per month" is un-swapped placeholder in BOTH and is never rendered.
 */
export function PlanCoverageRow({
  title,
  clause,
  iconKey,
  surfaceLight,
}: {
  title: string;
  /** Optional second line. Omitted entirely when null — not rendered empty. */
  clause?: string | null;
  /** Semantic coverage role from the CMS. Unknown/absent → no indicator. */
  iconKey?: string | null;
  /**
   * Plan service-line pale tint — the card fill Figma binds, resolved through
   * `serviceColor(audience).surfaceLight`. Dynamic per plan, so it is passed in
   * and set inline rather than declared in plans.css.
   */
  surfaceLight: string;
}) {
  const icon = resolvePlanCoverageIcon(iconKey);

  return (
    // No `variant`: this row sits on the WHITE `--surface-primary` band, and a
    // card on a white band takes the BDS default (border, no shadow) per
    // card-treatment.md. The card's own tinted FILL does not change the rule —
    // the discriminator is the BAND's luminance, not the card's.
    <Card padding="lg" className="plan-coverage-row" style={{ backgroundColor: surfaceLight }}>
      {/* Indicator, not a chip. Figma draws `brik-tag-subscription` — a
          service-colored icon-only box. `Tag` is BDS's icon-only categorization
          indicator (`size="xs"`, non-interactive by design); `Chip` would be
          wrong — it is the interactive filter/selection pill (Chip.mdx:
          "Chip is interactive only"). Two deltas from the mockup, both
          deliberate:
            * 24x24 (Tag's `xs` box), not Figma's 32 — the component's ratified
              indicator geometry wins over a mockup pixel.
            * neutral fill, not the service tint — Tag exposes no service-colour
              axis and no fill override API. Filed as a BDS gap rather than
              hand-rolled here; `.engagement-mode__chip` (plans.css) is the
              hand-rolled precedent this deliberately does not copy.
          Purely decorative — the row title carries the meaning. */}
      {icon && (
        <Tag
          size="xs"
          aria-hidden="true"
          icon={
            icon.kind === 'social' ? (
              <SocialIcon platform={icon.platform} />
            ) : (
              <Icon icon={icon.icon} width={16} height={16} />
            )
          }
        />
      )}
      <div className="plan-coverage-row__content">
        <p className="plan-coverage-row__title">{title}</p>
        {clause && <p className="plan-coverage-row__description">{clause}</p>}
      </div>
    </Card>
  );
}
