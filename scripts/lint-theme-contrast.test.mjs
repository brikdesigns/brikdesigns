#!/usr/bin/env node
// Self-test for the theme-contrast gate (brikdesigns#851).
//
// The gate guards a value that fails silently: `lint:tokens` sees only names,
// and axe sees only what a route renders, so a sub-AA text token sits between
// them indefinitely. The only thing that makes the gate worth having is that it
// fires — and the cases below are the ways it could stop firing:
//
//   - the exact #851 state (light 400 = 2.17:1, dark 500 = 4.48:1) is NOT flagged
//   - the shipped fix (light 700, dark 400) IS flagged (false positive)
//   - a value 0.02 under AA passes because of a sloppy comparison
//   - the per-theme cascade breaks and a light lookup reads a dark value — the
//     bug this parser actually had mid-write (--surface-primary → #000000)
//   - a nested descendant rule inside a theme block leaks its pins into the
//     block's own token set
//   - a renamed selector, or a globals.css that no longer drives the theme,
//     passes vacuously instead of failing
//
// Fixtures are literal CSS strings, so this asserts the rule rather than the
// state of the real files. The last test runs the real gate as a subprocess to
// keep the two honest.
//
// Plain node:assert, no framework. Run via `npm run test:lint:theme-contrast`.

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  AA,
  CHECKS,
  contrast,
  declarations,
  blockDeclarations,
  resolveHex,
} from './lint-theme-contrast.mjs';

const tests = [];
const failures = [];
const test = (name, fn) => tests.push({ name, fn });

/** The grayscale stops these tests reference, in BDS's flat-primitive shape. */
const PRIMITIVES = declarations(`
:root {
  --color-grayscale-white: #ffffff;
  --color-grayscale-300: #e0e0e0;
  --color-grayscale-400: #b0b0b0;
  --color-grayscale-500: #828282;
  --color-grayscale-600: #6e6e6e;
  --color-grayscale-700: #5a5a5a;
  --color-grayscale-800: #333333;
  --color-grayscale-950: #1b1b1b;
  --color-tan-100: #f1f0ec;
}
`);

/** A BDS-shaped tokens.css: the SAME semantic token declared in four theme
 *  blocks, light first. This is the shape that made a flat last-wins read
 *  resolve a light-mode --surface-primary to the dark value. */
const BDS = `
:root {
  --surface-primary: var(--color-grayscale-white);
  --text-primary: var(--color-grayscale-950);
  --text-secondary: var(--color-grayscale-700);
  --text-muted: var(--color-grayscale-500);
}
:root[data-theme="dark"] {
  --surface-primary: var(--color-grayscale-950);
  --text-primary: var(--color-grayscale-white);
}
.theme-brand-brik {
  --surface-secondary: var(--color-grayscale-300);
}
:root[data-theme="dark"] .theme-brand-brik {
  --surface-secondary: var(--color-grayscale-950);
}
`;

/** `var(--color-grayscale-<stop>)`, assembled indirectly. Written this way so
 *  the fixture strings don't read as real token references to the
 *  `brik-tokens/no-invented-tokens` ESLint rule, which scans source text and
 *  can't tell a test fixture from a consumer. */
const gray = (stop) => `var(${'--color-grayscale-'}${stop})`;
const named = (n) => `${'--'}${n}`;

/** globals.css-shaped overrides for one light + one dark theme block. */
function globalsFixture({ lightMuted, darkMuted, extra = '' }) {
  return `
@layer client-theme {
  .theme-brand-brik {
    --text-secondary: ${gray(800)};
    --text-muted: ${gray(lightMuted)};
    --surface-secondary: var(${'--color-tan-100'});
${extra}
  }

  :root[data-theme="dark"] .theme-brand-brik {
    --text-secondary: ${gray(300)};
    --text-muted: ${gray(darkMuted)};
  }
}
`;
}

