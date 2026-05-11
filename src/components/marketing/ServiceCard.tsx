'use client';

import Link from 'next/link';
import Image from 'next/image';
import { ServiceTag } from '@brikdesigns/bds';
import type { ServiceCategory } from '@brikdesigns/bds';
import { composeButtonClasses } from '@/lib/bds-button-classes';
import { text, heading } from '@/lib/styles';
import { color } from '@/lib/tokens';
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

/** Individual service card — service tag icon + name + tagline, optionally with image and CTA */
export function ServiceCard({
  name, slug, categorySlug, category, tagline, imageUrl, description, showCta, iconServiceName,
}: ServiceCardProps) {
  const href = `/services/${categorySlug}/${slug}`;
  const isRich = !!imageUrl;

  return (
    <Link href={href} className={`svc-card${isRich ? ' svc-card--rich' : ''}`}>
      {imageUrl && (
        <div className="svc-card__image">
          <Image src={imageUrl} alt={name} width={400} height={267} />
        </div>
      )}
      {!isRich && (
        <ServiceTag
          category={category}
          variant="icon"
          size="md"
          {...(iconServiceName ? { serviceName: iconServiceName } : {})}
        />
      )}
      <div className="svc-card__content">
        {isRich && (
          <ServiceTag
            category={category}
            variant="icon"
            size="sm"
            {...(iconServiceName ? { serviceName: iconServiceName } : {})}
          />
        )}
        <h3 style={heading.sm}>{name}</h3>
        {tagline && <p style={{ ...text.bodySm, color: color.text.secondary }}>{tagline}</p>}
        {description && <p style={{ ...text.bodySm, color: color.text.secondary }}>{description}</p>}
        {showCta && (
          <span className={composeButtonClasses({ variant: 'primary', size: 'sm' })}>Learn More</span>
        )}
      </div>
    </Link>
  );
}
