import Image from 'next/image';
import { Card, Frame, LinkButton } from '@brikdesigns/bds';
import { heading } from '@/lib/styles';
import { color } from '@/lib/tokens';

interface HomePlanCardProps {
  name: string;
  slug: string;
  price: string;
  description: string;
  imageUrl?: string | null;
}

export function HomePlanCard({ name, slug, price, description, imageUrl }: HomePlanCardProps) {
  return (
    <Card
      preset="display"
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
      action={<LinkButton href={`/plans/${slug}`} variant="primary" size="md">Learn More</LinkButton>}
    />
  );
}
