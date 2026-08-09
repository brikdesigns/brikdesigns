// Which image never completes on /services/marketing at tablet? Reports the
// properties that decide whether it CAN complete. Deleted after use.
import { chromium } from '@playwright/test';

const browser = await chromium.launch();
for (const theme of ['light', 'dark']) {
  const ctx = await browser.newContext({
    viewport: { width: 768, height: 1024 },
    reducedMotion: 'reduce',
    colorScheme: theme,
  });
  const page = await ctx.newPage();
  await page.goto('https://staging--brikdesigns.netlify.app/services/marketing', {
    waitUntil: 'domcontentloaded', timeout: 60000,
  });
  await page.evaluate(async () => {
    const h = document.body.scrollHeight;
    for (let y = 0; y < h; y += 600) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 100)); }
    window.scrollTo(0, 0);
    await new Promise((r) => setTimeout(r, 400));
  });
  await new Promise((r) => setTimeout(r, 20000));
  const report = await page.evaluate(() => {
    const imgs = Array.from(document.images);
    return {
      total: imgs.length,
      pending: imgs.filter((i) => !i.complete).map((i) => {
        const r = i.getBoundingClientRect();
        const cs = getComputedStyle(i);
        return {
          src: (i.currentSrc || i.getAttribute('src') || '(none)').slice(-60),
          loading: i.loading,
          box: `${Math.round(r.width)}x${Math.round(r.height)}`,
          rects: i.getClientRects().length,
          display: cs.display,
          visibility: cs.visibility,
          offsetParentNull: i.offsetParent === null,
          naturalWidth: i.naturalWidth,
          parentClass: (i.parentElement?.className || '').toString().slice(0, 60),
        };
      }),
    };
  });
  console.log(`[${theme}] ${report.total} imgs, ${report.pending.length} pending after 20s`);
  report.pending.forEach((p) => console.log('   ', JSON.stringify(p)));
  await ctx.close();
}
await browser.close();
