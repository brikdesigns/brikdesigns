#!/usr/bin/env bash
# worktree-guard.sh — verify the primary worktree isn't sitting on a task branch.
#
# Why this exists: the primary checkout at `/Documents/GitHub/brik/brik-bds`
# is the shared reference copy. When a session silently switches it to a
# `task/*` branch — usually via a SessionStart hook or a manual checkout
# that was never reverted — every subsequent agent inherits the wrong state.
# The 2026-04-21 Phase B incident captured this class of bug: an agent's
# WIP on `task/industry-navigation-ia` was sitting in the primary worktree
# while a concurrent session tried to do Theming cleanup from the same path.
# Files got cross-contaminated across branches.
#
# The rule: the primary worktree lives on `main`. Task work lives in
# `../brik-bds-worktrees/{slug}`. See scripts/new-task.sh.
#
# Usage:
#   ./scripts/worktree-guard.sh           # warn only (exit 0)
#   ./scripts/worktree-guard.sh --strict  # fail on violation (exit 1)
#   ./scripts/worktree-guard.sh --json    # structured output for hooks
#
# Exit codes:
#   0  — primary is on main (or we're not in the primary)
#   1  — primary is on a task branch (only when --strict)
#   2  — not inside a git repo / invocation error

set -eu

STRICT=0
JSON=0

for arg in "$@"; do
  case "$arg" in
    --strict) STRICT=1 ;;
    --json)   JSON=1 ;;
    -h|--help)
      sed -n '2,25p' "$0" | sed 's/^# //;s/^#//'
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

CURRENT_PATH="$(git rev-parse --show-toplevel)"
CURRENT_BRANCH="$(git branch --show-current || echo '(detached)')"

IN_PRIMARY=0
if [ "$CURRENT_PATH" = "$PRIMARY_PATH" ]; then
  IN_PRIMARY=1
fi

VIOLATION=0
if [ "$PRIMARY_BRANCH" != "main" ]; then
  VIOLATION=1
fi

if [ "$JSON" = "1" ]; then
  printf '{"primary_path":"%s","primary_branch":"%s","current_path":"%s","current_branch":"%s","in_primary":%s,"violation":%s}\n' \
    "$PRIMARY_PATH" "$PRIMARY_BRANCH" "$CURRENT_PATH" "$CURRENT_BRANCH" "$IN_PRIMARY" "$VIOLATION"
else
  if [ "$VIOLATION" = "1" ]; then
    RED='\033[0;31m'
    YELLOW='\033[1;33m'
    NC='\033[0m'
    printf '%b\n' "${RED}⚠  Primary worktree is on '${PRIMARY_BRANCH}', not 'main'.${NC}" >&2
    printf '%b\n' "${YELLOW}   Path: ${PRIMARY_PATH}${NC}" >&2
    printf '%b\n' "${YELLOW}   Fix:  cd ${PRIMARY_PATH} && git switch main${NC}" >&2
    printf '%b\n' "${YELLOW}   For the task work, use: ./scripts/new-task.sh {scope}-{name}${NC}" >&2
  fi
fi

if [ "$STRICT" = "1" ] && [ "$VIOLATION" = "1" ]; then
  exit 1
fi

exit 0
