#!/usr/bin/env bash
# install-hooks.sh — Wire up the per-clone gitleaks pre-commit hook.
#
# Run once per fresh clone. Symlinks scripts/git-hooks/pre-commit-gitleaks.sh
# into .git/hooks/pre-commit. If .git/hooks/pre-commit already exists,
# refuses to overwrite without --force.
#
# Usage:
#   ./scripts/install-hooks.sh             # idempotent install
#   ./scripts/install-hooks.sh --force     # overwrite an existing hook

set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
HOOK_TARGET="../../scripts/git-hooks/pre-commit-gitleaks.sh"
HOOK_LINK="$REPO_ROOT/.git/hooks/pre-commit"

if ! command -v gitleaks >/dev/null 2>&1; then
  echo "✗ gitleaks not on PATH — install first:" >&2
  echo "    brew install gitleaks" >&2
  exit 1
fi

force=0
if [ "${1:-}" = "--force" ]; then
  force=1
fi

if [ -e "$HOOK_LINK" ] && [ "$force" -ne 1 ]; then
  current=$(readlink "$HOOK_LINK" 2>/dev/null || echo "<regular file>")
  if [ "$current" = "$HOOK_TARGET" ]; then
    echo "✓ pre-commit hook already wired to gitleaks (no change)."
    exit 0
  fi
  echo "✗ $HOOK_LINK already exists (points to: $current)" >&2
  echo "  Re-run with --force to replace, or remove it first." >&2
  exit 1
fi

ln -sf "$HOOK_TARGET" "$HOOK_LINK"
echo "✓ Installed gitleaks pre-commit hook → $HOOK_LINK"
echo "  To bypass on a single commit (sparingly): git commit --no-verify"
