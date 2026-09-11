import Image from 'next/image';
import { Card, CardDescription, Frame, ServiceTag, LinkButton } from '@brikdesigns/bds';
import type { ServiceLine } from '@brikdesigns/bds';
import { serviceColor, serviceCtaVars } from '@/lib/tokens';

interface ServiceCardProps {
  name: string;
  slug: string;
  serviceLineSlug: string;
  category: ServiceLine;
  tagline?: string | null;
  imageUrl?: string | null;
  description?: string | null;
  showCta?: boolean;
  /**
   * Service name to resolve the tag icon. Pass only when the parent has
   * verified an icon file exists for this name+category — otherwise omit so
   * the tag renders an empty colored box instead of leaking a broken-image
   * URL through SSR.
   */
  iconServiceName?: string;
  /** Optional class on the underlying Card root (e.g. `display-card--title-sm`,
   *  the title step-down used on the service-line + customer-topic grids). */
  className?: string;
  /** Fill the card with the service line's `-inverse` surface — neutral white
   *  in light mode (== the prior surface-primary fill), deep `{hue}-darkest` in
   *  dark so the card carries the line identity on the tinted band. Matches the
   *  service-detail inverse-card convention (#645). Opt-in per usage. */
  surfaceInverse?: boolean;
}

export function ServiceCard({
  name, slug, serviceLineSlug, category, tagline, imageUrl, description, showCta, iconServiceName, className, surfaceInverse,
}: ServiceCardProps) {
  const href = `/services/${serviceLineSlug}/${slug}`;
  const tagProps = iconServiceName ? { serviceName: iconServiceName } : {};
  const body = description ?? tagline ?? undefined;

  return (
    <Card
      layout="stack"
      // Inset media treatment — media + text body framed together in a
      // --padding-huge inset (the "card-vertical" look). A first-class BDS prop
      // since @brikdesigns/bds v0.188.0; it replaces the former site-local
      // `.service-card--inset` CSS override (whose CSS half #1261 built).
      mediaTreatment="inset"
      className={['service-themed', className].filter(Boolean).join(' ')}
      {...(surfaceInverse ? { style: { backgroundColor: serviceColor(category).inverse } } : {})}
      title={name}
      // `service-card__media` is the canonical media-container name (#197);
      // the radius + --surface-secondary well come from the "Card media
      // standard" rule in shared-sections.css (#1169).
      media={imageUrl ? (
        <Frame ratio="square" fit="cover" className="service-card__media">
          <Image src={imageUrl} alt={name} width={400} height={400} />
        </Frame>
      ) : undefined}
      overline={<ServiceTag category={category} variant="icon" size="lg" {...tagProps} />}
      action={showCta ? (
        <LinkButton href={href} variant="primary" size="md" style={serviceCtaVars(category)}>
          Learn More
        </LinkButton>
      ) : undefined}
      href={!showCta ? href : undefined}
    >
      {body ? <CardDescription>{body}</CardDescription> : undefined}
    </Card>
  );
}
