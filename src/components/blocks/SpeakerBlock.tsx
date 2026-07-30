import Image from 'next/image';
import { Card, CardTitle, Stack } from '@brikdesigns/bds';
import { text } from '@/lib/styles';
import { color, border } from '@/lib/tokens';
import type { SpeakerProps, SpeakerBlockProps } from '@/lib/blocks';

/** One speaker → an outlined BDS Card with a horizontal Stack (COMPONENT-MAP). */
function SpeakerCard({ name, bio, avatar }: SpeakerProps) {
  return (
    <Card variant="outlined" padding="lg">
      <Stack direction="horizontal" gap="md" align="center">
        {avatar?.url && (
          <Image
            src={avatar.url}
            alt={avatar.alt || ''}
            width={56}
            height={56}
            style={{ borderRadius: border.radius.circle, objectFit: 'cover' }}
          />
        )}
        <Stack gap="xs">
          {name && <CardTitle>{name}</CardTitle>}
          {bio && (
            <p style={{ ...text.body, color: color.text.secondary, margin: 0 }}>{bio}</p>
          )}
        </Stack>
      </Stack>
    </Card>
  );
}

/**
 * speaker block — one or many speakers. Each speaker renders as an outlined
 * Card; multiple stack vertically. Non-accent: no per-block color.
 */
export function SpeakerBlock({ speakers }: SpeakerBlockProps) {
  if (speakers.length === 0) return null;

  return (
    <Stack gap="md">
      {speakers.map((speaker, i) => (
        <SpeakerCard key={i} {...speaker} />
      ))}
    </Stack>
  );
}
