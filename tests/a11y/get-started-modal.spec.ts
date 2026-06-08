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
 * The modal is new, so it carries no baseline: zero serious/critical in
 * either theme. It also asserts the interactive a11y contract the issue
 * calls for — labelled dialog, ESC-to-close, focus-return on close.
 */

// Representative plan page that renders the cta-panel modal trigger.
const PLAN_PATH = '/plans/marketing-support';
const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];
const BLOCKING_IMPACTS = new Set(['critical', 'serious']);

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
        v.nodes.map(
          (n) =>
            `  [${v.impact}] ${v.id} → ${Array.isArray(n.target) ? n.target.join(' >> ') : String(n.target)}\n    ${v.help}`,
        ),
      );

    expect(
      blocking,
      `New serious/critical violations in the get-started modal (${theme} theme):\n${blocking.join('\n')}`,
    ).toHaveLength(0);
  });
});
