#!/usr/bin/env bash
# pr-task.sh — Push the current BDS task branch and create a PR.
#
# Targets origin/main. Generates a summary from the commit log automatically.
#
# Usage:
#   ./scripts/pr-task.sh              # auto-generate title + body from commits
#   ./scripts/pr-task.sh "Custom PR title"   # override title
#
# Requirements:
#   - Must be on a task/* branch (not main).
#   - Branch must have commits ahead of main.
#   - gh CLI must be authenticated.

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

BASE_BRANCH="main"

# ── Parse flags ──
POSITIONAL_ARGS=()
while [[ $# -gt 0 ]]; do
  case "$1" in
    --skip-story-check)
      SKIP_STORY_CHECK=1
      shift
      ;;
    -*)
      echo -e "${RED}Unknown flag: $1${NC}"
      exit 1
      ;;
    *)
      POSITIONAL_ARGS+=("$1")
      shift
      ;;
  esac
done
set -- "${POSITIONAL_ARGS[@]+"${POSITIONAL_ARGS[@]}"}"

# ── Validate branch ──
BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [[ "$BRANCH" == "main" ]]; then
  echo -e "${RED}Error: Cannot create PR from 'main'. Switch to a task/* branch.${NC}"
  exit 1
fi

if [[ ! "$BRANCH" =~ ^task/ ]]; then
  echo -e "${YELLOW}Warning: Branch '$BRANCH' doesn't follow task/* naming convention.${NC}"
fi

# ── Check for commits ahead of base ──
COMMITS_AHEAD=$(git rev-list --count "${BASE_BRANCH}..HEAD" 2>/dev/null || echo "0")
if [ "$COMMITS_AHEAD" -eq 0 ]; then
  echo -e "${RED}Error: No commits ahead of ${BASE_BRANCH}. Nothing to PR.${NC}"
  exit 1
fi

# ── Check for uncommitted changes ──
if [ -n "$(git status --porcelain)" ]; then
  echo -e "${RED}Error: Working tree is dirty. Commit changes before creating PR.${NC}"
  echo ""
  git status --short
  exit 1
fi

# ── Story-verification gate ──
# If the diff touches a React component (.tsx) or its CSS, confirm the
# agent verified the change in Storybook. BDS components without a
# corresponding story update are suspect — Storybook IS the test harness.
# Override with --skip-story-check for type-only or internal-lib changes.
if [[ "${SKIP_STORY_CHECK:-}" != "1" ]]; then
  git fetch origin "${BASE_BRANCH}" --quiet 2>/dev/null || true
  COMPONENT_TOUCHED=$(
    { git diff --name-only "origin/${BASE_BRANCH}...HEAD" 2>/dev/null || true; } \
      | grep -E '^components/.*\.(tsx|css)$' \
      | grep -vE '\.stories\.|\.test\.|\.spec\.|\.d\.ts$' \
      | head -5 || true
  )
  if [ -n "$COMPONENT_TOUCHED" ]; then
    echo ""
    echo -e "${YELLOW}⚠  This branch touches BDS component files:${NC}"
    echo "$COMPONENT_TOUCHED" | sed 's/^/    /'
    echo ""
    echo -e "${YELLOW}   Project rule: component changes must be verified in Storybook (npm run storybook)${NC}"
    echo -e "${YELLOW}   before opening a PR. Typecheck alone is not sufficient.${NC}"
    echo ""
    echo -n "   Verified in Storybook? [y/N] (or set SKIP_STORY_CHECK=1 for non-visual diffs): "
    read -r STORY_CONFIRM
    if [[ ! "$STORY_CONFIRM" =~ ^[Yy]$ ]]; then
      echo -e "${RED}✗ PR creation blocked. Verify the change in Storybook, then re-run.${NC}"
      exit 1
    fi
  fi
fi

# ── Check if PR already exists ──
EXISTING_PR=$(gh pr list --head "$BRANCH" --json number --jq '.[0].number' 2>/dev/null || echo "")
if [ -n "$EXISTING_PR" ]; then
  PR_URL=$(gh pr view "$EXISTING_PR" --json url --jq '.url')
  echo -e "${GREEN}PR already exists: ${PR_URL}${NC}"
  exit 0
fi

# ── Sync with base (catches semantic conflicts from parallel work) ──
echo -e "${YELLOW}~ Fetching origin/${BASE_BRANCH}...${NC}"
git fetch origin "${BASE_BRANCH}" --quiet

