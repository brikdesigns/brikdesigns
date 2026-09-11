#!/usr/bin/env node
// Self-test for the indicator-vocabulary gate (brikdesigns#1395).
//
// The gate guards a silent failure: a read-only pill called a "chip" renders
// fine. Nothing breaks, no lint fires, and the wrong word then travels from a
// mockup into a comment and settles into a classname — which is how this repo
// came to ship two hand-rolled `*__chip` families while importing BDS `Chip`
// zero times.
//
// So the only thing that makes the gate worth having is that it fires, and
// fires on the right things. The cases below pin the four judgement calls:
// which names read as a chip, which classes are judged, whether a file is
// entitled to the word by importing BDS `Chip`, and — the load-bearing one —
// that a comment DRAWING the Chip/indicator distinction is exempt while a
// comment getting it wrong is not. #1395's own AC5 case, `.engagement-mode__chip`
// claiming a family its file never imports, is pinned directly.
//
// The last two tests run the real gate as a subprocess so the fixtures and the
// repo stay honest: one asserts it passes as committed, the other that removing
// the baseline makes it fail — a gate that cannot fail is not a gate.
//
// Plain node:assert, no framework. Run via `npm run test:lint:indicator-vocabulary`.

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import {
  BASELINE_PATH,
  appliedClasses,
  commentsIn,
  definedClasses,
  importsBdsChip,
  isChipWord,
  isJudgedClass,
  namesAnIndicator,
  offendingComments,
} from './lint-indicator-vocabulary.mjs';

const tests = [];
const failures = [];
const test = (name, fn) => tests.push({ name, fn });

// ── which names read as a chip ────────────────────────────────────────────

test('`chip` as a delimited word is a chip name; a substring is not', () => {
  for (const yes of ['engagement-mode__chip', 'team-member__chip', 'chip-icon', 'chip']) {
    assert.ok(isChipWord(yes), `${yes} should read as a chip`);
  }
  for (const no of ['chipboard', 'microchip', 'shipping', 'chipper-panel']) {
    assert.ok(!isChipWord(no), `${no} should NOT read as a chip`);
  }
});

test('BEM elements ARE judged; bds-* is not', () => {
  // Unlike the card gate, which judges blocks only: `.engagement-mode__chip`
  // puts the wrong word in the ELEMENT, so judging blocks would miss every
  // real case in this repo.
  assert.ok(isJudgedClass('engagement-mode__chip'), 'an __element carrying `chip` is judged');
  assert.ok(isJudgedClass('filter-chip--active'), 'a --modifier carrying `chip` is judged');
  assert.ok(!isJudgedClass('bds-chip'), 'bds-* is BDS-owned, not site-local');
  assert.ok(!isJudgedClass('team-member__avatar'), 'a non-chip name is never judged');
});

// ── reading definitions and applications ──────────────────────────────────

test('classes are read from rule preludes, including inside @media', () => {
  const css = [
    '.engagement-mode__chip { color: red; }',
    '@media (min-width: 48rem) { .team-member__chip { gap: 0; } }',
    '/* .commented-out__chip is prose, not a definition */',
  ].join('\n');
  const defined = definedClasses(css);
  assert.ok(defined.has('engagement-mode__chip'), 'a top-level rule counts');
  assert.ok(defined.has('team-member__chip'), 'a rule nested in @media counts');
  assert.ok(!defined.has('commented-out__chip'), 'a name inside a comment is not a definition');
});

test('a className is harvested from a string, a template literal, or an array', () => {
  assert.ok(appliedClasses('<span className="engagement-mode__chip" />').has('engagement-mode__chip'));
  assert.ok(appliedClasses('<b className={`mode__chip--${a}`} />').has('mode__chip'));
  assert.ok(appliedClasses('<i className={[x, "team-member__chip"].join(" ")} />').has('team-member__chip'));
});

// ── who is entitled to the word ───────────────────────────────────────────

test('a BDS Chip import entitles the file to the word; another import does not', () => {
  assert.ok(importsBdsChip("import { Chip } from '@brikdesigns/bds';"), 'a bare specifier counts');
  assert.ok(importsBdsChip("import { Card, Chip, Tag } from '@brikdesigns/bds';"), 'among siblings counts');
  assert.ok(importsBdsChip("import type { ChipProps } from '@brikdesigns/bds/dist/types';"), 'a type import counts');
  assert.ok(!importsBdsChip("import { Tag } from '@brikdesigns/bds';"), 'Tag is not Chip');
  assert.ok(!importsBdsChip("import { Chip } from './local-chip';"), 'a local Chip is not the BDS one');
});

