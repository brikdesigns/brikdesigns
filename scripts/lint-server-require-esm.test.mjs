#!/usr/bin/env node
// Self-test for the strict-CJS externals guard (brikdesigns#809).
//
// The bug this guards is invisible from every cheap signal — the build is green,
// `next start` serves 200, and a fresh deploy serves 200. It only appears on an
// on-demand render, an hour later. So a gate only ever observed passing proves
// nothing, and these are the ways it could stop firing (or start crying wolf):
//
//   - a CJS external requiring an ESM-only package is NOT flagged (the #809
//     shape walks straight back in)
//   - a plain CJS external IS flagged (false positive)
//   - an ESM-only external the app `import`s IS flagged — this one actually
//     happened while writing the gate: `next-mdx-remote` is externalized and
//     ESM-only and completely fine, because nothing `require()`s it
//   - a BUNDLED dependency is flagged — also happened: `sanitize-html` requires
//     the ESM-only `htmlparser2` and works, because neither is externalized
//   - the JSONC externals list fails to parse (it has comments AND a trailing
//     comma), or resolves empty, and the gate passes vacuously
//
// Fixtures are hand-built temp trees, so this asserts the rule rather than the
// state of the real tree — the repo passing today proves nothing about tomorrow.
// Plain node:assert, no framework.
// Run via `npm run test:lint:server-require-esm`.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import url from 'node:url';
import {
  findRequireEsmFailures,
  installedExternals,
  nextDefaultExternals,
  probeRequire,
} from './lint-server-require-esm.mjs';

const HERE = path.dirname(url.fileURLToPath(import.meta.url));
const GUARD = path.join(HERE, 'lint-server-require-esm.mjs');

const tests = [];
const failures = [];
const test = (name, fn) => tests.push({ name, fn });

/** Write a package into `root/node_modules/<name>/`. */
function pkg(root, name, manifest, files = {}) {
  const dir = path.join(root, 'node_modules', name);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, 'package.json'),
    JSON.stringify({ name, version: '1.0.0', ...manifest })
  );
  for (const [file, body] of Object.entries(files)) {
    fs.writeFileSync(path.join(dir, file), body);
  }
}

/**
 * A throwaway project root. `externals` is written into a fake Next install so
 * the CLI reads it exactly as it reads the real one — comments and trailing
 * comma included, because that is the format that broke the first attempt.
 */
function fixture(externals = []) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'brikdesigns-reqesm-'));
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ name: 'fixture' }));
  fs.writeFileSync(path.join(root, 'next.config.mjs'), 'export default {};\n');

  const nextLib = path.join(root, 'node_modules/next/dist/lib');
  fs.mkdirSync(nextLib, { recursive: true });
  const jsonc =
    '[\n  // a comment, as Next ships it\n' +
    externals.map((e) => `  ${JSON.stringify(e)},`).join('\n') +
    '\n]\n';
  fs.writeFileSync(path.join(nextLib, 'server-external-packages.jsonc'), jsonc);
  return root;
}

/** The #809 shape: an externalized CJS package whose own code requires ESM-only. */
function withBrokenExternal(root, name = 'cjs-external') {
  pkg(root, 'esm-only', { type: 'module', main: 'index.js' }, { 'index.js': 'export const x = 1;\n' });
  pkg(root, name, { main: 'index.js' }, { 'index.js': "require('esm-only');\n" });
}

test('JSONC externals list parses despite comments and a trailing comma', () => {
  const root = fixture(['alpha', 'beta']);
  assert.deepEqual(nextDefaultExternals(root), ['alpha', 'beta']);
});

test('a missing Next install reports null rather than an empty list', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'brikdesigns-reqesm-'));
  assert.equal(nextDefaultExternals(root), null);
});

test('installedExternals ignores externals that are not installed', () => {
  const root = fixture(['present', 'absent']);
  pkg(root, 'present', { main: 'index.js' }, { 'index.js': 'module.exports = 1;\n' });
  assert.deepEqual(installedExternals(root, ['present', 'absent']), ['present']);
});

