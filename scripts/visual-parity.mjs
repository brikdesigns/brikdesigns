#!/usr/bin/env node
import { chromium } from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';

const WEBFLOW_URL = process.env.WEBFLOW_URL ?? 'https://www.brikdesigns.com';
const NETLIFY_URL = process.env.NETLIFY_URL ?? process.argv[2];
const OUT = path.resolve('tests/visual-parity/screenshots');

// Routes with diff % above this value are flagged. Set to 0 to disable hard failure.
const DIFF_THRESHOLD = parseFloat(process.env.DIFF_THRESHOLD ?? '0');

if (!NETLIFY_URL) {
  console.error(
    'Usage: NETLIFY_URL=https://deploy-preview-N--brikdesigns.netlify.app npm run visual-parity\n' +
    '   or: npm run visual-parity -- https://deploy-preview-N--brikdesigns.netlify.app'
  );
  process.exit(2);
}

const ROUTES = [
  { netlify: '/', webflow: '/', name: 'home' },
  { netlify: '/about', webflow: '/about', name: 'about' },
  { netlify: '/services', webflow: '/services', name: 'services' },
  { netlify: '/services/marketing', webflow: '/service-lines/marketing-design', name: 'services-category-marketing' },
  { netlify: '/services/marketing/website-experience-mapping', webflow: '/service/website-experience-mapping', name: 'services-detail-website-experience-mapping' },
  { netlify: '/plans', webflow: '/plans', name: 'plans' },
  { netlify: '/customer-stories', webflow: '/customer-stories', name: 'customer-stories' },
  { netlify: '/customers', webflow: '/customers', name: 'customers' },
  { netlify: '/industries/dental', webflow: '/customers/dental', name: 'industry-dental' },
  { netlify: '/blog', webflow: '/blog', name: 'blog' },
  { netlify: '/contact', webflow: '/contact', name: 'contact' },
  { netlify: '/free-marketing-analysis', webflow: '/brikdown-analysis', name: 'fma' },
  { netlify: '/value', webflow: '/value', name: 'value' },
];

const VIEWPORTS = [
  { name: 'desktop', width: 1280, height: 800 },
  { name: 'tablet',  width: 768,  height: 1024 },
  { name: 'mobile',  width: 375,  height: 812 },
];

const THEMES = (process.env.THEMES ?? 'light,dark').split(',').map((t) => t.trim());

console.log(`▸ webflow:    ${WEBFLOW_URL}`);
console.log(`▸ netlify:    ${NETLIFY_URL}`);
console.log(`▸ themes:     ${THEMES.join(', ')}`);
console.log(`▸ threshold:  ${DIFF_THRESHOLD > 0 ? `${DIFF_THRESHOLD}%` : 'off (set DIFF_THRESHOLD to enable)'}`);
console.log(`▸ output:     ${OUT}`);

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();

async function captureOnce(baseUrl, route, viewport, theme, outPath, timeoutMs) {
  const colorScheme = theme === 'dark' ? 'dark' : 'light';
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    reducedMotion: 'reduce',
    colorScheme,
  });
  const page = await context.newPage();
  await page.addInitScript((t) => {
    try { localStorage.setItem('theme', t); } catch (e) {}
  }, theme);
  try {
    await page.goto(baseUrl + route, { waitUntil: 'domcontentloaded', timeout: timeoutMs });
    // Wait for paint, scroll through to trigger lazy images / scroll-reveals,
    // then back to top. `domcontentloaded` + a scroll pass is more robust than
    // `load`, which Netlify deploy previews can take >60s to fire.
    await page.evaluate(async () => {
      await new Promise((r) => requestAnimationFrame(r));
      const h = document.body.scrollHeight;
      for (let y = 0; y < h; y += 600) {
        window.scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 100));
      }
      window.scrollTo(0, 0);
      await new Promise((r) => setTimeout(r, 400));
    });
    await page.screenshot({ path: outPath, fullPage: true, animations: 'disabled' });
    return { ok: true };
  } catch (err) {
    return { ok: false, err };
  } finally {
    await page.close();
    await context.close();
  }
}

