#!/usr/bin/env bash
# worktree-check.sh — SessionStart + PreToolUse hook that verifies the
# primary worktree is on `main`.
#
# Why: silent branch drift in the primary worktree cross-contaminates
# work between concurrent agents. See scripts/worktree-guard.sh for the
# full rationale.
#
# This hook is non-blocking on SessionStart (warn only) and non-blocking
# on PreToolUse by default (warn only). Set BDS_WORKTREE_GUARD=strict to
# convert PreToolUse warnings into blocking errors.

set -eu

# Resolve repo root from the tool input if available (PreToolUse), else cwd.
INPUT="${1:-}"
if [ -z "$INPUT" ] && [ ! -t 0 ]; then
  INPUT="$(cat || true)"
fi

FILE_PATH=""
if [ -n "$INPUT" ] && command -v jq >/dev/null 2>&1; then
  FILE_PATH="$(printf '%s' "$INPUT" | jq -r '.tool_input.file_path // empty' 2>/dev/null || true)"
fi

REPO_ROOT=""
if [ -n "$FILE_PATH" ]; then
  REPO_ROOT="$(git -C "$(dirname "$FILE_PATH")" rev-parse --show-toplevel 2>/dev/null || true)"
fi
if [ -z "$REPO_ROOT" ]; then
  REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
fi

# Not a git repo? Nothing to check.
[ -z "$REPO_ROOT" ] && exit 0

GUARD="$REPO_ROOT/scripts/worktree-guard.sh"

# Only fire inside brik-bds — other repos don't have this script.
[ ! -x "$GUARD" ] && exit 0

MODE="${BDS_WORKTREE_GUARD:-warn}"

if [ "$MODE" = "strict" ]; then
  "$GUARD" --strict
  exit $?
fi

"$GUARD"
exit 0
