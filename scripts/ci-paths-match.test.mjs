#!/usr/bin/env node
// Self-test for the CI paths matcher (brikdesigns#1334).
//
// This matcher decides whether a REQUIRED gate applies to a PR. A false
// negative therefore does not merely mis-report — it skips a required gate on a
// PR that needed it, which is #1320's failure mode with an extra step. And it
// fails silently: the check goes grey, the PR goes green, nothing complains. So
// the cases below are the ways this could stop firing:
//
//   - `src/**` stops matching a nested file (the gate skips real source edits)
//   - `*` starts crossing `/` (the gate runs on everything, and people learn to
//     ignore a check that is never informative)
//   - an unsupported metacharacter compiles to something plausible instead of
//     throwing (a `{a,b}` pattern that matches nothing, silently)
//   - the 3000-file API cap is read as "no match" rather than "cannot tell"
//
// The last block asserts the LIVE workflows, not fixtures: every `--pattern`
// the four gates pass must compile under the supported subset. Adding `{}` or
// `!` to a gate's path list fails here rather than at 2am.
//
// Plain node:assert, no framework. Run via `npm run test:ci-paths-match`.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { compilePattern, decide, matchesPattern, matchedFiles, parseArgs, FILE_LIST_CAP } from './ci-paths-match.mjs';

const HERE = path.dirname(new URL(import.meta.url).pathname);
const REPO = path.resolve(HERE, '..');
let failures = 0;

function check(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
  } catch (err) {
    failures += 1;
    console.error(`  ✗ ${name}\n      ${err.message}`);
  }
}

console.log('\n▸ pattern semantics');

// TEMPORARY — acceptance test for #1334 AC 3 (a failing required check must
// block the merge). This assertion is deliberately false. Revert before merge;
// this branch is never merged.
check('ACCEPTANCE-TEST deliberate failure (#1334 AC 3)', () => {
  assert.equal(matchesPattern('README.md', 'src/**'), true, 'deliberately false — proving verify reds');
});

check('`**` crosses directory separators', () => {
  assert.equal(matchesPattern('src/app/page.tsx', 'src/**'), true);
  assert.equal(matchesPattern('src/a/b/c/d.ts', 'src/**'), true);
  assert.equal(matchesPattern('src/page.tsx', 'src/**'), true);
});

check('`**` does not escape its own prefix', () => {
  assert.equal(matchesPattern('other/src/app/page.tsx', 'src/**'), false);
  assert.equal(matchesPattern('srcfoo/page.tsx', 'src/**'), false);
});

check('`*` stops at a directory separator', () => {
  assert.equal(matchesPattern('next.config.ts', 'next.config.*'), true);
  assert.equal(matchesPattern('next.config.mjs', 'next.config.*'), true);
  assert.equal(matchesPattern('next.config/nested.ts', 'next.config.*'), false);
  assert.equal(matchesPattern('tsconfig.json', 'tsconfig*.json'), true);
  assert.equal(matchesPattern('tsconfig.build.json', 'tsconfig*.json'), true);
  assert.equal(matchesPattern('a/tsconfig.json', 'tsconfig*.json'), false);
});

check('`?` is exactly one non-separator character', () => {
  assert.equal(matchesPattern('a.ts', '?.ts'), true);
  assert.equal(matchesPattern('ab.ts', '?.ts'), false);
  assert.equal(matchesPattern('a/b.ts', '?/b.ts'), true);
});

check('a literal pattern matches only itself, dots included', () => {
  assert.equal(matchesPattern('package.json', 'package.json'), true);
  assert.equal(matchesPattern('packageXjson', 'package.json'), false);
  assert.equal(matchesPattern('.github/workflows/a11y.yml', '.github/workflows/a11y.yml'), true);
  assert.equal(matchesPattern('.github/workflows/verify.yml', '.github/workflows/a11y.yml'), false);
});

check('an unsupported metacharacter throws instead of guessing', () => {
  for (const bad of ['src/{a,b}/**', '!src/**', 'src/+(a|b)', 'src/[ab].ts']) {
    assert.throws(() => compilePattern(bad), /unsupported metacharacter/, `expected refusal for '${bad}'`);
  }
});

console.log('\n▸ the decision');

