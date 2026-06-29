import { chromium } from '@playwright/test';

const URL = 'https://deploy-preview-639--brikdesigns.netlify.app/plans/back-office-support';
const browser = await chromium.launch();
const page = await browser.newPage({ colorScheme: 'dark' });
await page.goto(URL, { waitUntil: 'networkidle' });

const out = await page.evaluate(() => {
  const pick = (el, props) => {
    if (!el) return null;
    const cs = getComputedStyle(el);
    const o = { tag: el.tagName, class: el.className };
    for (const p of props) o[p] = cs.getPropertyValue(p).trim();
    return o;
  };
  const title = document.querySelector('.bp-hero-img-card__title');
  const lead = document.querySelector('.bp-hero-img-card__lead');
  const section = document.querySelector('.bp-hero-img-card[data-audience]');
  const wrapper = document.querySelector('.page-hero-blueprint');
  return {
    dataTheme: document.documentElement.getAttribute('data-theme'),
    title: pick(title, ['color', '--bp-hero-img-card-headline-color', '--text-primary', '--text-service-back-office-on-light']),
    lead: pick(lead, ['color', '--bp-hero-img-card-lead-color', '--text-primary']),
    sectionBg: pick(section, ['background-color']),
    wrapperBg: pick(wrapper, ['background-color']),
  };
});
console.log(JSON.stringify(out, null, 2));
await browser.close();
