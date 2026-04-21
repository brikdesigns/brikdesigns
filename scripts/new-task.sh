#!/usr/bin/env bash
# new-task.sh — Create an isolated git worktree for a single BDS task.
#
# Branches from origin/main. Enforces task/{scope}-{name} naming.
# Installs dependencies in the new worktree.
#
# Usage:
#   ./scripts/new-task.sh {scope}-{name}
#   ./scripts/new-task.sh bds-button-variants
#   ./scripts/new-task.sh tokens-figma-pull
#
# Creates:
#   ../brikdesigns-worktrees/{scope}-{name}/   on branch  task/{scope}-{name}
#
# Requirements:
#   - Must be run from the repo root.
#   - Requires a clean working tree (no uncommitted changes).
#
# Why this exists: the shared main-repo `.git/HEAD` drifts silently when a
# second session checks out a task/* branch, and every edit afterward lands
# on the wrong branch. Worktrees are the fix — each session gets its own
# HEAD. See the Git Release Workflow Notion doc (Per-Repo Playbook table
# flagged BDS worktrees "Critical" after the 2026-04-19 incident).

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# ── Config ──
BASE_BRANCH="main"

# ── Resolve repo root ──
PROJECT_ROOT="$(git rev-parse --show-toplevel)"
WORKTREE_BASE="$(dirname "$PROJECT_ROOT")/brikdesigns-worktrees"

# ── Must run from the primary worktree on main ──
# Running new-task.sh from inside another task worktree creates nested state
# that breaks the one-worktree-per-task contract. The primary worktree is
# also the one place main is meant to live — if it's on a task branch,
# something else already broke.
PRIMARY_PATH="$(git worktree list --porcelain | awk '/^worktree /{print $2; exit}')"
if [ "$PROJECT_ROOT" != "$PRIMARY_PATH" ]; then
  echo -e "${RED}Error: new-task.sh must be run from the primary worktree.${NC}"
  echo ""
  echo "  Here:    $PROJECT_ROOT"
  echo "  Primary: $PRIMARY_PATH"
  echo ""
  echo "  cd into the primary worktree first:"
  echo "    cd $PRIMARY_PATH && ./scripts/new-task.sh $*"
  exit 1
fi

PRIMARY_BRANCH="$(git -C "$PRIMARY_PATH" branch --show-current || echo '(detached)')"
case "$PRIMARY_BRANCH" in
  main|staging) ;;
  *)
    echo -e "${RED}Error: primary worktree is on '${PRIMARY_BRANCH}', not a base branch.${NC}"
    echo ""
    echo "  The primary worktree at $PRIMARY_PATH must stay on ${BASE_BRANCH} (or staging)."
    echo "  Task work lives in ../brikdesigns-worktrees/{slug} — never in the primary."
    echo ""
    echo "  To fix:"
    echo "    cd $PRIMARY_PATH"
    echo "    git status                  # inspect any uncommitted work"
    echo "    git switch ${BASE_BRANCH}   # return to the base branch"
    exit 1
    ;;
esac

# ── Parse flags ──
while [[ $# -gt 0 ]]; do
  case "$1" in
    --base)
      BASE_BRANCH="$2"
      shift 2
      ;;
    -*)
      echo -e "${RED}Unknown flag: $1${NC}"
      exit 1
      ;;
    *)
      break
      ;;
  esac
done

