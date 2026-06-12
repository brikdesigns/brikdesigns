import { Icon } from '@iconify/react';
import { Stack } from '@brikdesigns/bds';
import { label } from '@/lib/styles';
import { color } from '@/lib/tokens';
import { feeLabel, formatEventDate } from '@/lib/events';
import type { EventMetaProps } from '@/lib/blocks';

/**
 * event-meta block — date / time / fee row. Maps to a horizontal BDS Stack of
 * Icon + label items (COMPONENT-MAP), mirroring the legacy `.event-page__meta`
 * presentation. An omitted `fee` hides the item; `fee: null` renders "Free".
 */
export function EventMetaBlock({ date, time, fee }: EventMetaProps) {
  const showFee = fee !== undefined;
  if (!date && !time && !showFee) return null;

  const itemStyle = { ...label.sm, color: color.text.secondary };

  return (
    <Stack direction="horizontal" gap="md" wrap>
      {date && (
        <Stack as="span" direction="horizontal" gap="xs" align="center" style={itemStyle}>
          <Icon icon="ph:calendar-blank" width={16} height={16} aria-hidden />
          {formatEventDate(date)}
        </Stack>
      )}
      {time && (
        <Stack as="span" direction="horizontal" gap="xs" align="center" style={itemStyle}>
          <Icon icon="ph:clock" width={16} height={16} aria-hidden />
          {time}
        </Stack>
      )}
      {showFee && (
        <Stack as="span" direction="horizontal" gap="xs" align="center" style={itemStyle}>
          <Icon icon="ph:ticket" width={16} height={16} aria-hidden />
          {feeLabel(fee ?? null)}
        </Stack>
      )}
    </Stack>
  );
}