BEHIND=$(git rev-list --count "HEAD..origin/${BASE_BRANCH}")
if [ "$BEHIND" -gt 0 ]; then
  echo -e "${YELLOW}~ Base moved ${BEHIND} commit(s) ahead — merging to detect semantic conflicts...${NC}"
  if ! git merge --no-edit "origin/${BASE_BRANCH}"; then
    echo ""
    echo -e "${RED}✗ Merge conflict with ${BASE_BRANCH}. Resolve manually, commit, re-run.${NC}"
    exit 1
  fi
  echo -e "${YELLOW}~ Re-running test suite against merged tree...${NC}"
  if ! npm test -- --run 2>&1 | tail -5 | grep -qE "passed|no tests"; then
    echo ""
    echo -e "${RED}✗ Tests failed after merging ${BASE_BRANCH}.${NC}"
    echo -e "${RED}  A parallel PR introduced an incompatible change. Fix locally, commit, re-run.${NC}"
    exit 1
  fi
fi

# ── Push if needed ──
UPSTREAM=$(git rev-parse --abbrev-ref --symbolic-full-name @{u} 2>/dev/null || echo "")
EXPECTED_UPSTREAM="origin/${BRANCH}"
if [ -z "$UPSTREAM" ] || [ "$UPSTREAM" != "$EXPECTED_UPSTREAM" ]; then
  echo -e "${YELLOW}~ Pushing branch to origin (setting upstream)...${NC}"
  git push -u origin "$BRANCH"
else
  LOCAL=$(git rev-parse HEAD)
  REMOTE=$(git rev-parse @{u} 2>/dev/null || echo "")
  if [ "$LOCAL" != "$REMOTE" ]; then
    echo -e "${YELLOW}~ Pushing new commits to origin...${NC}"
    git push
  fi
fi

# ── Build PR title ──
if [ $# -ge 1 ]; then
  PR_TITLE="$1"
else
  # Auto-generate: task/bds-button-variants → bds: button variants
  SCOPE=$(echo "$BRANCH" | sed 's|task/||' | cut -d'-' -f1)
  DESC=$(echo "$BRANCH" | sed 's|task/[a-z]*-||' | tr '-' ' ')
  PR_TITLE="${SCOPE}: ${DESC}"
fi

# ── Build PR body from commit log ──
COMMIT_LOG=$(git log --oneline "${BASE_BRANCH}..HEAD" --reverse)
COMMIT_BULLETS=$(echo "$COMMIT_LOG" | sed 's/^[a-f0-9]* /- /')

PR_BODY=$(cat <<EOF
## Summary
${COMMIT_BULLETS}

## Consumer sync plan
- [ ] Portal: \`npm update @brikdesigns/bds\` after merge + version publish
- [ ] renew-pms: submodule bump (until npm migration lands)
- [ ] brikdesigns: \`./scripts/bds-sync.sh\`

## Test plan
- [ ] Storybook: visual verification on affected stories
- [ ] \`npm test -- --run\` passes
- [ ] \`npm run lint-tokens\` passes
- [ ] Dark mode checked (if applicable)

Generated with [Claude Code](https://claude.ai/code)
EOF
)

# ── Create PR ──
echo -e "${YELLOW}~ Creating PR targeting ${BASE_BRANCH}...${NC}"
PR_URL=$(gh pr create --base "${BASE_BRANCH}" --title "$PR_TITLE" --body "$PR_BODY" 2>&1)

echo ""
echo -e "${GREEN}=========================================${NC}"
echo -e "${GREEN}  PR created${NC}"
echo -e "${GREEN}=========================================${NC}"
echo ""
echo "  $PR_URL"
echo ""
echo "  Branch:  $BRANCH → ${BASE_BRANCH}"
echo "  Commits: $COMMITS_AHEAD ahead of ${BASE_BRANCH}"
echo ""

# ── Worktree cleanup hint ──
WORKTREE_DIR=$(git rev-parse --show-toplevel)
if [[ "$WORKTREE_DIR" == *"worktrees"* ]]; then
  echo -e "  ${YELLOW}Cleanup (run after PR is merged):${NC}"
  echo "    rm -rf ${WORKTREE_DIR}"
  echo "    cd $(dirname "$WORKTREE_DIR")/../brikdesigns && git worktree prune"
  echo ""
fi