# ── Validate input ──
if [ $# -lt 1 ]; then
  echo -e "${RED}Usage: $0 [--base branch] {scope}-{name}${NC}"
  echo ""
  echo "  scope = area of the site (marketing, content, seo, site, infra, docs, intel)"
  echo "  name  = what the task delivers (hero-rework, pricing-copy, analytics-4-setup)"
  echo ""
  echo "  Example: $0 marketing-hero-rework"
  echo "  Example: $0 content-pricing-copy"
  echo ""
  echo "  Base branch: ${BASE_BRANCH} (override with --base)"
  exit 1
fi

TASK_NAME="$1"
BRANCH_NAME="task/${TASK_NAME}"

# ── Validate naming convention ──
if [[ ! "$TASK_NAME" =~ ^[a-z]+-[a-z0-9]+ ]]; then
  echo -e "${RED}Error: Task name must follow {scope}-{name} pattern.${NC}"
  echo ""
  echo "  Got:      $TASK_NAME"
  echo "  Expected: {scope}-{name}  (e.g., marketing-hero-rework, infra-worktree-guard)"
  echo ""
  echo "  Valid scopes: marketing, content, seo, site, infra, docs, intel"
  exit 1
fi

# ── Check for clean working tree ──
if [ -n "$(git status --porcelain)" ]; then
  echo -e "${RED}Error: Working tree is dirty. Commit or stash changes first.${NC}"
  echo ""
  git status --short
  exit 1
fi

# ── Check branch doesn't already exist ──
if git show-ref --verify --quiet "refs/heads/${BRANCH_NAME}"; then
  echo -e "${RED}Error: Branch '${BRANCH_NAME}' already exists.${NC}"
  echo ""
  echo "  To resume:  cd ${WORKTREE_BASE}/${TASK_NAME}"
  echo "  To delete:  git branch -d ${BRANCH_NAME}"
  exit 1
fi

# ── Check for branch name reuse (previous PRs) ──
if command -v gh &>/dev/null; then
  PRIOR_PRS=$(gh pr list --state all --head "${BRANCH_NAME}" --json number,state --jq '.[] | "#\(.number) (\(.state))"' 2>/dev/null || true)
  if [ -n "$PRIOR_PRS" ]; then
    echo -e "${YELLOW}⚠  Branch name '${BRANCH_NAME}' was used in previous PRs:${NC}"
    echo "$PRIOR_PRS" | sed 's/^/    /'
    echo ""
    echo -e "${YELLOW}   Reusing names makes PR history confusing.${NC}"
    echo -e "${YELLOW}   Consider: task/${TASK_NAME}-v2 or a more specific name.${NC}"
    echo -e "${YELLOW}   Press Enter to continue anyway, Ctrl+C to abort.${NC}"
    read -r
  fi
fi

# ── Check for overlapping scope (local branches) ──
SCOPE_KEYWORD="${TASK_NAME%%-*}"
SIMILAR_BRANCHES=$(git branch -r 2>/dev/null | grep -i "origin/task/.*${SCOPE_KEYWORD}" | grep -v HEAD || true)
if [ -n "$SIMILAR_BRANCHES" ]; then
  echo -e "${YELLOW}⚠  Branches with similar scope already exist:${NC}"
  echo "$SIMILAR_BRANCHES" | sed 's/^/    /'
  echo ""
  echo -e "${YELLOW}   Verify these don't overlap before proceeding.${NC}"
  echo -e "${YELLOW}   Press Enter to continue, Ctrl+C to abort.${NC}"
  read -r
fi

# ── Check open PRs for file-level overlap ──
# Parallel PRs that touch the same files cause cascading rebase conflicts
# (see the 2026-04-19 portal #257 ↔ #258 incident captured in the Notion
# Git Release Workflow doc). Warn when open PRs touch files whose path
# fragment matches the task scope.
if command -v gh &>/dev/null; then
  OPEN_PR_FILES=$(gh pr list --state open --json number,title,files --jq \
    '.[] | "\(.number)\t\(.title)\t\(.files | map(.path) | join(","))"' 2>/dev/null || true)
  if [ -n "$OPEN_PR_FILES" ]; then
    # Heuristic: tasks with the same descriptor likely touch the same directory.
    # e.g. "bds-button-variants" → check PRs touching any "*button*" file.
    DESC_KEYWORD=$(echo "$TASK_NAME" | cut -d'-' -f2)
    OVERLAPPING=$(echo "$OPEN_PR_FILES" | grep -i "${DESC_KEYWORD}" || true)
    if [ -n "$OVERLAPPING" ]; then
      echo -e "${YELLOW}⚠  Open PR(s) may touch the same area as '${TASK_NAME}':${NC}"
      echo "$OVERLAPPING" | awk -F'\t' '{ printf "    PR #%s — %s\n", $1, $2 }'
      echo ""
      echo -e "${YELLOW}   Parallel work on overlapping files = cascading rebase conflicts.${NC}"
      echo -e "${YELLOW}   Options:${NC}"
      echo -e "${YELLOW}     1) Wait for the open PR(s) to merge, then start this task${NC}"
      echo -e "${YELLOW}     2) Chain this branch off the open PR instead of main${NC}"
      echo -e "${YELLOW}     3) Proceed (accept the rebase cost)${NC}"
      echo ""
      echo -e "${YELLOW}   Press Enter to proceed, Ctrl+C to abort.${NC}"
      read -r
    fi
  fi
fi

# ── Fetch and branch from base ──
echo -e "${YELLOW}▸ Fetching latest ${BASE_BRANCH}...${NC}"
git fetch origin "${BASE_BRANCH}" --quiet

echo -e "${YELLOW}▸ Creating worktree at ${WORKTREE_BASE}/${TASK_NAME}...${NC}"
mkdir -p "$WORKTREE_BASE"
git worktree add "${WORKTREE_BASE}/${TASK_NAME}" -b "${BRANCH_NAME}" "origin/${BASE_BRANCH}"

cd "${WORKTREE_BASE}/${TASK_NAME}"

# ── Install dependencies ──
# BDS has no .env — no secrets to copy. Just deps.
echo -e "${YELLOW}▸ Installing dependencies (npm ci --prefer-offline)...${NC}"
npm ci --prefer-offline 2>&1 | tail -1

# ── Summary ──
echo ""
echo -e "${GREEN}═══════════════════════════════════════${NC}"
echo -e "${GREEN}  Task worktree ready (brikdesigns)${NC}"
echo -e "${GREEN}═══════════════════════════════════════${NC}"
echo ""
echo "  Branch:    ${BRANCH_NAME}"
echo "  Worktree:  ${WORKTREE_BASE}/${TASK_NAME}"
echo "  Based on:  origin/${BASE_BRANCH}"
echo ""
echo "  Next steps:"
echo "    cd ${WORKTREE_BASE}/${TASK_NAME}"
echo "    claude -p \"Task: ... Follow CLAUDE.md rules.\""
echo ""
echo "  Before merge: sync all 3 consumers (portal, renew-pms, brikdesigns)."
echo ""
echo "  When done (REQUIRED — branches without PRs rot):"
echo "    git diff ${BASE_BRANCH}..${BRANCH_NAME}   # review changes"
echo "    ./scripts/pr-task.sh             # push + create PR (mandatory)"
echo ""
