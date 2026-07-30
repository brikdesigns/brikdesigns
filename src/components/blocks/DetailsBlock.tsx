import { Icon } from '@/lib/icon';
import { Stack } from '@brikdesigns/bds';
import { label, text } from '@/lib/styles';
import { color } from '@/lib/tokens';
import type { DetailsProps } from '@/lib/blocks';

/**
 * details block — structured key/value info rows (Venue / Hosts / Audience / …).
 * Each row is a leading Icon + a label subheader + a value, stacked vertically.
 * Maps to a vertical BDS Stack of horizontal Icon + text rows (COMPONENT-MAP),
 * mirroring event-meta's Stack + Icon + label idiom. Non-accent: no per-block
 * color — the icon takes the neutral secondary text token.
 *
 * Icons: only glyphs bundled in `src/lib/icons.generated.json` render — the
 * offline Icon collection has no CDN fallback (#626); an unbundled `ph:*` name
 * shows an empty slot. Authored data must use a bundled name.
 */
export function DetailsBlock({ items }: DetailsProps) {
  if (!items.length) return null;

  return (
    <Stack gap="lg">
      {items.map((item, i) => (
        <Stack key={i} direction="horizontal" gap="sm" align="start">
          {item.icon && (
            <Icon
              icon={item.icon}
              width={22}
              height={22}
              aria-hidden
              style={{ color: color.text.secondary, flexShrink: 0, marginTop: '0.15em' }}
            />
          )}
          <Stack gap="xs">
            {item.label && <span style={label.subtitle}>{item.label}</span>}
            {item.value && <span style={text.body}>{item.value}</span>}
          </Stack>
        </Stack>
      ))}
    </Stack>
  );
}
