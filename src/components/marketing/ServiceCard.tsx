import Image from 'next/image';
import { Card, Frame, ServiceTag, LinkButton } from '@brikdesigns/bds';
import type { ServiceLine } from '@brikdesigns/bds';
import { serviceColor } from '@/lib/tokens';

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
}

export function ServiceCard({
  name, slug, serviceLineSlug, category, tagline, imageUrl, description, showCta, iconServiceName, className, surfaceInverse,
}: ServiceCardProps) {
  const href = `/services/${serviceLineSlug}/${slug}`;
  const tagProps = iconServiceName ? { serviceName: iconServiceName } : {};

  return (
    <Card
      preset="display"
      className={className}
      {...(surfaceInverse ? { style: { backgroundColor: serviceColor(category).inverse } } : {})}
      title={name}
      description={description ?? tagline ?? undefined}
      image={imageUrl ? (
        <Frame ratio="square" fit="cover">
          <Image src={imageUrl} alt={name} width={400} height={400} />
        </Frame>
      ) : undefined}
      tag={<ServiceTag category={category} variant="icon" size="md" {...tagProps} />}
      action={showCta ? (
        <LinkButton
          href={href}
          variant="primary"
          size="md"
          style={{ '--background-brand-primary': serviceColor(category).onLight } as React.CSSProperties}
        >
          Learn More
        </LinkButton>
      ) : undefined}
      href={!showCta ? href : undefined}
    />
  );
}