async function capture(baseUrl, route, viewport, theme, outPath) {
  // First attempt with normal headroom; one retry on failure with extra time.
  let result = await captureOnce(baseUrl, route, viewport, theme, outPath, 60000);
  if (!result.ok) {
    await new Promise((r) => setTimeout(r, 1500));
    result = await captureOnce(baseUrl, route, viewport, theme, outPath, 90000);
  }
  if (!result.ok) {
    console.warn(`  ✗ ${baseUrl}${route} [${viewport.name}/${theme}]: ${result.err.message.split('\n')[0]}`);
    fs.writeFileSync(outPath.replace(/\.png$/, '.error.txt'), String(result.err));
  }
}

// Returns { diffPct, diffImg } where diffImg is the relative path to the diff PNG,
// or null if one/both screenshots are missing.
function diffScreenshots(wfPath, nlPath, diffPath) {
  if (!fs.existsSync(wfPath) || !fs.existsSync(nlPath)) return null;

  const wf = PNG.sync.read(fs.readFileSync(wfPath));
  const nl = PNG.sync.read(fs.readFileSync(nlPath));

  // Pad the shorter image at the bottom so dimensions match for pixelmatch.
  const w = Math.max(wf.width, nl.width);
  const h = Math.max(wf.height, nl.height);

  function pad(src) {
    if (src.width === w && src.height === h) return src;
    const out = new PNG({ width: w, height: h, filterType: -1 });
    // Fill with white
    out.data.fill(255);
    for (let y = 0; y < src.height; y++) {
      for (let x = 0; x < src.width; x++) {
        const si = (y * src.width + x) * 4;
        const di = (y * w + x) * 4;
        out.data[di]     = src.data[si];
        out.data[di + 1] = src.data[si + 1];
        out.data[di + 2] = src.data[si + 2];
        out.data[di + 3] = src.data[si + 3];
      }
    }
    return out;
  }

  const a = pad(wf);
  const b = pad(nl);
  const diff = new PNG({ width: w, height: h });

  const mismatch = pixelmatch(a.data, b.data, diff.data, w, h, { threshold: 0.1 });
  fs.writeFileSync(diffPath, PNG.sync.write(diff));

  const diffPct = (mismatch / (w * h)) * 100;
  return { diffPct, diffImg: path.relative(OUT, diffPath) };
}

const results = [];
for (const theme of THEMES) {
  for (const viewport of VIEWPORTS) {
    const dir = path.join(OUT, theme, viewport.name);
    fs.mkdirSync(dir, { recursive: true });
    for (const route of ROUTES) {
      const wfPath  = path.join(dir, `${route.name}-webflow.png`);
      const nlPath  = path.join(dir, `${route.name}-netlify.png`);
      const diffPath = path.join(dir, `${route.name}-diff.png`);
      console.log(`▸ ${theme}/${viewport.name}: ${route.name}`);
      await capture(WEBFLOW_URL, route.webflow, viewport, theme, wfPath);
      await capture(NETLIFY_URL, route.netlify, viewport, theme, nlPath);
      const diff = diffScreenshots(wfPath, nlPath, diffPath);
      if (diff) {
        const flag = diff.diffPct > 5 ? '🔴' : diff.diffPct > 2 ? '🟡' : '🟢';
        console.log(`  ${flag} diff: ${diff.diffPct.toFixed(2)}%`);
      }
      results.push({
        theme,
        viewport: viewport.name,
        route: route.name,
        webflowPath: route.webflow,
        netlifyPath: route.netlify,
        wfImg: path.relative(OUT, wfPath),
        nlImg: path.relative(OUT, nlPath),
        diffImg: diff?.diffImg ?? null,
        diffPct: diff?.diffPct ?? null,
        wfOk: fs.existsSync(wfPath),
        nlOk: fs.existsSync(nlPath),
      });
    }
  }
}

await browser.close();

