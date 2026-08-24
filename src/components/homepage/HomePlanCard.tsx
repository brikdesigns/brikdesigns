import Image from 'next/image';
import { Card, Frame, LinkButton } from '@brikdesigns/bds';
import { heading } from '@/lib/styles';
import { color, serviceCtaVars } from '@/lib/tokens';
import { mapServiceLineSlug } from '@/lib/supabase/queries';

interface HomePlanCardProps {
  name: string;
  slug: string;
  price: string;
  description: string;
  imageUrl?: string | null;
  /** Slug of the plan's marketing service line (`service_plans.display_line_id`
   *  → `service_lines.slug`), or null when the CMS row has no display line.
   *  Drives the CTA tint so this card matches the plan-detail "Other Support
   *  Plans" cards it links to. */
  serviceLineSlug?: string | null;
}

export function HomePlanCard({ name, slug, price, description, imageUrl, serviceLineSlug }: HomePlanCardProps) {
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
      image={
        <Frame ratio="square" fit="cover">
          {imageUrl ? (
            <Image src={imageUrl} alt={name} width={400} height={400} />
          ) : (
            <div style={{ width: '100%', height: '100%', backgroundColor: color.surface.secondary }} />
          )}
        </Frame>
      }
      tag={<span style={{ ...heading.lg, color: color.text.primary }}>{price}</span>}
      action={<LinkButton href={`/plans/${slug}`} variant="primary" size="md" style={svcVars}>Learn More</LinkButton>}
    />
  );
}
