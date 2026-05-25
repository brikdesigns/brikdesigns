import Image from 'next/image';
import { Card, Frame, ServiceTag, LinkButton } from '@brikdesigns/bds';
import type { ServiceCategory } from '@brikdesigns/bds';

interface ServiceCardProps {
  name: string;
  slug: string;
  categorySlug: string;
  category: ServiceCategory;
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
}

export function ServiceCard({
  name, slug, categorySlug, category, tagline, imageUrl, description, showCta, iconServiceName,
}: ServiceCardProps) {
  const href = `/services/${categorySlug}/${slug}`;
  const tagProps = iconServiceName ? { serviceName: iconServiceName } : {};

  return (
    <Card
      preset="display"
      title={name}
      description={tagline ?? description ?? undefined}
      image={imageUrl ? (
        <Frame ratio="square" fit="cover">
          <Image src={imageUrl} alt={name} width={400} height={400} />
        </Frame>
      ) : undefined}
      tag={<ServiceTag category={category} variant="icon" size={imageUrl ? 'sm' : 'md'} {...tagProps} />}
      action={showCta ? <LinkButton href={href} variant="primary" size="md">Learn More</LinkButton> : undefined}
      href={!showCta ? href : undefined}
    />
  );
}
