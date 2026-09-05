import { test, expect } from '@playwright/test';
import { gotoRendered, expectMeasured } from './lib/goto-rendered';

/**
 * Card-media gate — brikdesigns.com (#1169).
 *
 * THE enforcement for the card media standard (canonical:
 * .claude/references/card-media.md):
 *
 *   • Media nested in a card renders at --border-radius-md, matching the
 *     card's own corner.
 *   • The media well is filled with --surface-secondary, so transparent or
 *     letterboxed art reads as art on a surface rather than floating on the
 *     card's fill — present whether or not an image loaded.
 *
 * Why this gate exists: the standard was asked for once, delivered as a
 * corner-radius sweep that wrote "all media/hero/figure surfaces keep their
 * 16px radius intentionally" into its own commit body (45433e0), and came back
 * as a fresh operator report two days later (#1168). A CSS rule with no gate is
 * a rule that gets re-litigated.
 *
 * Why measured (computed style) rather than a grep for the CSS rule: what
 * renders is the product of the site rule, the BDS default one layer down
 * (`.bds-card__preset-display-media img` ships at --border-radius-sm), and any
 * per-page override. Only reading the rendered value on every card on every
 * route catches a page that quietly re-tints its own media well — which is
 * exactly what the home Services grid was doing (--background-accent) before
 * this standard landed.
 *
 * Scope — card-nested media only. Heroes, media bands, the tooling ticker, and
 * testimonial rows are NOT cards and are deliberately not swept; the standard
 * is about media that sits inside a card's corner.
 *
 * Coverage caveat, stated rather than silent: the derived selector reaches BDS
 * <Card> / <PricingCard> media slots. Hand-built card blocks are plain divs, so
 * nothing about their structure marks them as card media — they join the
 * standard by name and this gate names them back (HAND_BUILT below). Only the
 * blocks listed in .claude/references/card-media.md are on the standard today;
 * roughly a dozen more are enumerated in #1175, which migrates them onto BDS
 * <Card> so both lists can go away.
 *
 * Runs light + dark via the two Playwright projects (see playwright.config.ts).
 */

// Routes that render at least one BDS card with a media slot. Kept in sync with
// card-treatment.spec.ts ROUTES — a subset, because not every carded route has
// card media.
const ROUTES: { path: string; name: string }[] = [
  { path: '/', name: 'Home' },
  { path: '/services', name: 'Services index' },
  { path: '/services/brand', name: 'Service line — brand' },
  { path: '/plans', name: 'Plans' },
  // Plan detail — the "What You Get" service cards are BDS <Card variant="outlined">
  // with a <Frame> media slot, so they already inherit the derived standard
  // (#1191, Tier 2 of #1175). Route added to lock that in. plan-cta-panel media
  // is a documented sibling-media exception (card-media.md), so it is not swept.
  { path: '/plans/back-office-support', name: 'Plan detail' },
  // blog-card migrated onto BDS <Card> + <Frame> (#1175), so /blog now renders
  // derived-standard card media the gate can sweep.
  { path: '/blog', name: 'Blog index' },
];

interface MediaFinding {
  card: string;
  section: string;
  radius: string;
  fill: string;
  reason: string;
}

test.describe('Card-media standard — radius + well', () => {
  for (const route of ROUTES) {
    test(`${route.name} (${route.path}) card media follows the standard`, async ({
      page,
    }, testInfo) => {
      const isDark = testInfo.project.name.endsWith('-dark');
      await gotoRendered(page, route.path, { waitUntil: 'load' });

      const { findings, measured, expected } = await page.evaluate(() => {
        // Resolve the two standard values off the live root rather than
        // hard-coding 12px / #f2f2f2 — the gate then follows a token change
        // instead of failing on one.
        const probe = document.createElement('div');
        probe.style.borderRadius = 'var(--border-radius-md)';
        probe.style.backgroundColor = 'var(--surface-secondary)';
        document.body.appendChild(probe);
        const probeCs = getComputedStyle(probe);
        const wantRadius = probeCs.borderRadius;
        const wantFill = probeCs.backgroundColor;
        probe.remove();

        const norm = (v: string) => v.replace(/\s+/g, '').toLowerCase();

        // Derived, not enumerated: any Frame inside any card. A new card grid
        // is swept with no edit here (the point of #1170).
        //
        // The second selector is the hand-built opt-in list. Those blocks are
        // plain divs, not BDS cards, so nothing about their structure marks
        // them as card media — they are on the standard by name, so the gate
        // has to name them too. Keep this list identical to the table in
        // .claude/references/card-media.md; #1175 empties both by migrating
        // the blocks onto BDS <Card>.
        const HAND_BUILT = '.plans-card-wrapper__media';

        const frames = Array.from(
          document.querySelectorAll(
            `.bds-card .bds-frame, .bds-pricing-card .bds-frame, ${HAND_BUILT}`,
          ),
        ) as HTMLElement[];

        const out: MediaFinding[] = [];
        for (const frame of frames) {
          const cs = getComputedStyle(frame);
          const reasons: string[] = [];
          if (norm(cs.borderRadius) !== norm(wantRadius)) {
            reasons.push(`radius ${cs.borderRadius}, want ${wantRadius}`);
          }
          if (norm(cs.backgroundColor) !== norm(wantFill)) {
            reasons.push(`well ${cs.backgroundColor}, want ${wantFill}`);
          }

          // The image must not round tighter than the well it sits in — the
          // frame clips, so a smaller radius shows four slivers of the well
          // through the image's corners. This is the BDS default (radius-sm)
          // leaking through when the site rule is missing or out-scoped.
          const media = frame.querySelector('img, video, svg');
          if (media) {
            const ms = getComputedStyle(media);
            if (norm(ms.borderRadius) !== norm(wantRadius)) {
              reasons.push(`image radius ${ms.borderRadius}, want ${wantRadius}`);
            }
          }

          if (reasons.length === 0) continue;

          const card = frame.closest('.bds-card, .bds-pricing-card, .plans-card-wrapper');
          const section = frame.closest('section');
          out.push({
            card: card?.className ?? '(no card)',
            section:
              section?.getAttribute('data-section') ??
              section?.getAttribute('aria-labelledby') ??
              section?.className ??
              '(no section)',
            radius: cs.borderRadius,
            fill: cs.backgroundColor,
            reason: reasons.join('; '),
          });
        }
        return {
          findings: out,
          measured: frames.length,
          expected: { radius: wantRadius, fill: wantFill },
        };
      });

      // A clean sweep only means something if there was something to sweep
      // (#1036 — a missing CMS slug renders an empty <main> with HTTP 200).
      expectMeasured(measured, route.path, 'card media frames');

      if (findings.length > 0) {
        const summary = findings
          .map(
            (f) =>
              `  ${f.reason}\n    card: .${f.card.split(' ').join('.')}\n    section: ${f.section}`,
          )
          .join('\n');
        expect(
          findings,
          `Card media violating the standard on ${route.path} (${isDark ? 'dark' : 'light'}):\n${summary}\n\n` +
            `Standard: media nested in a card renders at --border-radius-md (${expected.radius})\n` +
            `on a --surface-secondary well (${expected.fill}).\n` +
            `Fix in the "Card media standard" block in shared-sections.css, not per page —\n` +
            `a per-page media fill is what this gate exists to catch.\n` +
            `See .claude/references/card-media.md.`,
        ).toHaveLength(0);
      }
    });
  }
});
