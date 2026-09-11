import Image from 'next/image';
import { Button, ServiceTag, type ServiceLine } from '@brikdesigns/bds';
import { TEAM } from '@/lib/team';
import { serviceCtaVars } from '@/lib/tokens';

/**
 * `section-full-stack` (Figma `26144:9109`) — the Full Stack cross-sell that
 * REPLACES the old `.plan-cta-panel` (#1371 delta row 6). Two columns: copy +
 * CTA on the left, an illustration card on the right.
 *
 * Copy is verbatim from the Notion plan page ("Most clients end up going Full
 * Stack."), which is identical across both stand-alone plan pages — the reason
 * migration `00391` deliberately did NOT add a sixth CMS column for it.
 */

/**
 * The brick-wall scatter behind the two portraits, transcribed from Figma's
 * absolute coordinates inside the 576x568 `product-design` frame and expressed
 * as percentages so the illustration scales with its card.
 *
 * `tone` maps Figma's three raw fills onto tokens — the raw
 * `rgba(51,51,51,0.1)` / `rgba(90,90,90,0.2)` values cannot ship (lint:hardcoded),
 * and the two neutral steps read as one light and one mid grey on the card's
 * `--surface-accent` fill:
 *   accent -> --background-service-brand   (Figma's yellow brick)
 *   light  -> --background-muted
 *   mid    -> --surface-neutral
 */
const BRICKS = [
  { x: 337.91, y: 142, tone: 'accent' },
  { x: 447.81, y: 142, tone: 'light' },
  { x: 234.9, y: 142, tone: 'light' },
  { x: 81.09, y: 188.71, tone: 'light' },
  { x: 180.39, y: 188.71, tone: 'light' },
  { x: 281.23, y: 188.71, tone: 'light' },
  { x: 390.21, y: 188.71, tone: 'light' },
  { x: 123.98, y: 238.53, tone: 'mid' },
  { x: 226.73, y: 238.53, tone: 'accent' },
  { x: 329.49, y: 238.53, tone: 'light' },
  { x: 182.63, y: 289.1, tone: 'light' },
  { x: 285.64, y: 289.1, tone: 'mid' },
] as const;

/** Figma's `product-design` frame — the coordinate space BRICKS is measured in. */
const FRAME_W = 576;
const FRAME_H = 568;
const BRICK_W = 87.186;
const BRICK_H = 37.366;

/**
 * The four scattered service marks (Figma `brik-tag-service-product`, nodes
 * `26144:9121/9122/9123/9139`). Figma draws four DIFFERENT Font Awesome glyphs
 * (pen / block / mobile / disc-drive) in ONE brand-yellow fill. `ServiceTag
 * variant="icon"` is the right component — it is BDS's service-line indicator
 * and owns exactly this colored-square-plus-glyph shape — but its glyph is
 * resolved from `(category, serviceName)` against the bundled service-icon set
 * and cannot be overridden, so the four marks carry each line's own glyph and
 * colour rather than four glyphs in one colour. Purely decorative and
 * `aria-hidden`, so the divergence costs nothing semantically.
 */
const MARKS = [
  { x: 85, y: 313, category: 'brand' },
  { x: 240, y: 380, category: 'marketing' },
  { x: 449, y: 408, category: 'product' },
  { x: 350, y: 71, category: 'information' },
] as const;

const PORTRAITS = [
  { name: 'Abbey', x: 72, y: 103 },
  { name: 'Nick', x: 350, y: 251 },
] as const;

const PORTRAIT_SIZE = 124;

export function PlanFullStackPanel({
  href,
  serviceLine,
}: {
  href: string;
  /**
   * The page's audience — only to re-emit the CTA bundle on this band at the
   * SAME hue the page already set, so the declaration below changes the
   * backdrop axis and nothing else.
   */
  serviceLine: ServiceLine;
}) {
  return (
    // `service-surface` is required, not decorative: the band is
    // `--surface-service-brand-light`, which is fixed-LIGHT in both themes,
    // while `--text-primary` flips near-white in the dark root. That class is
    // the sanctioned pin (globals.css) that keeps inherited ink dark on a
    // fixed-light tint — the #360 fixed-on-fixed-light correction.
    //
    // The CTA inside needs the SAME fact declared on its own axis: it inherits
    // the page-level bundle from `.plan-detail-ctas`, whose backdrop is the
    // theme-following page, so in dark mode it flipped to the pale `onDark`
    // step and sat on this pale band at 1.07:1 — a different hue from the
    // band, so byte-identity never saw it, and a button you cannot find all
    // the same (#1404, measured on deploy-preview-1414).
    <section
      className="plan-full-stack service-surface"
      data-section="full-stack"
      style={serviceCtaVars(serviceLine, 'fixed-light')}
    >
      <div className="plan-full-stack__copy">
        <h2 className="plan-full-stack__title">Most clients end up going Full Stack.</h2>
        <p className="plan-full-stack__description">
          Marketing and back office working together is where the real impact happens — your
          marketing brings in leads, your systems make sure none of them fall through. If you
          want both sides covered, Full Stack is built for that.
        </p>
        {/* OPERATOR SAID 2026-09-10 (chat, /resume 1310 session), on Figma's
            "Get Listed As A Brik Partner" label sitting on a Full Stack
            cross-sell: "we'll be introducing a partner page in the future, so
            this will be a dead link for now". Label ships verbatim; `href` is
            the future /partners route and 404s until that page exists. */}
        <Button href={href} variant="primary" size="lg">
          Get Listed As A Brik Partner
        </Button>
      </div>

      {/* Decorative composite: brick scatter + the two founder portraits +
          service marks. Hidden from assistive tech in full — the copy column
          carries every piece of meaning on this band. */}
      <div className="plan-full-stack__media" aria-hidden="true">
        <div className="plan-full-stack__stage">
          {BRICKS.map((brick) => (
            <span
              key={`${brick.x}-${brick.y}`}
              className="plan-full-stack__brick"
              data-tone={brick.tone}
              style={{
                left: `${(brick.x / FRAME_W) * 100}%`,
                top: `${(brick.y / FRAME_H) * 100}%`,
                width: `${(BRICK_W / FRAME_W) * 100}%`,
                height: `${(BRICK_H / FRAME_H) * 100}%`,
              }}
            />
          ))}

          {MARKS.map((mark) => (
            <span
              key={mark.category}
              className="plan-full-stack__mark"
              style={{
                left: `${(mark.x / FRAME_W) * 100}%`,
                top: `${(mark.y / FRAME_H) * 100}%`,
              }}
            >
              <ServiceTag category={mark.category} variant="icon" size="sm" />
            </span>
          ))}

          {PORTRAITS.map((portrait) => {
            // The two portraits ARE Abbey and Nick — Figma exports them as
            // `abbey` and a rotated `Union`, and section-cta's own copy names
            // them ("You work directly with Abbey and Nick"). Sourced from the
            // project's committed headshots rather than the Figma asset URLs,
            // which expire after ~7 days.
            const member = TEAM.find((m) => m.name === portrait.name);
            if (!member) return null;
            return (
              <span
                key={portrait.name}
                className="plan-full-stack__portrait"
                style={{
                  left: `${(portrait.x / FRAME_W) * 100}%`,
                  top: `${(portrait.y / FRAME_H) * 100}%`,
                  width: `${(PORTRAIT_SIZE / FRAME_W) * 100}%`,
                }}
              >
                <Image
                  src={member.image}
                  alt=""
                  width={PORTRAIT_SIZE}
                  height={PORTRAIT_SIZE}
                  sizes="124px"
                />
              </span>
            );
          })}
        </div>
      </div>
    </section>
  );
}
