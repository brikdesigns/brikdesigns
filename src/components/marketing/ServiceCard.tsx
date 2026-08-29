import Image from 'next/image';
import { Card, Frame, ServiceTag, LinkButton } from '@brikdesigns/bds';
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
  /** Optional class on the underlying Card root (e.g. the `service-card--flat`
   *  chrome-strip used on the service-line + customer-topic grids). */
  className?: string;
  /** Fill the card with the service line's `-inverse` surface — neutral white
   *  in light mode (== the prior surface-primary fill), deep `{hue}-darkest` in
   *  dark so the card carries the line identity on the tinted band. Matches the
   *  service-detail inverse-card convention (#645). Opt-in per usage. */
  surfaceInverse?: boolean;
  /** Content inset. `'inset'` (default) frames the image and text together in a
   *  `--padding-huge` (48px) inset — the card-vertical mockup. `'flush'` bleeds
   *  the image to the card edges (the prior bare preset-display look). See the
   *  `.service-card--inset` rule in shared-sections.css. */
  mediaTreatment?: 'inset' | 'flush';
}

export function ServiceCard({
  name, slug, serviceLineSlug, category, tagline, imageUrl, description, showCta, iconServiceName, className, surfaceInverse, mediaTreatment = 'inset',
}: ServiceCardProps) {
  const href = `/services/${serviceLineSlug}/${slug}`;
  const tagProps = iconServiceName ? { serviceName: iconServiceName } : {};

  return (
    <Card
      preset="display"
      className={['service-themed', `service-card--${mediaTreatment}`, className].filter(Boolean).join(' ')}
      {...(surfaceInverse ? { style: { backgroundColor: serviceColor(category).inverse } } : {})}
      title={name}
      description={description ?? tagline ?? undefined}
      image={imageUrl ? (
        <Frame ratio="square" fit="cover">
          <Image src={imageUrl} alt={name} width={400} height={400} />
        </Frame>
      ) : undefined}
      tag={<ServiceTag category={category} variant="icon" size="lg" {...tagProps} />}
      action={showCta ? (
        <LinkButton href={href} variant="primary" size="md" style={serviceCtaVars(category)}>
          Learn More
        </LinkButton>
      ) : undefined}
      href={!showCta ? href : undefined}
    />
  );
}
