#!/usr/bin/env node
// Behaviour test for `src/lib/horizontal-scroll-track.ts` (brikdesigns#1272).
//
// The pinned card track has two silent failure modes, neither of which throws
// and neither of which is visible at the one viewport width the author tested:
//
//   - over-translate  → a blank gutter opens past the last card
//   - under-translate → the last card is stranded off-screen, unreachable
//
// Both are geometry, so both are testable without a browser. The DOM-dependent
// half — that reduced-motion really renders a scrollable row, that exactly one
// mechanism owns the transform — needs a rendered page and is gated on #1273,
// which is the first consumer.
//
// Run via `npm run test:hscroll`.

import assert from 'node:assert/strict';
import {
  trackOverhang,
  shouldScrub,
  trackOffset,
  pinDistance,
} from '../src/lib/horizontal-scroll-track.ts';

const tests = [];
const failures = [];
const test = (name, fn) => tests.push({ name, fn });

// ── trackOverhang ────────────────────────────────────────────────────────────

test('overhang is the width the track exceeds its window by', () => {
  assert.equal(trackOverhang({ trackWidth: 2028, viewportWidth: 1232 }), 796);
});

test('overhang matches the five-line service-lines track at 1440', () => {
  // 5 cards × 512px + 4 gaps × 24px = 2656px (brikdesigns#1273).
  assert.equal(trackOverhang({ trackWidth: 2656, viewportWidth: 1440 }), 1216);
});

test('a track narrower than its window has no overhang, never a negative one', () => {
  assert.equal(trackOverhang({ trackWidth: 800, viewportWidth: 1440 }), 0);
});

test('a track exactly as wide as its window has no overhang', () => {
  assert.equal(trackOverhang({ trackWidth: 1440, viewportWidth: 1440 }), 0);
});

// ── shouldScrub ──────────────────────────────────────────────────────────────

test('scrubs when there is overhang, motion is allowed, and the pointer is fine', () => {
  assert.equal(
    shouldScrub({ prefersReducedMotion: false, overhang: 1216, isCoarsePointer: false }),
    true
  );
});

test('reduced motion bails even with a large overhang', () => {
  assert.equal(
    shouldScrub({ prefersReducedMotion: true, overhang: 1216, isCoarsePointer: false }),
    false
  );
});

test('reduced motion outranks every other signal', () => {
  // Guards the short-circuit ORDER, not just the outcome: if the overhang or
  // pointer check ever moves above the preference check, a reduced-motion
  // visitor gets pinned. That is the one failure this file exists to prevent.
  assert.equal(
    shouldScrub({ prefersReducedMotion: true, overhang: 99999, isCoarsePointer: false }),
    false
  );
});

test('no overhang means no pin — nothing to reveal', () => {
  assert.equal(
    shouldScrub({ prefersReducedMotion: false, overhang: 0, isCoarsePointer: false }),
    false
  );
});

test('a coarse pointer keeps native momentum scrolling', () => {
  assert.equal(
    shouldScrub({ prefersReducedMotion: false, overhang: 1216, isCoarsePointer: true }),
    false
  );
});

// ── trackOffset ──────────────────────────────────────────────────────────────

test('progress 0 leaves the track at its start', () => {
  assert.equal(trackOffset(0, 1216), 0);
});

test('progress 1 lands exactly on the overhang, never past it', () => {
  assert.equal(trackOffset(1, 1216), -1216);
});

test('offset is negative — scrolling down moves cards LEFT', () => {
  // The operator's stated direction. A positive offset here would push the
  // first card off the right edge and reverse the whole interaction.
  assert.ok(trackOffset(0.5, 1216) < 0);
});

test('offset is linear across the range', () => {
  assert.equal(trackOffset(0.5, 1216), -608);
  assert.equal(trackOffset(0.25, 1216), -304);
});

test('overscroll past 1 clamps instead of opening a gutter', () => {
  // macOS rubber-band overscroll reports progress > 1. Unclamped this shows
  // as a flash of empty band past the last card.
  assert.equal(trackOffset(1.4, 1216), -1216);
});

test('overscroll below 0 clamps instead of dragging the track right', () => {
  assert.equal(trackOffset(-0.3, 1216), 0);
});

test('zero overhang pins the offset at 0 for every progress value', () => {
  for (const p of [0, 0.5, 1]) assert.equal(trackOffset(p, 0), 0);
});

// ── pinDistance ──────────────────────────────────────────────────────────────

test('pin consumes exactly the overhang — 1:1 with the wheel', () => {
  assert.equal(pinDistance(1216), 1216);
});

test('pin distance is never negative', () => {
  assert.equal(pinDistance(-50), 0);
});

// ── run ──────────────────────────────────────────────────────────────────────

for (const { name, fn } of tests) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
  } catch (err) {
    failures.push({ name, err });
    console.error(`  ✗ ${name}\n    ${err.message}`);
  }
}

console.log(`\n${tests.length - failures.length}/${tests.length} passed`);
process.exit(failures.length === 0 ? 0 : 1);
