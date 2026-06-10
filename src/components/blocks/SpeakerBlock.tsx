import Image from 'next/image';
import { Card, CardTitle, Stack } from '@brikdesigns/bds';
import { text } from '@/lib/styles';
import { color, border } from '@/lib/tokens';
import type { SpeakerProps } from '@/lib/blocks';

/**
 * speaker block — name + bio (+ optional avatar). Maps to an outlined BDS Card
 * with a horizontal Stack (COMPONENT-MAP). Non-accent: no per-block color.
 */
export function SpeakerBlock({ name, bio, avatar }: SpeakerProps) {
  if (!name && !bio) return null;

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
