#!/usr/bin/env bash
# session-guard.sh — PreToolUse hook for Edit/Write operations
#
# Two checks, each fires at most once per parent shell:
#   1. Warns Claude when the working tree has uncommitted changes from a
#      prior session.
#   2. If the current edit targets a UI file (.tsx / .css / .stories.*)
#      and the BDS Storybook isn't already running on port 6006, starts
#      it in the background so the storybook-mcp server becomes
#      reachable. Silent on success — agents shouldn't need to think
#      about whether Storybook is up.
#
# Hook input: JSON on stdin with tool_name and tool_input fields.
# Exit 0 = allow, non-zero = block (we always allow but warn via stdout).

set -euo pipefail

INPUT=$(cat)
TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name')

# Only trigger on file-modifying tools
case "$TOOL_NAME" in
  Edit|Write|NotebookEdit) ;;
  *) exit 0 ;;
esac

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Once-per-session keying
PARENT_PID=$(ps -o ppid= -p $$ 2>/dev/null | tr -d ' ')
DIRTY_MARKER="/tmp/.brikdesigns-session-guard-${PARENT_PID:-unknown}"
STORYBOOK_MARKER="/tmp/.brik-storybook-autostart-${PARENT_PID:-unknown}"

# ── Storybook autostart (fires once per session on first UI edit) ──
maybe_start_storybook() {
  [[ -f "$STORYBOOK_MARKER" ]] && return 0

  # Extract target file path from tool_input
  local file_path
  file_path=$(echo "$INPUT" | jq -r '.tool_input.file_path // .tool_input.notebook_path // empty')
  [[ -z "$file_path" ]] && return 0

  # Only act on UI-relevant extensions
  case "$file_path" in
    *.tsx|*.jsx|*.css|*.scss|*.stories.ts|*.stories.tsx|*.stories.js|*.stories.jsx) ;;
    *) return 0 ;;
  esac

  touch "$STORYBOOK_MARKER"

  # Already running? nothing to do.
  if curl -s -o /dev/null --max-time 1 http://localhost:6006/ 2>/dev/null; then
    return 0
  fi

  # Locate BDS repo. Fall back silently if not on this machine.
  local bds_dir="$HOME/Documents/GitHub/brik/brik-bds"
  [[ -d "$bds_dir" && -f "$bds_dir/package.json" ]] || return 0

  echo ""
  echo "🔧  Storybook not running on :6006 — starting in background for the BDS MCP."
  echo "    Logs: /tmp/brik-storybook.log"
  echo ""

  (
    cd "$bds_dir"
    nohup npm run storybook > /tmp/brik-storybook.log 2>&1 &
    disown
  ) >/dev/null 2>&1 || true
}

maybe_start_storybook

# ── Dirty-tree warning ────────────────────────────────────────────────
if [[ ! -f "$DIRTY_MARKER" ]]; then
  touch "$DIRTY_MARKER"

  cd "$PROJECT_ROOT"

  DIRTY_COUNT=$(git status --porcelain 2>/dev/null | wc -l | tr -d ' ')
  if [[ "$DIRTY_COUNT" -gt 0 ]]; then
    BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")
    echo ""
    echo "⚠️  SESSION GUARD: $DIRTY_COUNT uncommitted change(s) on '$BRANCH'."
    echo "   These may be from a prior session. Review before continuing:"
    echo ""
    git status --short 2>/dev/null | head -15
    if [[ "$DIRTY_COUNT" -gt 15 ]]; then
      echo "   ... and $((DIRTY_COUNT - 15)) more"
    fi
    echo ""
    echo "   → Commit, stash, or discard before starting new work."
    echo ""
  fi

  # BDS submodule pointer check — the only dirty state that's actually
  # expected during BDS-sync flows.
  if [[ -f "$PROJECT_ROOT/brik-bds/.git" ]]; then
    SUBMODULE_STATUS=$(git submodule status brik-bds 2>/dev/null || echo "")
    if [[ "$SUBMODULE_STATUS" == +* ]]; then
      echo "⚠️  SESSION GUARD: BDS submodule has uncommitted pointer change."
      echo "   Run your BDS-sync script or commit the submodule update."
      echo ""
    fi
  fi
fi

exit 0
