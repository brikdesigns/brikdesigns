import Image from 'next/image';
import { Stack } from '@brikdesigns/bds';
import { heading, label, text } from '@/lib/styles';
import type { ScheduleProps } from '@/lib/blocks';

/**
 * schedule block (#852) — the run of show: an optional heading over timed rows,
 * with an optional supporting photo beside them. Rows are a `<dl>` so the
 * time ⇄ what-happens pairing survives without the visual two-column read.
 *
 * Non-accent: no per-block color (#429). The two-column split (rows | photo)
 * and the row rhythm are the only things this owns; type comes from the shared
 * scales and colour inherits the section's `--text-*` pairing.
 */
export function ScheduleBlock({ title, items, media }: ScheduleProps) {
  if (!items.length) return null;

  return (
    <div className="lp-schedule">
      <Stack gap="lg" className="lp-schedule__main">
        {title && <h2 style={heading.section}>{title}</h2>}
        <dl className="lp-schedule__list">
          {items.map((item, i) => (
            <div key={i} className="lp-schedule__row">
              {item.time && (
                <dt className="lp-schedule__time" style={label.subtitle}>
                  {item.time}
                </dt>
              )}
              <dd className="lp-schedule__label" style={text.body}>
                {item.label}
              </dd>
            </div>
          ))}
        </dl>
      </Stack>
      {media && (
        <div className="lp-schedule__media">
          <Image
            src={media.url}
            alt={media.alt}
            fill
            sizes="(max-width: 767px) 100vw, 45vw"
            style={{ objectFit: 'cover' }}
          />
        </div>
      )}
    </div>
  );
}
