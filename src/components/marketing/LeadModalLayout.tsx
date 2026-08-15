import type { ReactNode } from 'react';
import Image from 'next/image';
import { Frame, ServiceTag, type ServiceLine } from '@brikdesigns/bds';
import { gap, space, border, serviceColor } from '@/lib/tokens';
import { heading, label, text } from '@/lib/styles';

/**
 * LeadModalLayout — 2-column shell for the lead-capture modal: a service
 * "showcase" panel on the left (image + offering name + price · frequency,
 * stacked) and the form (`children`) on the right.
 *
 * Visually derived from the hero's media card
 * (`HeroSplitImageCardOverlay` → `.bds-hero__media-card`): rounded
 * image frame, stacked label → value → detail → description. The panel is
 * tinted with the parent service line's subtle brand ramp
 * (`serviceColor(serviceLine).surfaceLight` + `.text` for the value), mirroring
 * the service-line page's `surfaceLight` band (#653). Here the offering context
 * lives in this panel, so the form is rendered with `hideOfferingSummary` to
 * avoid duplicating the `ProductSummaryCard` callout.
 *
 * Responsive without media queries: the two columns are flex items that wrap
 * to a single stacked column on narrow widths (mobile, narrow modal), matching
 * the inline-style idiom used across marketing components.
 *
 * Decision (#599 Phase B): the showcase panel stays in-app — single call site,
 * and its data model duplicates BDS `ProductSummaryCard` (only the layout
 * differs). If a second surface needs this image-on-top showcase layout, extend
 * `ProductSummaryCard` with a layout axis rather than forking a new component.
 */
export function LeadModalLayout({
  imageUrl,
  imageAlt = '',
  serviceLine,
  label: panelLabel,
  value,
  price,
  frequency,
  description,
  children,
}: {
  /** Service image for the panel. Omit for offerings/plans without artwork. */
  imageUrl?: string;
  imageAlt?: string;
  /** Drives the fallback `ServiceTag` glyph when there's no image, and the
   *  panel's brand tint (`surfaceLight` surface + `text` for the value). */
  serviceLine: ServiceLine;
  /** Caption above the value, e.g. "Interested in". Omitted (plan modals)
   *  renders no caption. */
  label?: string;
  /** Offering / plan name. */
  value: string;
  /** Price, e.g. "$650". */
  price?: string;
  /** Billing frequency, joined to price with a `·`. */
  frequency?: string;
  /** Offering / plan description from the CMS. Omitted from the panel when
   *  absent (no-image cards keep the glyph-only fallback). (#653) */
  description?: string;
  /** The form. */
  children: ReactNode;
}) {
  const detail = [price, frequency].filter(Boolean).join(' · ');
  const svc = serviceColor(serviceLine);

  return (
    // `stretch` so the showcase panel matches the full height of the taller
    // form column (reverses BACKLOG-894's `flex-start`, by request). Single-item
    // lines when the columns wrap on mobile are unaffected.
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: gap.xl, alignItems: 'stretch' }}>
      <aside
        style={{
          flex: '1 1 260px',
          maxWidth: 360,
          display: 'flex',
          flexDirection: 'column',
          gap: gap.md,
          padding: space.md,
          backgroundColor: svc.surfaceLight,
          borderRadius: border.radius.lg,
          boxSizing: 'border-box',
        }}
      >
        {imageUrl ? (
          // `contain` (not `cover`) so the full CMS product shot shows on the
          // frame rather than being cropped into the `3-2` service-card media
          // ratio. The frame shares the card's `surfaceLight` tint so the
          // transparent-PNG product renders blend seamlessly in both light and
          // dark modes (no dark letterbox box inside the pale card). (#653)
          <Frame
            ratio="3-2"
            fit="contain"
            style={{
              overflow: 'hidden',
              borderRadius: border.radius.md,
              backgroundColor: svc.surfaceLight,
            }}
          >
            <Image src={imageUrl} alt={imageAlt} width={600} height={400} />
          </Frame>
        ) : (
          <ServiceTag category={serviceLine} variant="icon" size="lg" />
        )}

        {/* All panel text uses the line's `-on-light` service ink (`svc.text`),
            which is the contrast-guaranteed pairing for the `surfaceLight`
            surface in BOTH modes — neutral `text-secondary` washes out on the
            saturated dark-mode tint. Hierarchy comes from type scale/weight,
            not color. (#653) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: gap.xs }}>
          {panelLabel && <span style={{ ...label.sm, color: svc.text }}>{panelLabel}</span>}
          <span style={{ ...heading.sm, color: svc.text }}>{value}</span>
          {detail && <span style={{ ...label.sm, color: svc.text }}>{detail}</span>}
          {description && <p style={{ ...text.bodySmall, color: svc.text, marginTop: gap.xs }}>{description}</p>}
        </div>
      </aside>

      <div style={{ flex: '1.6 1 340px', minWidth: 0 }}>{children}</div>
    </div>
  );
}
