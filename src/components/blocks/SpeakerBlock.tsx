import Image from 'next/image';
import { Card, CardTitle, Stack } from '@brikdesigns/bds';
import { text } from '@/lib/styles';
import { color, border } from '@/lib/tokens';
import type { SpeakerProps, SpeakerBlockProps } from '@/lib/blocks';

/** One speaker → an outlined BDS Card with a horizontal Stack (COMPONENT-MAP).
 *  Avatar is enlarged (96px) and top-aligned to the name/title rather than
 *  vertically centered (`align="start"`, BACKLOG-1128). */
function SpeakerCard({ name, bio, avatar }: SpeakerProps) {
  return (
    <Card variant="outlined" padding="lg">
      <Stack direction="horizontal" gap="md" align="start">
        {avatar?.url && (
          <Image
            src={avatar.url}
            alt={avatar.alt || ''}
            width={96}
            height={96}
            style={{ borderRadius: border.radius.circle, objectFit: 'cover', flexShrink: 0 }}
          />
        )}
        <Stack gap="xs">
          {name && <CardTitle>{name}</CardTitle>}
          {/* Split on blank lines so an authored multi-paragraph bio renders as
              separate paragraphs; a single-paragraph bio is one <p> as before. */}
          {bio &&
            bio
              .split(/\n{2,}/)
              .map((para) => para.trim())
              .filter(Boolean)
              .map((para, i) => (
                <p key={i} style={{ ...text.body, color: color.text.secondary, margin: 0 }}>
                  {para}
                </p>
              ))}
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
