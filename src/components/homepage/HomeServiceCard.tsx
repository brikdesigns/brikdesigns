import Image from 'next/image';
import { Card, Frame, ServiceTag, LinkButton } from '@brikdesigns/bds';
import type { ServiceLine } from '@brikdesigns/bds';
import { color, serviceColor } from '@/lib/tokens';
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
      title={name}
      description={tagline}
      image={
        <Frame ratio="square" fit="cover">
          {imageUrl ? (
            <Image src={imageUrl} alt={name} width={400} height={400} />
          ) : (
            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: color.surface.secondary }}>
              <ServiceTag category={category} variant="icon" size="lg" />
            </div>
          )}
        </Frame>
      }
      tag={<ServiceTag category={category} variant="icon" size="md" />}
      action={
        <LinkButton
          href={`/services/${routeSlugForServiceLine(slug)}`}
          variant="primary"
          size="md"
          style={{ '--background-brand-primary': serviceColor(category).onLight } as React.CSSProperties}
        >
          Learn more
        </LinkButton>
      }
    />
  );
}
