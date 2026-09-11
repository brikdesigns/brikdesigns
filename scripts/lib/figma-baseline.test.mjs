#!/usr/bin/env node
// Self-test for the Figma-baseline helpers (brikdesigns#1392).
//
// The cases below are the ways this mode could quietly stop being a gate:
//
//   - a hyphenated node id from a Figma URL exports nothing, and `/v1/images`
//     reports that as success with an empty map
//   - a section with no checked-in baseline gets skipped instead of refused,
//     which is exactly how #822 survived four days
//   - a selector override is dropped, so the default `[data-section]` silently
//     matches nothing on a route whose regions are divs (/offers/brikdown)
//
// Plain node:assert, no framework. Run via `npm run test:figma-baseline`.

import assert from 'node:assert/strict';
import {
  normalizeNodeId,
  resolveSectionSelector,
  figmaSections,
  figmaBaselinePath,
  exportFigmaNodes,
  missingFigmaBaselines,
} from './figma-baseline.mjs';

let passed = 0;
function check(name, fn) {
  const out = fn();
  const done = () => {
    passed += 1;
    console.log(`  ✓ ${name}`);
  };
  if (out instanceof Promise) return out.then(done);
  done();
  return undefined;
}

const tests = [];
const asyncCheck = (name, fn) => tests.push(() => check(name, fn));

// ── node id spelling ────────────────────────────────────────────────────────
check('a URL-spelled node id is normalized to the API spelling', () => {
  assert.equal(normalizeNodeId('26144-9047'), '26144:9047');
});

check('an API-spelled node id is left alone', () => {
  assert.equal(normalizeNodeId('26144:9047'), '26144:9047');
});

check('surrounding whitespace is trimmed', () => {
  assert.equal(normalizeNodeId('  27111-867 '), '27111:867');
});

// ── selectors ───────────────────────────────────────────────────────────────
check('a bare node id falls back to the data-section convention', () => {
  assert.equal(resolveSectionSelector('hero', '26144:9053'), '[data-section="hero"]');
});

check('an explicit selector wins — BDS blueprints use aria-labelledby', () => {
  assert.equal(
    resolveSectionSelector('what-you-get', { node: '26144:9066', selector: '[aria-labelledby="what-you-get-title"]' }),
    '[aria-labelledby="what-you-get-title"]',
  );
});

check('sections normalize to an ordered list carrying both forms', () => {
  const sections = figmaSections({
    name: 'plan-detail-marketing-support',
    figma: {
      sections: {
        hero: '26144-9053',
        'what-you-get': { node: '26144:9066', selector: '[aria-labelledby="what-you-get-title"]' },
      },
    },
  });
  assert.deepEqual(sections, [
    { key: 'hero', nodeId: '26144:9053', selector: '[data-section="hero"]' },
    { key: 'what-you-get', nodeId: '26144:9066', selector: '[aria-labelledby="what-you-get-title"]' },
  ]);
});

check('a route with no figma declaration contributes no sections', () => {
  assert.deepEqual(figmaSections({ name: 'home' }), []);
});

// ── baseline paths + refusal ────────────────────────────────────────────────
check('baseline paths are flat, one file per route+section', () => {
  assert.equal(
    figmaBaselinePath('tests/visual-parity/figma', 'brikdown', 'hero'),
    'tests/visual-parity/figma/brikdown-hero.png',
  );
});

check('a section with no baseline is reported, not skipped', () => {
  const missing = missingFigmaBaselines(
    [{ name: 'brikdown', figma: { sections: { hero: '1:1', details: '1:2' } } }],
    'base',
    { exists: (p) => p.endsWith('brikdown-hero.png') },
  );
  assert.deepEqual(missing.map((m) => m.section), ['details']);
});

check('routes with no figma declaration never report a missing baseline', () => {
  assert.deepEqual(missingFigmaBaselines([{ name: 'home' }], 'base', { exists: () => false }), []);
});

// ── export ──────────────────────────────────────────────────────────────────
asyncCheck('export sends colon-spelled ids and the token header', async () => {
  let seenUrl = null;
  let seenHeaders = null;
  const images = await exportFigmaNodes('FILEKEY', ['26144-9053', '26144:9055'], {
    token: 'figd_test',
    fetchImpl: async (url, init) => {
      seenUrl = url;
      seenHeaders = init.headers;
      return { ok: true, json: async () => ({ err: null, images: { '26144:9053': 'https://s3/a.png' } }) };
    },
  });
  assert.match(seenUrl, /26144%3A9053%2C26144%3A9055/);
  // scale=1, so the export is 1440 wide — the same number of pixels the browser
  // captures a 1440 CSS-px section as. A scale-2 baseline pads to double width
  // and reads as a ~50% diff on a section that matches its design exactly.
  assert.match(seenUrl, /format=png&scale=1/);
  assert.equal(seenHeaders['X-Figma-Token'], 'figd_test');
  assert.deepEqual(images, { '26144:9053': 'https://s3/a.png' });
});

asyncCheck('a Figma-reported error is raised, not returned as an empty map', async () => {
  await assert.rejects(
    exportFigmaNodes('FILEKEY', ['1:1'], {
      token: 't',
      fetchImpl: async () => ({ ok: true, json: async () => ({ err: 'Not found', images: null }) }),
    }),
    /Not found/,
  );
});

asyncCheck('a non-200 is raised with its status', async () => {
  await assert.rejects(
    exportFigmaNodes('FILEKEY', ['1:1'], {
      token: 't',
      fetchImpl: async () => ({ ok: false, status: 403, statusText: 'Forbidden' }),
    }),
    /403 Forbidden/,
  );
});

asyncCheck('a missing token fails before any request', async () => {
  await assert.rejects(
    exportFigmaNodes('FILEKEY', ['1:1'], { token: '', fetchImpl: async () => { throw new Error('must not fetch'); } }),
    /no Figma token/,
  );
});

for (const t of tests) await t();

console.log(`\n✓ ${passed} assertions passed`);
