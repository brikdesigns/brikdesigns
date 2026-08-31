import Image from 'next/image';
import { Card, Frame, ServiceTag, LinkButton } from '@brikdesigns/bds';
import type { ServiceLine } from '@brikdesigns/bds';
import { serviceCtaVars } from '@/lib/tokens';
import { routeSlugForServiceLine } from '@/lib/service-line-routes';

interface HomeServiceCardProps {
  name: string;
  slug: string;
  category: ServiceLine;
  tagline: string;
  imageUrl?: string | null;
}

export function HomeServiceCard({ name, slug, category, tagline, imageUrl }: HomeServiceCardProps) {
  return (
    <Card
      preset="display"
      className="service-themed"
      title={name}
      description={tagline}
      // `service-card__media` is the canonical media-container name (#197).
      // The Frame carries the radius + --surface-secondary well from the "Card
      // media standard" rule in shared-sections.css, so the no-image fallback
      // no longer paints its own fill — one rule covers both states (#1169).
      image={
        <Frame ratio="square" fit="cover" className="service-card__media">
          {imageUrl ? (
            <Image src={imageUrl} alt={name} width={400} height={400} />
          ) : (
            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ServiceTag category={category} variant="icon" size="lg" />
            </div>
          )}
        </Frame>
      }
      tag={<ServiceTag category={category} variant="icon" size="lg" />}
      action={
        <LinkButton
          href={`/services/${routeSlugForServiceLine(slug)}`}
          variant="primary"
          size="md"
          style={serviceCtaVars(category)}
        >
          Learn more
        </LinkButton>
      }
    />
  );
}
