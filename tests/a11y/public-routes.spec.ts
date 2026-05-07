import fs from 'node:fs';
import path from 'node:path';
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * Public-route WCAG 2.1 AA audit — brikdesigns.com.
 *
 * Pattern adapted from the canonical birdwell-mutlak a11y test (which was
 * itself ported from brik-client-portal). Adapted for Next.js App Router:
 *
 * - No auth seeding — the entire marketing surface is public. Admin routes
 *   under /admin are gated by Supabase auth and out of scope for this gate.
 * - Routes list mirrors src/app/sitemap.ts for static pages, plus one
 *   representative dynamic instance per [slug] route family.
 * - Tests run against `next dev` locally or the Netlify deploy-preview in
 *   CI (per playwright.config.ts).
 *
 * Compliance reference: @brikdesigns/bds/content-system/compliance/
 *   healthcare-ada.md §6b — fail on serious/critical, warn on
 *   moderate/minor. Baseline file allows pre-existing debt and is burned
 *   down on its own cadence (see tests/a11y/README.md).
 */

const PUBLIC_ROUTES: { path: string; name: string }[] = [
  { path: '/', name: 'Home' },
  { path: '/about', name: 'About' },
  { path: '/services', name: 'Services index' },
  { path: '/services/brand', name: 'Service line — brand' },
  { path: '/services/brand/logo-design', name: 'Service detail — logo design' },
  { path: '/plans', name: 'Plans' },
  { path: '/industries', name: 'Industries index' },
  { path: '/industries/dental', name: 'Industry detail — dental' },
  { path: '/customer-stories', name: 'Customer stories index' },
  { path: '/customers', name: 'Customers' },
  { path: '/blog', name: 'Blog index' },
  { path: '/contact', name: 'Contact' },
  { path: '/get-started', name: 'Get started' },
  { path: '/free-marketing-analysis', name: 'Free marketing analysis' },
  { path: '/value', name: 'Value' },
  { path: '/privacy-policy', name: 'Privacy policy' },
];

// WCAG 2.1 AA tags — locked to the standard. Don't silently bump to 2.2 or
// AAA without a per-rule review.
const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

const BLOCKING_IMPACTS = new Set(['critical', 'serious']);

interface BaselineFile {
  routes: Record<string, Record<string, string[]>>;
}

const BASELINE_PATH = path.join(process.cwd(), 'tests/a11y/baseline.json');
const baseline: BaselineFile = JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf8'));

function isBaselined(routePath: string, ruleId: string, selector: string): boolean {
  const allowedSelectors = baseline.routes[routePath]?.[ruleId];
  if (!allowedSelectors) return false;
  return allowedSelectors.includes(selector);
}

test.describe('Public routes — WCAG 2.1 AA audit', () => {
  for (const route of PUBLIC_ROUTES) {
    test(`${route.name} (${route.path}) has no new serious or critical violations`, async ({ page }, testInfo) => {
      // 'load' rather than 'networkidle' — networkidle is fragile on modern
      // sites with continuous network activity (lazy images, analytics).
      // 'load' waits for CSS + images, which is what axe needs for first-
      // paint contrast / alt-text rules.
      await page.goto(route.path, { waitUntil: 'load' });

      // Exclude Netlify deploy-preview admin overlays.
      const results = await new AxeBuilder({ page })
        .withTags(AXE_TAGS)
        .exclude('iframe[title="Netlify Drawer"]')
        .analyze();

      type FlatFinding = {
        ruleId: string;
        impact: string;
        help: string;
        selector: string;
        failureSummary: string;
      };
      const flatFindings: FlatFinding[] = results.violations.flatMap((v) =>
        v.nodes.map((n) => ({
          ruleId: v.id,
          impact: v.impact ?? 'unknown',
          help: v.help,
          selector: Array.isArray(n.target) ? n.target.join(' >> ') : String(n.target),
          failureSummary: n.failureSummary ?? '',
        })),
      );

      const blocking = flatFindings.filter(
        (f) => BLOCKING_IMPACTS.has(f.impact) && !isBaselined(route.path, f.ruleId, f.selector),
      );
      const baselined = flatFindings.filter(
        (f) => BLOCKING_IMPACTS.has(f.impact) && isBaselined(route.path, f.ruleId, f.selector),
      );
      const nonBlocking = flatFindings.filter((f) => !BLOCKING_IMPACTS.has(f.impact));

      // Attach the full report so failures are debuggable from CI.
      await testInfo.attach(`axe-report-${route.path.replace(/\//g, '_') || 'home'}.json`, {
        body: JSON.stringify({ blocking, baselined, nonBlocking, total: flatFindings.length }, null, 2),
        contentType: 'application/json',
      });

      if (blocking.length > 0) {
        const summary = blocking
          .map((f) => `  [${f.impact}] ${f.ruleId} → ${f.selector}\n    ${f.help}`)
          .join('\n');
        expect(blocking, `New serious/critical violations on ${route.path}:\n${summary}`).toHaveLength(0);
      }
    });
  }
});
