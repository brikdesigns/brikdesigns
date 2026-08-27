#!/usr/bin/env bash
# pr-labels.sh — resolve the project-tracking labels a PR should carry.
#
# GitHub does NOT copy a linked issue's labels onto its PR, so PRs opened by
# pr-task.sh were born label-less and fell off the project board — 7 of the last
# 12 merged PRs here carried zero labels (#1012). This restores parity: the
# script inherits the area:* / size:* / theme:* labels of every issue the commit
# range references, plus a Type label from the conventional-commit prefix.
#
# Pure functions only: no `gh`, no git, no network. The caller fetches the repo
# label list and each issue's labels and hands them in, which is what makes
# scripts/__tests__/test-pr-labels.sh able to drive every branch offline.
#
# Ported from brikdesigns/brik-bds#1979 (PR #1988). One deliberate divergence:
# brik-bds and the portal read issue refs off a rendered `Closes #N` / `Refs #N`
# block that their pr-task.sh writes into the PR body (via lib/issue-links.sh).
# THIS repo has no such block and no issue-link layer, so refs are read straight
# off the commit range instead (#1012 chose this over porting the whole
# issue-link gate). The extractor is the same either way — it pulls `#N` tokens
# from whatever text it is handed.
#
# The four hard-won fixes from the portal original are kept verbatim:
#
#   1. Existence-check EVERY label before handing it to `gh pr edit` — one
#      unknown name aborts the whole call, taking every other label with it.
#      Not hypothetical here: brikdesigns has neither `enhancement` nor `bug`,
#      so an unchecked Type label would drop the inherited area:*/size:* too.
#   2. Never `gh … | grep -q`. Under `set -o pipefail`, `grep -q` exits on
#      first match and closes the pipe, `gh` dies with SIGPIPE (141), pipefail
#      propagates it, and a `!` flips a real match into a false rejection —
#      timing-dependent, so it failed intermittently (portal #1442). Capture
#      the list into a variable, then grep the variable.
#   3. Resolve the repo label list BEFORE any branch that needs it, or `set -u`
#      aborts on the unset variable when a flag was not passed.
#   4. Extract refs with a single anchored pattern, so the labels and the
#      linkage can never disagree over two divergent regexes.

# ── Which label axes a PR inherits from its issue ────────────────────
# area: board tracking (pr-label-gate requires it). size: velocity reporting.
# theme: cross-cutting programme. NOT priority: — a PR has no priority of its
# own; it either lands or it doesn't. NOT meta: — `meta:agent-discovered`
# describes how the ISSUE was found, which says nothing about the PR.
PR_LABEL_INHERIT_RE='^(area|size|theme):'

# type_label_for_title <pr-title> — the Type label a conventional-commit prefix
# implies, or empty. Only feat/fix carry one; every other type (docs, chore,
# refactor, ci, test) has no Type label in any Brik repo's taxonomy. brikdesigns
# has NEITHER `enhancement` nor `bug` today, so these map to names that
# label_known then filters out — the existence check (fix 1) is what keeps that
# from taking the whole `gh pr edit` down with it.
type_label_for_title() {
  case "${1:-}" in
    feat*) printf 'enhancement' ;;
    fix*)  printf 'bug' ;;
    *)     printf '' ;;
  esac
}

# refs_from_commit_range <text> — every issue number in the text, one per line,
# sorted and deduped. In this repo the text is the commit range's log; in
# brik-bds/portal it is the rendered issue-links block. Either way it is the
# single source the inherited labels key off, so linkage and labels agree.
refs_from_commit_range() {
  printf '%s\n' "${1:-}" | grep -oE '#[0-9]+' | tr -d '#' | sort -un || true
}

# label_known <label> <repo-labels> — is this label real in this repo?
label_known() {
  grep -qxF "${1:-}" <<< "${2:-}"
}

# inheritable_labels <issue-labels> — the subset of one issue's labels a PR
# inherits. Applies the axis policy only; the caller then existence-checks each
# survivor with label_known, because a label the issue has and this repo does
# not must be dropped rather than passed to `gh pr edit`.
inheritable_labels() {
  printf '%s\n' "${1:-}" | grep -E "$PR_LABEL_INHERIT_RE" || true
}

# has_area_label <labels> — does this set satisfy pr-label-gate?
has_area_label() {
  printf '%s\n' "${1:-}" | grep -q '^area:'
}

# dedupe_labels <labels> — sorted, deduped, blank lines dropped. The shape
# `gh pr edit --add-label` wants, one per line.
dedupe_labels() {
  printf '%s\n' "${1:-}" | grep -v '^[[:space:]]*$' | sort -u || true
}

# ── CLI (never runs when sourced) ──────────────────────────────────
if [ "${BASH_SOURCE[0]:-}" = "${0:-}" ]; then
  type_label_for_title "${1:-}"
fi
