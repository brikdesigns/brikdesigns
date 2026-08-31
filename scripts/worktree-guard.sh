#!/usr/bin/env bash
# worktree-guard.sh — verify the primary worktree isn't sitting on a task branch.
#
# CANONICAL COPY lives in brik-llm. brik-bds, brik-client-portal and brikdesigns
# carry byte-identical copies; the consumer set and the drift gate that keeps
# them in sync are scripts/audit/overlap-twin-drift.py (brik-llm). NEVER edit a
# consumer copy — fix here and re-sync, or overlap-twin-drift reads the edit as
# drift, not an improvement.
#
# Why this exists: the primary checkout is the shared reference copy. When a
# session silently switches it to a `task/*` branch — usually via a SessionStart
# hook or a manual checkout that was never reverted — every subsequent agent
# inherits the wrong state. The 2026-04-21 BDS Phase B incident captured this
# class of bug: an agent's WIP on `task/industry-navigation-ia` was sitting in
# the primary worktree while a concurrent session tried to do Theming cleanup
# from the same path. Files got cross-contaminated across branches.
#
# The rule: the primary worktree lives on a base branch (`main` or `staging`).
# Task work lives in `../{repo}-worktrees/{slug}`. See scripts/new-task.sh.
#
# Usage:
#   ./scripts/worktree-guard.sh           # warn only (exit 0)
#   ./scripts/worktree-guard.sh --strict  # fail on violation (exit 1)
#   ./scripts/worktree-guard.sh --json    # structured output for hooks
#
# Exit codes:
#   0  — primary is on a base branch and clean (or we're not in the primary)
#   1  — primary is on a task branch, or dirty while standing in it (--strict)
#   2  — not inside a git repo / invocation error

set -eu

STRICT=0
JSON=0

for arg in "$@"; do
  case "$arg" in
    --strict) STRICT=1 ;;
    --json)   JSON=1 ;;
    -h|--help)
      sed -n '2,29p' "$0" | sed 's/^# //;s/^#//'
      exit 0
      ;;
  esac
done

if ! git rev-parse --git-dir >/dev/null 2>&1; then
  echo "worktree-guard: not a git repository" >&2
  exit 2
fi

# The first entry in `git worktree list --porcelain` is always the primary
# (the main checkout, as opposed to an added worktree).
PRIMARY_PATH="$(git worktree list --porcelain | awk '/^worktree /{print $2; exit}')"
if [ -z "$PRIMARY_PATH" ]; then
  echo "worktree-guard: could not resolve primary worktree" >&2
  exit 2
fi

PRIMARY_BRANCH="$(git -C "$PRIMARY_PATH" branch --show-current || echo '(detached)')"
PRIMARY_DIRTY_COUNT=$(git -C "$PRIMARY_PATH" status --porcelain 2>/dev/null | wc -l | tr -d ' ')

CURRENT_PATH="$(git rev-parse --show-toplevel)"
CURRENT_BRANCH="$(git branch --show-current || echo '(detached)')"

IN_PRIMARY=0
if [ "$CURRENT_PATH" = "$PRIMARY_PATH" ]; then
  IN_PRIMARY=1
fi

# Two violation modes (either trips the guard):
#   1) primary on a non-base branch (task/*, fix/*, etc.). The accepted set
#      {main, staging} is a superset — a repo without a staging branch still
#      passes, because the primary will never land there.
#   2) primary on a base branch with uncommitted task work while you are
#      standing in it — the failure mode that slipped past the original guard
#      wording (brik-llm#2635).
VIOLATION=1
case "$PRIMARY_BRANCH" in
  main|staging) VIOLATION=0 ;;
esac

DIRTY_VIOLATION=0
if [ "$VIOLATION" = "0" ] && [ "$IN_PRIMARY" = "1" ] && [ "$PRIMARY_DIRTY_COUNT" -gt 0 ]; then
  DIRTY_VIOLATION=1
  VIOLATION=1
fi

# The recovery branch suggested in the warning — prefer main, fall back to
# staging if the repo doesn't have main locally (edge case).
SUGGEST_BRANCH="main"
if ! git -C "$PRIMARY_PATH" show-ref --verify --quiet refs/heads/main \
   && git -C "$PRIMARY_PATH" show-ref --verify --quiet refs/heads/staging; then
  SUGGEST_BRANCH="staging"
fi

if [ "$JSON" = "1" ]; then
  printf '{"primary_path":"%s","primary_branch":"%s","current_path":"%s","current_branch":"%s","in_primary":%s,"primary_dirty_count":%s,"violation":%s,"dirty_violation":%s}\n' \
    "$PRIMARY_PATH" "$PRIMARY_BRANCH" "$CURRENT_PATH" "$CURRENT_BRANCH" "$IN_PRIMARY" "$PRIMARY_DIRTY_COUNT" "$VIOLATION" "$DIRTY_VIOLATION"
else
  if [ "$VIOLATION" = "1" ]; then
    RED='\033[0;31m'
    YELLOW='\033[1;33m'
    NC='\033[0m'
    if [ "$DIRTY_VIOLATION" = "1" ]; then
      printf '%b\n' "${RED}⚠  Primary worktree has ${PRIMARY_DIRTY_COUNT} uncommitted change(s) on '${PRIMARY_BRANCH}'.${NC}" >&2
      printf '%b\n' "${YELLOW}   Path: ${PRIMARY_PATH}${NC}" >&2
      printf '%b\n' "${YELLOW}   Task work belongs in a worktree, not on the primary.${NC}" >&2
      printf '%b\n' "${YELLOW}   Fix:  cd ${PRIMARY_PATH} && git stash --include-untracked${NC}" >&2
      printf '%b\n' "${YELLOW}         ./scripts/new-task.sh {slug}${NC}" >&2
      printf '%b\n' "${YELLOW}         cd ../{repo}-worktrees/{slug} && git stash pop${NC}" >&2
    else
      printf '%b\n' "${RED}⚠  Primary worktree is on '${PRIMARY_BRANCH}', not a base branch.${NC}" >&2
      printf '%b\n' "${YELLOW}   Path: ${PRIMARY_PATH}${NC}" >&2
      printf '%b\n' "${YELLOW}   Fix:  cd ${PRIMARY_PATH} && git switch ${SUGGEST_BRANCH}${NC}" >&2
      printf '%b\n' "${YELLOW}   For the task work, use: ./scripts/new-task.sh {slug}${NC}" >&2
    fi
  fi
fi

if [ "$STRICT" = "1" ] && [ "$VIOLATION" = "1" ]; then
  exit 1
fi

exit 0