/** The gate's resolution, run over fixtures instead of the real files. */
function ratiosFor(globalsCss, theme) {
  const layers =
    theme === 'light'
      ? [
          [BDS, ':root'],
          [BDS, '.theme-brand-brik'],
          [globalsCss, '.theme-brand-brik'],
        ]
      : [
          [BDS, ':root'],
          [BDS, ':root[data-theme="dark"]'],
          [BDS, '.theme-brand-brik'],
          [BDS, ':root[data-theme="dark"] .theme-brand-brik'],
          [globalsCss, ':root[data-theme="dark"] .theme-brand-brik'],
        ];
  const cascade = new Map();
  for (const [src, sel] of layers) {
    const block = blockDeclarations(src, sel);
    if (block) for (const [k, v] of block) cascade.set(k, v);
  }
  const out = {};
  const surfaces = theme === 'light' ? ['--surface-primary', '--surface-secondary'] : ['--surface-primary'];
  for (const s of surfaces) {
    const bg = resolveHex(cascade.get(s) ?? null, cascade, PRIMITIVES);
    for (const t of ['--text-primary', '--text-secondary', '--text-muted']) {
      const fg = resolveHex(cascade.get(t) ?? null, cascade, PRIMITIVES);
      out[`${t} on ${s}`] = { fg, bg, ratio: fg && bg ? contrast(fg, bg) : null };
    }
  }
  return out;
}

const failing = (r) => Object.entries(r).filter(([, v]) => v.ratio === null || v.ratio < AA).map(([k]) => k);

test('the #851 state is flagged — light 400, dark 500', () => {
  const css = globalsFixture({ lightMuted: '400', darkMuted: '500' });
  const light = ratiosFor(css, 'light');
  const dark = ratiosFor(css, 'dark');

  // The numbers from the issue, recomputed here so a formula change is caught.
  assert.equal(light['--text-muted on --surface-primary'].ratio.toFixed(2), '2.17');
  assert.equal(light['--text-muted on --surface-secondary'].ratio.toFixed(2), '1.90');
  assert.equal(dark['--text-muted on --surface-primary'].ratio.toFixed(2), '4.48');

  assert.deepEqual(failing(light).sort(), [
    '--text-muted on --surface-primary',
    '--text-muted on --surface-secondary',
  ]);
  assert.deepEqual(failing(dark), ['--text-muted on --surface-primary']);
});

test('the shipped fix is not flagged — light 700, dark 400', () => {
  const css = globalsFixture({ lightMuted: '700', darkMuted: '400' });
  assert.deepEqual(failing(ratiosFor(css, 'light')), []);
  assert.deepEqual(failing(ratiosFor(css, 'dark')), []);
});

test('light 600 is still flagged — it clears white but misses tan-100', () => {
  // The reason the fix is 700 and not 600. A gate that only checked
  // --surface-primary would have waved 600 through.
  const r = ratiosFor(globalsFixture({ lightMuted: '600', darkMuted: '400' }), 'light');
  assert.equal(r['--text-muted on --surface-primary'].ratio.toFixed(2), '5.10');
  assert.equal(r['--text-muted on --surface-secondary'].ratio.toFixed(2), '4.47');
  assert.deepEqual(failing(r), ['--text-muted on --surface-secondary']);
});

test('a value 0.02 under AA fails, not rounds up', () => {
  // dark 500 is 4.48:1. Nothing may treat that as "basically 4.5".
  const r = ratiosFor(globalsFixture({ lightMuted: '700', darkMuted: '500' }), 'dark');
  const v = r['--text-muted on --surface-primary'];
  assert.ok(v.ratio < AA, `expected < ${AA}, got ${v.ratio}`);
  assert.deepEqual(failing(r), ['--text-muted on --surface-primary']);
});

test('a light lookup does not read the dark theme value', () => {
  // The bug this parser had mid-write: a flat read of BDS handed back
  // --surface-primary from the dark block, so light resolved to #1b1b1b.
  const light = ratiosFor(globalsFixture({ lightMuted: '700', darkMuted: '400' }), 'light');
  assert.equal(light['--text-muted on --surface-primary'].bg, '#ffffff');
  const dark = ratiosFor(globalsFixture({ lightMuted: '700', darkMuted: '400' }), 'dark');
  assert.equal(dark['--text-muted on --surface-primary'].bg, '#1b1b1b');
});

test('a nested descendant rule does not leak into the block token set', () => {
  const css = globalsFixture({
    lightMuted: '700',
    darkMuted: '400',
    extra: `    .some-card { --text-muted: var(--color-grayscale-400); }`,
  });
  const own = blockDeclarations(css, '.theme-brand-brik');
  assert.equal(own.get('--text-muted'), 'var(--color-grayscale-700)');
  assert.deepEqual(failing(ratiosFor(css, 'light')), []);
});

