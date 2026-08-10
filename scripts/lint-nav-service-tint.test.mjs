#!/usr/bin/env node
// Self-test for the nav-service-tint gate (brikdesigns#860).
//
// The gate guards a silent failure — a service line with no background rule
// renders a plain nav, throws nothing, and looks finished — so the only thing
// that makes it worth having is that it fires. The cases below are the ways it
// could stop firing:
//
//   - the #729 state itself (marketing only, four lines unruled) is NOT flagged
//   - a copy-pasted rule pointing at the wrong line's surface is NOT flagged
//   - a stale rule for a line canon no longer has is NOT flagged
//   - the complete, correct state IS flagged (false positive; someone deletes
//     the check rather than fight it)
//   - either parser silently returns nothing, so the gate passes vacuously —
//     the failure mode that makes a gate worthless
//
// Fixtures are literal strings, so this asserts the rule rather than the state
// of the real files: the repo passing today proves nothing about tomorrow. The
// last test runs the real gate as a subprocess to keep the two honest.
//
// Plain node:assert, no framework. Run via `npm run test:lint:nav-service-tint`.

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { serviceLinesFromTokens, tintRulesFromCss } from './lint-nav-service-tint.mjs';

const tests = [];
const failures = [];
const test = (name, fn) => tests.push({ name, fn });

/** `var(<name>)` assembled indirectly. Written this way so the fixture strings
 *  below don't read as real `var(--surface-service-…)` references to the
 *  `brik-tokens/no-invented-tokens` ESLint rule, which scans source text and
 *  can't tell a test fixture from a consumer. */
const cssVar = (name) => `var(${name})`;

/** A `color.service` map in the shape tokens.ts uses, for the given lines. */
function tokensFixture(lines) {
  const entries = lines
    .map(
      (l) =>
        `    ${l.includes('-') ? `'${l}'` : l}: {\n` +
        `      bg: '${cssVar(`--background-service-${l}`)}',\n` +
        `      surfaceDark: '${cssVar(`--surface-service-${l}-dark`)}',\n` +
        `    },`
    )
    .join('\n');
  return (
    `export const color = {\n` +
    `  system: {\n    green: '${cssVar('--color-system-green')}',\n  },\n` +
    `  service: {\n${entries}\n  },\n` +
    `} as const;\n`
  );
}

/** `.mega-nav--service-*` rules for `[line, tokenSuffix]` pairs. */
function cssFixture(pairs) {
  return (
    `.mega-nav { position: sticky; }\n\n` +
    pairs
      .map(
        ([line, suffix]) =>
          `.mega-nav--service-${line} {\n  background-color: ${cssVar(
            `--surface-service-${suffix}-dark`
          )};\n}\n`
      )
      .join('\n') +
    `\n.mega-nav--service .mega-nav__logo {\n  color: ${cssVar('--text-on-color-dark')};\n}\n`
  );
}

const ALL = ['brand', 'marketing', 'information', 'product', 'back-office'];

/** What the gate's main() would report, computed from the two parsers. */
function problemsFor(tokensSrc, cssSrc) {
  const lines = serviceLinesFromTokens(tokensSrc);
  const rules = tintRulesFromCss(cssSrc);
  const problems = [];
  for (const line of lines) {
    const expected = `--surface-service-${line}-dark`;
    if (!rules.has(line)) problems.push(`missing:${line}`);
    else if (rules.get(line) !== expected) problems.push(`wrong-token:${line}`);
  }
  for (const line of rules.keys()) {
    if (!lines.includes(line)) problems.push(`stale:${line}`);
  }
  return problems;
}

test('the #729 state is flagged — marketing ruled, four lines not', () => {
  // Exactly what PR #750 merged and `Closes #729` closed.
  const problems = problemsFor(tokensFixture(ALL), cssFixture([['marketing', 'marketing']]));
  assert.deepEqual(problems.sort(), [
    'missing:back-office',
    'missing:brand',
    'missing:information',
    'missing:product',
  ]);
});

test('the complete correct state is not flagged', () => {
  const problems = problemsFor(tokensFixture(ALL), cssFixture(ALL.map((l) => [l, l])));
  assert.deepEqual(problems, []);
});

test('a rule pointing at another line\'s surface is flagged', () => {
  // The copy-paste a presence-only check waves through: brand's selector, green.
  const css = cssFixture([
    ['marketing', 'marketing'],
    ['brand', 'marketing'],
    ['information', 'information'],
    ['product', 'product'],
    ['back-office', 'back-office'],
  ]);
  assert.deepEqual(problemsFor(tokensFixture(ALL), css), ['wrong-token:brand']);
});

test('a rule with no background-color at all is flagged', () => {
  const css = `.mega-nav--service-brand {\n  border-color: ${cssVar('--border-on-color-dark')};\n}\n`;
  assert.deepEqual(problemsFor(tokensFixture(['brand']), css), ['wrong-token:brand']);
});

test('a rule for a line canon no longer has is flagged', () => {
  // `service` was the old back-office key; a rename must not leave dead CSS
  // behind, because dead CSS reads as coverage.
  const css = cssFixture([
    ...ALL.map((l) => [l, l]),
    ['service', 'back-office'],
  ]);
  assert.deepEqual(problemsFor(tokensFixture(ALL), css), ['stale:service']);
});

test('the token parser reads only the service map, not its siblings', () => {
  // A `system:` key leaking in would invent a line and fail the gate forever.
  const src = tokensFixture(ALL);
  assert.deepEqual(serviceLinesFromTokens(src), ALL);
  assert.ok(!serviceLinesFromTokens(src).includes('green'));
});

test('the token parser returns nothing when the map changes shape', () => {
  // An empty parse is what main() converts to exit 2 rather than a silent pass;
  // this pins the parser half of that contract.
  assert.deepEqual(serviceLinesFromTokens('export const color = { service: [] };'), []);
  assert.deepEqual(tintRulesFromCss('.mega-nav { position: sticky; }').size, 0);
});

test('hyphenated and quoted keys both parse', () => {
  assert.ok(serviceLinesFromTokens(tokensFixture(['back-office'])).includes('back-office'));
});

test('the real gate passes on the real files', () => {
  const r = spawnSync(process.execPath, ['scripts/lint-nav-service-tint.mjs'], {
    encoding: 'utf8',
  });
  assert.equal(r.status, 0, `gate failed on the repo:\n${r.stderr || r.stdout}`);
  assert.match(r.stdout, /5 service line\(s\)/);
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

console.log(
  `\nlint-nav-service-tint.test: ${tests.length - failures.length}/${tests.length} passed`
);
process.exit(failures.length > 0 ? 1 : 0);
