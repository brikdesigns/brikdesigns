import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * Get-started modal a11y — #401.
 *
 * The public-route gate (public-routes.spec.ts) scans pages at load. The
 * get-started Modal renders nothing until its trigger is clicked (the BDS
 * Modal returns null while closed), so that gate structurally never sees it.
 * This spec opens the modal on a representative plan page and axe-scans the
 * dialog in BOTH the light and dark projects — the dark pass is the one the
 * load-time scan can't cover, and the surface this class of bug hides on
 * (the #360 fixed-light `--surface-service-*` gotcha: dark-mode contrast
 * regressions are invisible to a light-only scan).
 *
 * Baseline: zero serious/critical in either theme EXCEPT the BDS-22
 * owner-accepted white-on-vibrant-Poppy submit-button debt (see CONTRAST_DEBT
 * below; tracked brik-bds#479). NEW violations still fail. It also asserts the
 * interactive a11y contract the issue calls for — labelled dialog, ESC-to-close,
 * focus-return on close.
 */

// Representative plan page that renders the cta-panel modal trigger.
const PLAN_PATH = '/plans/marketing-support';
const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];
const BLOCKING_IMPACTS = new Set(['critical', 'serious']);

// BDS-22 / ADR-015 debt allowlist — per-(theme, rule, selector), mirroring the
// public-routes baseline discipline (tests/a11y/README.md: per-selector only,
// never disableRules whole-app). The modal's submit button renders a white
// label on the vibrant Poppy fill (--background-brand-primary = poppy-light
// #e35335, 3.78:1 at 16px normal weight) — the deliberate owner-accepted
// white-on-red CTA debt from BDS-22 (brik-bds@0.114.0 reverted the fill
// poppy-dark→poppy-light). This spec is otherwise a hard-zero gate; the
// allowlist keeps NEW violations blocking. Burn-down: dark label on the fill,
// bold + >=18.66px label (AA-large), or an intermediate AA-passing Poppy step
// (brik-bds BDS-20 scale). Tracked: brik-bds#479.
const MODAL_SUBMIT_BTN =
  '.bds-modal__body > div > div > form > .bds-button--full-width.bds-button--lg[type="submit"] > .bds-button__content';
const CONTRAST_DEBT: Record<'light' | 'dark', Record<string, string[]>> = {
  light: { 'color-contrast': [MODAL_SUBMIT_BTN] },
  dark: { 'color-contrast': [MODAL_SUBMIT_BTN] },
};
const normalizeSelector = (s: string): string =>
  s.replace(/:nth-child\(\d+\)/g, '').replace(/:nth-of-type\(\d+\)/g, '').trim();
const isModalBaselined = (theme: 'light' | 'dark', ruleId: string, selector: string): boolean =>
  (CONTRAST_DEBT[theme][ruleId] ?? []).map(normalizeSelector).includes(normalizeSelector(selector));

async function openModal(page: Page) {
  await page.goto(PLAN_PATH, { waitUntil: 'load' });
  // The cta-panel trigger is a <button> ("Get Started"); the hero CTA is an
  // <a> (url-only, brik-bds#843), so role=button matches only the trigger.
  const trigger = page.getByRole('button', { name: 'Get Started' });
  await trigger.click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  return { trigger, dialog };
}

test.describe('Get-started modal — #401', () => {
  test('opens a modal dialog with a visible title', async ({ page }) => {
    const { dialog } = await openModal(page);
    await expect(dialog).toHaveAttribute('aria-modal', 'true');
    await expect(
      dialog.getByRole('heading', { name: /get started/i }),
    ).toBeVisible();
  });

  // The dialog's title is rendered but not wired to `aria-labelledby`, so its
  // programmatic accessible name is empty — a BDS default-Modal defect with no
  // consumer-side fix (no aria-label passthrough). Tracked in brik-bds#844;
  // re-enable this assertion once that ships and the dep is bumped. #401.
  test.fixme(
    'exposes the title as the dialog accessible name (blocked: brik-bds#844)',
    async ({ page }) => {
      const { dialog } = await openModal(page);
      await expect(dialog).toHaveAccessibleName(/get started/i);
    },
  );

  test('ESC closes the modal and returns focus to the trigger', async ({ page }) => {
    const { trigger, dialog } = await openModal(page);
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  test('no serious/critical axe violations in the open dialog', async ({ page }, testInfo) => {
    const theme = testInfo.project.name.endsWith('-dark') ? 'dark' : 'light';
    await openModal(page);

    const results = await new AxeBuilder({ page })
      .include('[role="dialog"]')
      .withTags(AXE_TAGS)
      .analyze();

    const blocking = results.violations
      .filter((v) => BLOCKING_IMPACTS.has(v.impact ?? ''))
      .flatMap((v) =>
        v.nodes.map((n) => ({
          impact: v.impact,
          ruleId: v.id,
          help: v.help,
          selector: Array.isArray(n.target) ? n.target.join(' >> ') : String(n.target),
        })),
      )
      // Drop the BDS-22 owner-accepted contrast debt (see CONTRAST_DEBT above);
      // NEW serious/critical violations still fail this gate.
      .filter((f) => !isModalBaselined(theme, f.ruleId, f.selector))
      .map((f) => `  [${f.impact}] ${f.ruleId} → ${f.selector}\n    ${f.help}`);

    expect(
      blocking,
      `New serious/critical violations in the get-started modal (${theme} theme):\n${blocking.join('\n')}`,
    ).toHaveLength(0);
  });
});