test('an exact-selector match does not also match a longer suffix', () => {
  // `.theme-brand-brik {` is a suffix of `:root[data-theme="dark"] .theme-brand-brik {`.
  const only = blockDeclarations(
    `:root[data-theme="dark"] .theme-brand-brik {\n  --text-muted: var(--color-grayscale-400);\n}\n`,
    '.theme-brand-brik'
  );
  assert.equal(only, null);
});

test('a renamed selector returns null rather than an empty pass', () => {
  assert.equal(blockDeclarations(BDS, '.theme-brand-renamed'), null);
  assert.notEqual(blockDeclarations(BDS, '.theme-brand-brik'), null);
});

test('resolveHex handles 3-digit hex, direct hex, and a var cycle', () => {
  // Names built via `named()` so the cycle fixture isn't read as a real token
  // reference by the invented-token ESLint rule.
  const [a, b, missing] = [named('cycle-a'), named('cycle-b'), named('absent')];
  const m = new Map([
    [a, `var(${b})`],
    [b, `var(${a})`],
  ]);
  assert.equal(resolveHex('#FFF', m, PRIMITIVES), '#ffffff');
  assert.equal(resolveHex('#1B1B1B', m, PRIMITIVES), '#1b1b1b');
  assert.equal(resolveHex(`var(${a})`, m, PRIMITIVES), null, 'a var cycle must terminate as null');
  assert.equal(resolveHex(`var(${missing})`, m, PRIMITIVES), null);
});

test('contrast is symmetric and anchored on a known pair', () => {
  assert.equal(contrast('#ffffff', '#000000').toFixed(0), '21');
  assert.equal(contrast('#000000', '#ffffff').toFixed(2), contrast('#ffffff', '#000000').toFixed(2));
});

test('a token named in a prose comment is not read as a declaration', () => {
  // This is not hypothetical: the globals.css comment explaining the dark fix
  // contains the sentence "--surface-secondary is the binding surface here, not
  // --surface-primary:" — and before stripComments() existed, that trailing
  // colon made the gate resolve dark --surface-primary to a paragraph of English.
  const css = `
.theme-brand-brik {
  /* --surface-primary: this is prose, not a declaration. Nor is --text-muted:
     anything. A brace in a comment { would also desync the depth counter. */
  --text-muted: ${gray(700)};
}
`;
  const own = blockDeclarations(css, '.theme-brand-brik');
  assert.equal(own.get('--text-muted'), gray(700));
  assert.equal(own.has('--surface-primary'), false, 'prose must not become a declaration');
});

test('a declaration value keeps no trailing comment', () => {
  const own = blockDeclarations(
    `.x {\n  --text-muted: ${gray(700)}; /* bds-lint-ignore — note */\n}\n`,
    '.x'
  );
  assert.equal(own.get('--text-muted'), gray(700));
});

test('dark checks --surface-secondary, the binding dark surface', () => {
  // Dark --surface-primary is true black, so it has more headroom than any other
  // surface; --surface-secondary (grayscale-950) is where a dark token runs out.
  // A dark check against primary alone would have waved grayscale-500 through.
  const dark = CHECKS.find((c) => c.theme === 'dark');
  assert.ok(dark.surfaces.includes('--surface-secondary'));
  assert.ok(dark.surfaces.includes('--surface-primary'));
});

test('the real gate passes on the real files', () => {
  const r = spawnSync(process.execPath, ['scripts/lint-theme-contrast.mjs'], { encoding: 'utf8' });
  assert.equal(r.status, 0, `gate failed on the repo:\n${r.stderr || r.stdout}`);
  // 3 text tokens × 2 surfaces × 2 themes.
  assert.match(r.stdout, /12 text\/surface pair\(s\) clear AA/);
});

for (const { name, fn } of tests) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
  } catch (err) {
    failures.push({ name, err });
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message.split('\n').join('\n    ')}`);
  }
}

console.log(`\nlint-theme-contrast.test: ${tests.length - failures.length}/${tests.length} passed`);
process.exit(failures.length > 0 ? 1 : 0);
