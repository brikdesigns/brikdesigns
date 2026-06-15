import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * Contact "Book a Call" booking modal a11y — #483 / backlog #242.
 *
 * Mirrors get-started-modal.spec.ts: the BDS Modal returns null while closed,
 * so the public-route load-time gate (public-routes.spec.ts, which covers
 * /contact) structurally never sees it. This spec opens the modal and
 * axe-scans the dialog in BOTH light and dark, and asserts the interactive
 * contract (labelled dialog, ESC-to-close, focus-return).
 *
 * The modal body is a cross-origin LeadConnector booking iframe; axe cannot
 * enter it (its a11y is the vendor's), so the scan covers our dialog chrome +
 * the iframe element — which carries a `title` for an accessible name. The
 * scan runs as soon as the dialog is visible; it does not wait on the
 * external widget to render, keeping the gate deterministic.
 */

const CONTACT_PATH = '/contact';
const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];
const BLOCKING_IMPACTS = new Set(['critical', 'serious']);

async function openModal(page: Page) {
  await page.goto(CONTACT_PATH, { waitUntil: 'load' });
  const trigger = page.getByRole('button', { name: 'Book a Call' });
  await trigger.click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  return { trigger, dialog };
}

test.describe('Contact booking modal — #483', () => {
  test('opens a modal dialog with a visible title', async ({ page }) => {
    const { dialog } = await openModal(page);
    await expect(dialog).toHaveAttribute('aria-modal', 'true');
    await expect(
      dialog.getByRole('heading', { name: /book a call/i }),
    ).toBeVisible();
  });

  test('embeds the booking iframe with an accessible name', async ({ page }) => {
    const { dialog } = await openModal(page);
    await expect(
      dialog.getByTitle('Book a call with Brik Designs'),
    ).toBeVisible();
  });

  // Same BDS default-Modal defect as the get-started modal: the title is
  // rendered but not wired to `aria-labelledby`, so the dialog's programmatic
  // accessible name is empty. Tracked in brik-bds#844; re-enable once shipped
  // and the dep is bumped. #483.
  test.fixme(
    'exposes the title as the dialog accessible name (blocked: brik-bds#844)',
    async ({ page }) => {
      const { dialog } = await openModal(page);
      await expect(dialog).toHaveAccessibleName(/book a call/i);
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
      `New serious/critical violations in the contact booking modal (${theme} theme):\n${blocking.join('\n')}`,
    ).toHaveLength(0);
  });
});
