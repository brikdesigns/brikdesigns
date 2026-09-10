import Image from 'next/image';
import { Card, Frame, LinkButton } from '@brikdesigns/bds';
import { heading, text } from '@/lib/styles';
import { color, gap, serviceCtaVars } from '@/lib/tokens';
import { mapServiceLineSlug } from '@/lib/supabase/queries';

interface HomePlanCardProps {
  name: string;
  slug: string;
  /** Advisory monthly — the headline figure, or 'Contact' when the plan has none. */
  price: string;
  /** Managed monthly, named under the headline. Omitted when the plan has no
   *  Managed tier, which drops the line rather than rendering a bare label. */
  managedPrice?: string | null;
  description: string;
  imageUrl?: string | null;
  /** Slug of the plan's marketing service line (`service_plans.display_line_id`
   *  → `service_lines.slug`), or null when the CMS row has no display line.
   *  Drives the CTA tint so this card matches the plan-detail "Other Support
   *  Plans" cards it links to. */
  serviceLineSlug?: string | null;
}

export function HomePlanCard({ name, slug, price, managedPrice, description, imageUrl, serviceLineSlug }: HomePlanCardProps) {
  // Canonical service-CTA cascade (brikdesigns#1001): deep `onLight` fill + white
  // label in light mode, flipped to the pale `onDark` step + deep ink in dark by
  // the `.service-themed` rules in globals.css. Plans with no display_line fall
  // through to the BDS brand primary.
  const svcVars = serviceLineSlug ? serviceCtaVars(mapServiceLineSlug(serviceLineSlug)) : undefined;
  return (
    <Card
      preset="display"
      className={svcVars ? 'service-themed' : undefined}
      title={name}
      description={description}
      // `plan-card__media` is the canonical media-container name (#197). The
      // Frame carries the radius + --surface-secondary well from the "Card
      // media standard" rule in shared-sections.css, so the no-image branch is
      // an empty Frame rather than a hand-painted fill (#1169).
      image={
        <Frame ratio="square" fit="cover" className="plan-card__media">
          {imageUrl ? <Image src={imageUrl} alt={name} width={400} height={400} /> : null}
        </Frame>
      }
      // Advisory is the headline, Managed is named beneath it — the /plans
      // wording ("/month advisory", "Managed — $X/month"), not a re-authored
      // one (#1385). The tier suffix is load-bearing now that the headline is
      // the LOWER of two figures: without it the card reads as the plan's only
      // price. Managed drops entirely when the plan has no Managed tier rather
      // than rendering a label with nothing after it.
      tag={
        <span style={{ display: 'flex', flexDirection: 'column', gap: gap.tiny }}>
          <span style={{ ...heading.lg, color: color.text.primary }}>
            {price}
            {price !== 'Contact' && (
              <span style={{ ...text.body, color: color.text.secondary }}> /month advisory</span>
            )}
          </span>
          {managedPrice && (
            <span style={{ ...text.body, color: color.text.secondary }}>
              Managed — {managedPrice}/month
            </span>
          )}
        </span>
      }
      action={<LinkButton href={`/plans/${slug}`} variant="primary" size="md" style={svcVars}>Learn More</LinkButton>}
    />
  );
}
