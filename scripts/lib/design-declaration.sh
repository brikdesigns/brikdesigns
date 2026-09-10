#!/usr/bin/env bash
# design-declaration.sh — pure helpers behind pr-task.sh's design-source
# declaration (brikdesigns#1351). Tested by
# scripts/__tests__/test-design-declaration.sh.
#
# The `verify` job's design-source gate (.github/workflows/verify.yml) fires on
# any PR labelled `area:design` or `class:ia`, and passes on exactly one of:
#
#   1. a `Design: <source>` line in the PR BODY, or
#   2. the `design:none` LABEL *and* a `Design-exempt: <reason>` body line.
#
# pr-task.sh emitted none of the three, so every such PR reds on its first run
# by construction — 7 of the 96 CI failures in the 14 days to 2026-09-10, and
# none older than the gate itself. Same defect class as the intended-visual
# declaration (#1344): the pass condition lives on the PR, not in the diff, and
# the author tool never satisfied it.
#
# These helpers are pure — no git, no gh, no network — so the test can drive
# them directly and the refusal can be asserted without opening a PR.

# True iff the resolved label set would trigger the design-source gate.
#
# MIRRORS the workflow's `if:` condition, which is:
#   contains(labels.*.name, 'class:ia') || contains(labels.*.name, 'area:design')
#
# Reads a newline-separated label list on $1 (the shape pr-task.sh's
# LABELS_TO_ADD expands to). Exact whole-line matches only: `area:design-system`
# must NOT trigger it, because the gate's `contains()` is over the label array,
# not a substring of one name.
design_gate_applies() {
  local labels="${1:-}"
  printf '%s\n' "$labels" | grep -qxE 'area:design|class:ia'
}

# Echo the exact `Design: <source>` body line the gate greps for.
#
# The gate's own regex is `^[[:space:]]*Design:[[:space:]]*\S`, so the line must
# carry at least one non-space character after the colon. A blank or
# whitespace-only source would emit a line that LOOKS declared and still reds,
# which is the silent failure this returns 1 for instead.
#   - empty / whitespace-only → nothing on stdout, return 1
#   - otherwise               → echo the line, return 0
design_declaration_line() {
  local src="${1:-}"
  src="$(printf '%s' "$src" | sed 's/^[[:space:]]*//; s/[[:space:]]*$//')"
  [ -n "$src" ] || return 1
  printf 'Design: %s\n' "$src"
}

# Echo the exact `Design-exempt: <reason>` body line for the gate's exempt path.
#
# Same shape and the same reason for failing an empty reason. NOTE: this line
# alone waives nothing — the gate requires the `design:none` LABEL as well, so
# pr-task.sh must add both. Emitting the line without the label is the exact
# half-declaration the gate is built to reject.
design_exempt_line() {
  local reason="${1:-}"
  reason="$(printf '%s' "$reason" | sed 's/^[[:space:]]*//; s/[[:space:]]*$//')"
  [ -n "$reason" ] || return 1
  printf 'Design-exempt: %s\n' "$reason"
}