// ── the comment arm, and its exemption ────────────────────────────────────

test('both CSS block comments and JS line comments are read', () => {
  const found = commentsIn('/* a block */\nconst x = 1; // a line\n');
  assert.equal(found.length, 2, 'one block + one line');
});

test('naming an indicator exempts a comment; the bare word does not', () => {
  assert.ok(namesAnIndicator('// Indicator, not a chip — Tag is the right one'), 'Tag exempts');
  assert.ok(namesAnIndicator('/* a line-coloured ServiceTag chip */'), 'ServiceTag exempts');
  assert.ok(namesAnIndicator('// a Badge, never a chip'), 'Badge exempts');
  assert.ok(!namesAnIndicator('// the chip geometry comes from Figma'), 'the bare word does not');
});

test('the correct-usage precedent is EXEMPT; the drift is not', () => {
  // PlanCoverageRow.tsx:42-52 is the precedent #1395 holds up as correct: it
  // explains why Chip is wrong and Tag is right. A gate that flagged it would
  // punish the one file in the tree that got this right.
  const precedent =
    '{/* Indicator, not a chip. A `Tag` (`size="xs"`, non-interactive by design);\n' +
    '    `Chip` would be wrong — it is the interactive filter/selection pill. */}';
  assert.equal(offendingComments(precedent).length, 0, 'the precedent is exempt');

  const drift = "// `accent` keys the icon chip's fill/ink pair in plans.css";
  assert.equal(offendingComments(drift).length, 1, 'the drift is caught');
});

test('the plural `chips` is caught too', () => {
  assert.equal(offendingComments('// Figma gives the two chips DIFFERENT families').length, 1);
});

// ── the real gate on the real repo ────────────────────────────────────────

test('the real gate passes on the real files', () => {
  const r = spawnSync(process.execPath, ['scripts/lint-indicator-vocabulary.mjs'], {
    encoding: 'utf8',
  });
  assert.equal(r.status, 0, `gate failed on the repo:\n${r.stderr || r.stdout}`);
  assert.match(r.stdout, /clean/);
});

test('a new hand-rolled chip in the real tree fails the gate', () => {
  // A gate that cannot fail is not a gate. #1395's version of this case used
  // `.engagement-mode__chip`, the real offender then in the tree; #1415 renamed
  // both offenders and emptied `classnames`, so the case now PLANTS one. That
  // is the stronger assertion anyway: it pins the going-forward direction the
  // ratchet exists for, and cannot rot the next time a name is fixed.
  const css = 'src/app/ztmp-vocabulary-probe.css';
  const tsx = 'src/app/ztmp-vocabulary-probe.tsx';
  try {
    fs.writeFileSync(css, '.probe-section__chip {\n  border-radius: 4px;\n}\n');
    fs.writeFileSync(
      tsx,
      'export default function Probe() {\n  return <span className="probe-section__chip" />;\n}\n'
    );
    const r = spawnSync(process.execPath, ['scripts/lint-indicator-vocabulary.mjs'], {
      encoding: 'utf8',
    });
    assert.equal(r.status, 1, 'the gate must fail on an un-baselined offender');
    assert.match(r.stderr, /probe-section__chip/, 'it names the offending class');
    assert.match(r.stderr, /`Tag`/, 'the message names Tag');
    assert.match(r.stderr, /`Badge`/, 'the message names Badge');
    assert.match(r.stderr, /build-standards\/indicators/, 'the message cites the canon page');
  } finally {
    for (const f of [css, tsx]) if (fs.existsSync(f)) fs.unlinkSync(f);
  }
});

test('a baselined entry that no longer offends fails too — the ratchet is honest', () => {
  const saved = fs.readFileSync(BASELINE_PATH, 'utf8');
  try {
    const b = JSON.parse(saved);
    b.classnames['never-existed__chip'] = 'a stale entry that must be rejected';
    fs.writeFileSync(BASELINE_PATH, JSON.stringify(b, null, 2));
    const r = spawnSync(process.execPath, ['scripts/lint-indicator-vocabulary.mjs'], {
      encoding: 'utf8',
    });
    assert.equal(r.status, 1, 'a stale baseline entry must fail');
    assert.match(r.stderr, /never-existed__chip/, 'it names the stale entry');
  } finally {
    fs.writeFileSync(BASELINE_PATH, saved);
  }
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
  `\nlint-indicator-vocabulary.test: ${tests.length - failures.length}/${tests.length} passed`
);
process.exit(failures.length > 0 ? 1 : 0);