// Console diff summary, sorted worst-first
const diffed = results.filter((r) => r.diffPct !== null);
if (diffed.length) {
  console.log('\n── Diff summary (worst first) ──────────────────');
  [...diffed]
    .sort((a, b) => b.diffPct - a.diffPct)
    .forEach((r) => {
      const flag = r.diffPct > 5 ? '🔴' : r.diffPct > 2 ? '🟡' : '🟢';
      console.log(`  ${flag} ${r.diffPct.toFixed(2).padStart(6)}%  ${r.route} [${r.theme}/${r.viewport}]`);
    });
  console.log('────────────────────────────────────────────────');
}

// HTML report
function diffColor(pct) {
  if (pct === null) return '#888';
  if (pct > 5)  return '#b00';
  if (pct > 2)  return '#b6800a';
  return '#1a7f37';
}

function diffLabel(pct) {
  if (pct === null) return '—';
  const flag = pct > 5 ? '🔴' : pct > 2 ? '🟡' : '🟢';
  return `${flag} ${pct.toFixed(2)}%`;
}

const reportPath = path.join(OUT, 'index.html');
const html = `<!doctype html>
<meta charset="utf-8">
<title>Visual parity — Webflow vs Netlify</title>
<style>
  body { margin: 0; font: 14px/1.5 -apple-system, system-ui, sans-serif; background: #f6f6f6; color: #111; }
  header { padding: 16px 20px; background: #111; color: #fff; position: sticky; top: 0; z-index: 10; }
  header h1 { margin: 0 0 6px; font-size: 18px; }
  header .meta { font-size: 12px; opacity: .7; }
  nav { padding: 12px 20px; background: #fff; border-bottom: 1px solid #ddd; position: sticky; top: 60px; z-index: 9; }
  nav a { margin-right: 12px; color: #0366d6; text-decoration: none; font-size: 13px; }
  nav a:hover { text-decoration: underline; }
  section { padding: 24px 20px; border-bottom: 1px solid #ddd; }
  section h2 { margin: 0 0 4px; font-size: 16px; display: flex; align-items: center; gap: 12px; }
  section .paths { margin: 0 0 14px; font-size: 12px; color: #666; }
  .trio { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; }
  .pane { background: #fff; border: 1px solid #ddd; border-radius: 4px; overflow: hidden; }
  .pane h3 { margin: 0; padding: 8px 12px; font-size: 12px; background: #fafafa; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; align-items: center; }
  .pane img { display: block; width: 100%; height: auto; }
  .pane.error { padding: 24px; color: #b00; text-align: center; }
  .diff-badge { font-weight: 700; }
  .filter-bar { padding: 12px 20px; background: #fff; border-bottom: 1px solid #ddd; }
  .filter-bar label { margin-right: 16px; font-size: 13px; }
  .summary-table { width: 100%; border-collapse: collapse; font-size: 13px; }
  .summary-table th { text-align: left; padding: 6px 10px; background: #f0f0f0; border-bottom: 2px solid #ddd; }
  .summary-table td { padding: 5px 10px; border-bottom: 1px solid #eee; }
  .summary-table tr:hover td { background: #fafafa; }
</style>
<header>
  <h1>Visual parity — Webflow vs Netlify</h1>
  <div class="meta">webflow: ${WEBFLOW_URL} · netlify: ${NETLIFY_URL} · captured ${new Date().toISOString()}</div>
</header>
<div class="filter-bar">
  <label>Theme: <select id="theme-filter"><option value="all">all</option>${THEMES.map((t) => `<option value="${t}">${t}</option>`).join('')}</select></label>
  <label>Viewport: <select id="viewport-filter"><option value="all">all</option>${VIEWPORTS.map((v) => `<option value="${v.name}">${v.name}</option>`).join('')}</select></label>
  <label>Show: <select id="diff-filter"><option value="all">all</option><option value="red">🔴 &gt;5%</option><option value="yellow">🟡 2–5%</option><option value="green">🟢 &lt;2%</option></select></label>
</div>
<nav>${results
  .filter((r, i, a) => a.findIndex((x) => x.route === r.route) === i)
  .map((r) => `<a href="#${r.route}">${r.route}</a>`)
  .join(' ')}</nav>

<section style="background:#fff;border-bottom:2px solid #ddd;">
  <h2>Diff summary</h2>
  <table class="summary-table">
    <thead><tr><th>Route</th><th>Theme</th><th>Viewport</th><th>Diff %</th></tr></thead>
    <tbody>
      ${[...results]
        .filter((r) => r.diffPct !== null)
        .sort((a, b) => b.diffPct - a.diffPct)
        .map((r) => `<tr>
          <td><a href="#${r.route}-${r.theme}-${r.viewport}">${r.route}</a></td>
          <td>${r.theme}</td>
          <td>${r.viewport}</td>
          <td style="color:${diffColor(r.diffPct)};font-weight:700">${diffLabel(r.diffPct)}</td>
        </tr>`).join('')}
    </tbody>
  </table>
</section>

${results
  .map(
    (r) => `