check('any single match runs the gate', () => {
  const r = decide({ files: ['README.md', 'src/app/page.tsx'], patterns: ['src/**'] });
  assert.equal(r.run, true);
  assert.deepEqual(r.matches, [{ file: 'src/app/page.tsx', pattern: 'src/**' }]);
});

check('no match skips the gate', () => {
  const r = decide({ files: ['README.md', 'CLAUDE.md'], patterns: ['src/**', 'public/**'] });
  assert.equal(r.run, false);
  assert.equal(r.truncated, false);
});

check('an empty changed-file list skips rather than throws', () => {
  const r = decide({ files: [], patterns: ['src/**'] });
  assert.equal(r.run, false);
});

check('a capped file list fails CLOSED — cannot prove no match', () => {
  const files = Array.from({ length: FILE_LIST_CAP }, (_, i) => `docs/f${i}.md`);
  const r = decide({ files, patterns: ['src/**'] });
  assert.equal(r.run, true, 'a truncated list must run the gate, not skip it');
  assert.equal(r.truncated, true);
  assert.match(r.reason, /cap/);
});

check('one file below the cap still decides on the merits', () => {
  const files = Array.from({ length: FILE_LIST_CAP - 1 }, (_, i) => `docs/f${i}.md`);
  const r = decide({ files, patterns: ['src/**'] });
  assert.equal(r.run, false);
  assert.equal(r.truncated, false);
});

check('matchedFiles reports the first matching pattern per file', () => {
  const hits = matchedFiles(['src/a.ts'], ['public/**', 'src/**']);
  assert.deepEqual(hits, [{ file: 'src/a.ts', pattern: 'src/**' }]);
});

console.log('\n▸ CLI contract');

function runCli(stdin, args) {
  return spawnSync(process.execPath, [path.join(HERE, 'ci-paths-match.mjs'), ...args], {
    input: stdin,
    encoding: 'utf8',
  });
}

check('emits run=true on stdout and diagnostics on stderr', () => {
  const r = runCli('src/app/page.tsx\nREADME.md\n', ['--pattern', 'src/**']);
  assert.equal(r.status, 0);
  assert.equal(r.stdout, 'run=true\n', 'stdout must carry ONLY the GITHUB_OUTPUT line');
  assert.match(r.stderr, /gate applies/);
});

check('emits run=false when nothing matches', () => {
  const r = runCli('README.md\n', ['--pattern', 'src/**']);
  assert.equal(r.status, 0);
  assert.equal(r.stdout, 'run=false\n');
  assert.match(r.stderr, /does not apply/);
});

check('exits non-zero with no --pattern rather than defaulting to skip', () => {
  const r = runCli('src/a.ts\n', []);
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /at least one --pattern/);
});

check('parseArgs rejects a dangling or unknown flag', () => {
  assert.throws(() => parseArgs(['--pattern']), /needs a value/);
  assert.throws(() => parseArgs(['--paths', 'src/**']), /unknown argument/);
});

console.log('\n▸ the live gate path lists');

const GATED_WORKFLOWS = [
  'a11y.yml',
  'verify.yml',
  'visual-mockup.yml',
  'visual-regression.yml',
];

for (const file of GATED_WORKFLOWS) {
  check(`${file} passes only compilable patterns`, () => {
    const src = fs.readFileSync(path.join(REPO, '.github/workflows', file), 'utf8');
    const patterns = [...src.matchAll(/--pattern\s+'([^']+)'/g)].map((m) => m[1]);
    assert.ok(
      patterns.length > 0,
      `no --pattern arguments found — the changes job in ${file} is how this gate stays requirable (#1334)`,
    );
    for (const p of patterns) assert.doesNotThrow(() => compilePattern(p), `pattern '${p}'`);
  });

  check(`${file} has no workflow-level paths filter left`, () => {
    const src = fs.readFileSync(path.join(REPO, '.github/workflows', file), 'utf8');
    assert.equal(
      /^ {4}paths:/m.test(src),
      false,
      'a workflow-level paths: filter leaves a required check Pending forever (#1334) — ' +
        'move it into the changes job instead',
    );
  });
}

console.log(failures ? `\n✗ ${failures} check(s) failed\n` : '\n✓ all checks passed\n');
process.exit(failures ? 1 : 0);
