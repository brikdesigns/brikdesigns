#!/usr/bin/env bash
# Pre-commit hook: scan staged content for leaked secrets via gitleaks.
#
# Install (per clone, since hooks aren't tracked):
#   ./scripts/install-hooks.sh
# or manually:
#   ln -sf ../../scripts/git-hooks/pre-commit-gitleaks.sh .git/hooks/pre-commit
#
# Bypass (use sparingly, with intent):
#   git commit --no-verify
#
# Bypassing is itself a signal — log it. Pre-commit is one of three layers
# (pre-commit + GitHub push protection + secret scanning). All three matter.
# Modeled on brik-llm/scripts/git-hooks/pre-commit-gitleaks.sh; the
# Brik-extended ruleset in .gitleaks.toml stays in sync across repos.

set -euo pipefail

if ! command -v gitleaks >/dev/null 2>&1; then
  echo "pre-commit: gitleaks not installed — run: brew install gitleaks" >&2
  exit 1
fi

# --staged scans the staged diff against the Brik-extended ruleset.
# --no-banner keeps the hook output tight.
# --redact ensures any finding is shown without echoing the matched secret.
# Resolve repo root so the hook works from any working directory.
repo_root=$(git rev-parse --show-toplevel)
config_arg=""
if [ -f "$repo_root/.gitleaks.toml" ]; then
  config_arg="--config $repo_root/.gitleaks.toml"
fi
gitleaks protect --staged --redact --no-banner --verbose $config_arg
