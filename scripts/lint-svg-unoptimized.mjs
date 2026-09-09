#!/usr/bin/env node
// Fails CI when a `next/image` <Image> with an SVG `src` omits `unoptimized`.
//
// An SVG routed through `/_next/image?url=….svg&w=128&q=75` is rasterized by
// the image CDN — a transform that buys nothing (a vector resizes losslessly)
// and is the step the visual-regression gate flakes on. The one capture failure
// among 28 post-#1162 regression reds was exactly this: `Brik-logo.svg` failing
// `decode()` on BOTH capture attempts, reddening a blocking gate on a route the
// PR never touched (brikdesigns#830, run 34282305048).
//
// The header and footer logos render on every route, which is why that flake
// roamed across routes instead of staying on the page it was first reported on.
//
// Next's own docs recommend `unoptimized` for a known-SVG `src` and say it
// applies automatically when the src ends in `.svg`
// (https://nextjs.org/docs/app/api-reference/components/image#unoptimized).
// That automatic path does NOT fire on next@16.2.11 — the live staging HTML
// still requested the raster transform — so the prop has to be explicit, and
// this guard exists because the next SVG <Image> someone adds will silently
// reintroduce a sitewide capture flake with no error at build or run time.
//
// Scope: `.tsx` under src/. A raw <img> is not checked — it never reaches the
// optimizer. A dynamic `src` is checked whenever any literal in the expression
// ends in `.svg`, which covers the theme ternary in MegaNav.
//
// Usage:
//   npm run lint:svg-unoptimized
// Self-test:
//   npm run test:lint:svg-unoptimized

import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

export const SRC_DIR = 'src';

/** Every `.tsx` file under `dir`, recursively. */
export function tsxFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) return tsxFiles(full);
    return e.isFile() && full.endsWith('.tsx') ? [full] : [];
  });
}

/**
 * Split `source` into the text of each `<Image …/>` element.
 * Self-closing only, which is every usage of next/image — a paired
 * `<Image>…</Image>` is not valid for this component.
 */
export function imageElements(source) {
  const out = [];
  const open = /<Image[\s/>]/g;
  let m;
  while ((m = open.exec(source)) !== null) {
    const end = source.indexOf('/>', m.index);
    if (end === -1) continue;
    out.push(source.slice(m.index, end + 2));
  }
  return out;
}

/** An element is a finding when its src names an .svg and `unoptimized` is absent. */
export function isUnguardedSvgImage(element) {
  const src = /\bsrc\s*=\s*(?:"([^"]*)"|'([^']*)'|\{([\s\S]*?)\})/.exec(element);
  if (!src) return false;
  const value = src[1] ?? src[2] ?? src[3] ?? '';
  if (!/\.svg\b/i.test(value)) return false;
  return !/\bunoptimized\b/.test(element);
}

/** Findings as `{ file, src }`, one per offending <Image>. */
export function findUnguardedSvgImages(dir) {
  return tsxFiles(dir).flatMap((file) => {
    const source = fs.readFileSync(file, 'utf8');
    return imageElements(source)
      .filter(isUnguardedSvgImage)
      .map((el) => ({ file, src: /\bsrc\s*=\s*([^\n]*)/.exec(el)?.[1]?.trim() ?? '?' }));
  });
}

function main() {
  const files = tsxFiles(SRC_DIR);

  // No .tsx anywhere means the tree moved and every check below passes
  // vacuously — the failure mode that makes a gate worthless.
  if (files.length === 0) {
    console.error(
      `lint-svg-unoptimized: no .tsx files found under ${SRC_DIR}/ — ` +
        `the source layout changed shape, so this check cannot assert anything.`
    );
    return 2;
  }

  const findings = findUnguardedSvgImages(SRC_DIR);
  if (findings.length > 0) {
    console.error(
      `lint-svg-unoptimized: ${findings.length} SVG <Image> without \`unoptimized\`:`
    );
    for (const f of findings) console.error(`  ${f.file}  ${f.src}`);
    console.error(
      '\n  Next routes these through `/_next/image?…&w=…&q=…`, rasterizing a ' +
        'vector for no gain. That transform is what the visual-regression ' +
        'capture flakes on: an image that fails `decode()` on both attempts ' +
        'reds a blocking gate on an unrelated route. Add `unoptimized` — the ' +
        'SVG is then served as-is from `src`. See brikdesigns#830.'
    );
    return 1;
  }

  console.log(
    `lint-svg-unoptimized: clean — ${files.length} .tsx file(s) checked, ` +
      `every SVG <Image> serves unoptimized`
  );
  return 0;
}

// Importable for the self-test; only the direct invocation exits.
if (process.argv[1] && import.meta.url === url.pathToFileURL(process.argv[1]).href) {
  process.exit(main());
}