test('an externalized CJS package requiring an ESM-only package is flagged', () => {
  const root = fixture(['cjs-external']);
  withBrokenExternal(root);

  const found = findRequireEsmFailures(root, ['cjs-external']);
  assert.equal(found.length, 1);
  assert.equal(found[0].spec, 'cjs-external');
  assert.match(found[0].from, /node_modules/);
});

test('a plain CJS external is not flagged', () => {
  const root = fixture(['plain-cjs']);
  pkg(root, 'plain-cjs', { main: 'index.js' }, { 'index.js': 'module.exports = 1;\n' });
  assert.deepEqual(findRequireEsmFailures(root, ['plain-cjs']), []);
});

test('an ESM-only external the app imports is NOT flagged', () => {
  // The next-mdx-remote case. Only the probe's own require() fails; nothing in
  // the tree requires it, so the function never does either.
  const root = fixture(['esm-external']);
  pkg(root, 'esm-external', { type: 'module', main: 'index.js' }, {
    'index.js': 'export const x = 1;\n',
  });

  const finding = probeRequire('esm-external', root);
  assert.equal(finding, null, 'ESM-only import-side external must not be a finding');
});

test('a BUNDLED dependency requiring ESM-only is not flagged', () => {
  // The sanitize-html -> htmlparser2 case: broken-looking, but never externalized,
  // so Turbopack compiles it in and no require() happens at runtime.
  const root = fixture([]); // <- not in the externals list
  withBrokenExternal(root, 'bundled-dep');
  assert.deepEqual(findRequireEsmFailures(root, []), []);
});

test('the nested case is caught transitively, not just at the top level', () => {
  // What actually shipped: the manifest named isomorphic-dompurify, and the ESM
  // require sat two levels down, inside jsdom.
  const root = fixture(['top']);
  pkg(root, 'esm-only', { type: 'module', main: 'index.js' }, { 'index.js': 'export const x = 1;\n' });
  pkg(root, 'middle', { main: 'index.js' }, { 'index.js': "require('esm-only');\n" });
  pkg(root, 'top', { main: 'index.js' }, { 'index.js': "require('middle');\n" });

  const found = findRequireEsmFailures(root, ['top']);
  assert.equal(found.length, 1);
  assert.equal(found[0].spec, 'top');
});

test('CLI exits 1 on a flagged tree and names the package', () => {
  const root = fixture(['cjs-external']);
  withBrokenExternal(root);

  const res = spawnSync(process.execPath, [GUARD], { cwd: root, encoding: 'utf8' });
  assert.equal(res.status, 1);
  assert.match(res.stderr, /cjs-external/);
});

test('CLI exits 1 rather than pass vacuously when the externals list is empty', () => {
  const root = fixture([]);
  const res = spawnSync(process.execPath, [GUARD], { cwd: root, encoding: 'utf8' });
  assert.equal(res.status, 1);
  assert.match(res.stderr, /zero packages/);
});

test('CLI exits 1 rather than pass vacuously when Next cannot be found', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'brikdesigns-reqesm-'));
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ name: 'fixture' }));

  const res = spawnSync(process.execPath, [GUARD], { cwd: root, encoding: 'utf8' });
  assert.equal(res.status, 1);
  assert.match(res.stderr, /server-external-packages/);
});

test('CLI exits 0 on a clean tree', () => {
  const root = fixture(['plain-cjs']);
  pkg(root, 'plain-cjs', { main: 'index.js' }, { 'index.js': 'module.exports = 1;\n' });

  const res = spawnSync(process.execPath, [GUARD], { cwd: root, encoding: 'utf8' });
  assert.equal(res.status, 0);
});

// ── runner ───────────────────────────────────────────────────────────────────
let passed = 0;
for (const { name, fn } of tests) {
  try {
    fn();
    passed++;
    console.log(`  ok   ${name}`);
  } catch (err) {
    failures.push({ name, err });
    console.log(`  FAIL ${name}`);
    console.log(`         ${err.message.split('\n')[0]}`);
  }
}
console.log(`\n${passed}/${tests.length} passed.`);
if (failures.length) {
  console.error('\nFailures:');
  for (const { name, err } of failures) {
    console.error(`  ${name}`);
    console.error(err.stack || err.message);
  }
  process.exit(1);
}
