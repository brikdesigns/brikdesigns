import type { ReactNode } from 'react';
import Image from 'next/image';
import { Frame, ServiceTag, type ServiceLine } from '@brikdesigns/bds';
import { color, gap, space, border } from '@/lib/tokens';
import { heading, label } from '@/lib/styles';

/**
 * LeadModalLayout — 2-column shell for the lead-capture modal: a service
 * "showcase" panel on the left (image + offering name + price · frequency,
 * stacked) and the form (`children`) on the right.
 *
 * Visually derived from the hero's media card
 * (`HeroSplitImageCardOverlay` → `.bp-hero-img-card__media-card`): white
 * surface, rounded image frame, stacked label → value → detail. Here the
 * offering context lives in this panel, so the form is rendered with
 * `hideOfferingSummary` to avoid duplicating the `ProductSummaryCard` callout.
 *
 * Responsive without media queries: the two columns are flex items that wrap
 * to a single stacked column on narrow widths (mobile, narrow modal), matching
 * the inline-style idiom used across marketing components.
 *
 * Exploratory (#599) — composed from BDS primitives in-app. If the panel
 * proves reusable it's a candidate for extraction into BDS.
 */
export function LeadModalLayout({
  imageUrl,
  imageAlt = '',
  serviceLine,
  label: panelLabel,
  value,
  price,
  frequency,
  children,
}: {
  /** Service image for the panel. Omit for offerings/plans without artwork. */
  imageUrl?: string;
  imageAlt?: string;
  /** Drives the fallback `ServiceTag` glyph when there's no image. */
  serviceLine: ServiceLine;
  /** Caption above the value, e.g. "Interested in" / "Selected plan". */
  label: string;
  /** Offering / plan name. */
  value: string;
  /** Price, e.g. "$650". */
  price?: string;
  /** Billing frequency, joined to price with a `·`. */
  frequency?: string;
  /** The form. */
  children: ReactNode;
}) {
  const detail = [price, frequency].filter(Boolean).join(' · ');

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: gap.xl, alignItems: 'stretch' }}>
      <aside
        style={{
          flex: '1 1 260px',
          maxWidth: 360,
          display: 'flex',
          flexDirection: 'column',
          gap: gap.md,
          padding: space.md,
          backgroundColor: color.surface.primary,
          border: `${border.width.sm} solid ${color.border.muted}`,
          borderRadius: border.radius.lg,
          boxSizing: 'border-box',
        }}
      >
        {imageUrl ? (
          <Frame
            ratio="3-2"
            fit="cover"
            style={{
              overflow: 'hidden',
              borderRadius: border.radius.md,
              backgroundColor: color.surface.secondary,
            }}
          >
            <Image src={imageUrl} alt={imageAlt} width={600} height={400} />
          </Frame>
        ) : (
          <ServiceTag category={serviceLine} variant="icon" size="lg" />
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: gap.xs }}>
          <span style={{ ...label.sm, color: color.text.secondary }}>{panelLabel}</span>
          <span style={{ ...heading.sm }}>{value}</span>
          {detail && <span style={{ ...label.sm, color: color.text.secondary }}>{detail}</span>}
        </div>
      </aside>

      <div style={{ flex: '1.6 1 340px', minWidth: 0 }}>{children}</div>
    </div>
  );
}