<section data-theme="${r.theme}" data-viewport="${r.viewport}" data-diff="${r.diffPct !== null ? (r.diffPct > 5 ? 'red' : r.diffPct > 2 ? 'yellow' : 'green') : 'none'}" id="${r.route}-${r.theme}-${r.viewport}">
  <h2>${r.route} — ${r.theme} / ${r.viewport} <span class="diff-badge" style="color:${diffColor(r.diffPct)}">${diffLabel(r.diffPct)}</span></h2>
  <p class="paths">webflow: <code>${r.webflowPath}</code> · netlify: <code>${r.netlifyPath}</code></p>
  <div class="trio">
    <div class="pane${r.wfOk ? '' : ' error'}">
      <h3>Webflow (target)</h3>
      ${r.wfOk ? `<img loading="lazy" src="${r.wfImg}">` : 'Capture failed'}
    </div>
    <div class="pane${r.nlOk ? '' : ' error'}">
      <h3>Netlify (build)</h3>
      ${r.nlOk ? `<img loading="lazy" src="${r.nlImg}">` : 'Capture failed'}
    </div>
    <div class="pane${r.diffImg ? '' : ' error'}">
      <h3>Diff <span class="diff-badge" style="color:${diffColor(r.diffPct)}">${diffLabel(r.diffPct)}</span></h3>
      ${r.diffImg ? `<img loading="lazy" src="${r.diffImg}">` : 'Diff unavailable'}
    </div>
  </div>
</section>`
  )
  .join('')}
<script>
  const themeF = document.getElementById('theme-filter');
  const vpF = document.getElementById('viewport-filter');
  const diffF = document.getElementById('diff-filter');
  function apply() {
    const t = themeF.value, v = vpF.value, d = diffF.value;
    document.querySelectorAll('section[data-theme]').forEach((s) => {
      const ok = (t === 'all' || s.dataset.theme === t)
               && (v === 'all' || s.dataset.viewport === v)
               && (d === 'all' || s.dataset.diff === d);
      s.style.display = ok ? '' : 'none';
    });
  }
  themeF.onchange = vpF.onchange = diffF.onchange = apply;
</script>
`;
fs.writeFileSync(reportPath, html);

const okCount = results.filter((r) => r.wfOk && r.nlOk).length;
const avgDiff = diffed.length
  ? (diffed.reduce((s, r) => s + r.diffPct, 0) / diffed.length).toFixed(2)
  : '—';
const worstDiff = diffed.length
  ? Math.max(...diffed.map((r) => r.diffPct)).toFixed(2)
  : '—';

console.log(`\n✓ ${okCount}/${results.length} captures complete`);
console.log(`▸ avg diff: ${avgDiff}%  |  worst: ${worstDiff}%`);
console.log(`▸ open ${reportPath}`);

// Hard failure gate — only active when DIFF_THRESHOLD is set
if (DIFF_THRESHOLD > 0) {
  const failing = diffed.filter((r) => r.diffPct > DIFF_THRESHOLD);
  if (failing.length) {
    console.error(`\n✗ ${failing.length} route(s) exceed DIFF_THRESHOLD of ${DIFF_THRESHOLD}%:`);
    failing.forEach((r) => console.error(`  ${r.diffPct.toFixed(2)}%  ${r.route} [${r.theme}/${r.viewport}]`));
    process.exit(1);
  }
}
