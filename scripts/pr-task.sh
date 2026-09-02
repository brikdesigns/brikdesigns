#!/usr/bin/env bash
# pr-task.sh — Push current task branch and create a PR.
#
# Automates the push→PR step so branches don't go stale.
# Generates a summary from the commit log automatically.
# Targets BASE_BRANCH (default: staging). Use --base to override.
#
# Usage:
#   ./scripts/pr-task.sh              # auto-generate title + body from commits
#   ./scripts/pr-task.sh "Custom PR title"   # override title
#   ./scripts/pr-task.sh --base main         # target main instead of staging
#
# Requirements:
#   - Must be on a task/* branch (not main or staging).
#   - Branch must have commits ahead of base branch.
#   - gh CLI must be authenticated.
#
# brikdesigns runs staging-first: task PRs target `staging`. Promote `staging → main`
# via a separate PR after preview sign-off. Use `--base main` for hotfixes only.

set -euo pipefail

# Prevent shells that sourced ~/.secrets/brik-packages.env from inheriting
# PACKAGES_READ_TOKEN as GITHUB_TOKEN — gh CLI auths to that instead of the
# user's PAT, using a wrong-scope (read:packages) token for arbitrary gh calls.
unset GITHUB_TOKEN

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# ── Label resolver (pure, offline, tested by __tests__/test-pr-labels.sh) ──
# GitHub does NOT copy a linked issue's labels onto its PR, so PRs opened here
# were born label-less and fell off the project board (#1012). The resolution
# policy lives in lib/pr-labels.sh; this script supplies it with live data.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=scripts/lib/pr-labels.sh
source "${SCRIPT_DIR}/lib/pr-labels.sh"
# shellcheck source=scripts/lib/pr-title.sh
source "${SCRIPT_DIR}/lib/pr-title.sh"

# ── Base branch config ──
# staging-first flow: task branches PR to staging; staging → main promoted on sign-off.
BASE_BRANCH="staging"
AREA_OVERRIDE=""

# ── Parse flags ──
POSITIONAL_ARGS=()
while [[ $# -gt 0 ]]; do
  case "$1" in
    --base)
      BASE_BRANCH="$2"
      shift 2
      ;;
    --area)
      # Set the area:* label explicitly, for work whose linked issue carries no
      # area:* (or whose branch references no issue). Accept a bare word too.
      AREA_OVERRIDE="$2"
      [[ "$AREA_OVERRIDE" == area:* ]] || AREA_OVERRIDE="area:${AREA_OVERRIDE}"
      shift 2
      ;;
    --skip-ui-check)
      SKIP_UI_CHECK=1
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
if [[ "$BRANCH" == "main" || "$BRANCH" == "staging" ]]; then
  echo -e "${RED}Error: Cannot create PR from '$BRANCH'. Switch to a task/* branch.${NC}"
  exit 1
fi

if [[ ! "$BRANCH" =~ ^task/ ]]; then
  echo -e "${YELLOW}Warning: Branch '$BRANCH' doesn't follow task/* naming convention.${NC}"
fi

# ── Check for commits ahead of base ──
COMMITS_AHEAD=$(git rev-list --count "origin/${BASE_BRANCH}..HEAD" 2>/dev/null || echo "0")
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

# ── Parallel open-PR overlap check ──
# new-task.sh screens for overlapping work at task-creation time, but a parallel
# session can open an overlapping PR *after* this branch starts — invisible to a
# creation-time check. Re-check here, at the last point before we create a
# possibly-duplicate PR: compare this branch's changed files against every other
# open PR's files. Shared files mean duplicated effort or a forced rebase.
# (2026-07-04 #657: #663 and #664 both re-built parts of the Round 8 ready
# bucket and both touched services/[serviceLineSlug]/page.tsx — the duplication
# surfaced only after the fact. This is the guard that would have caught it.)
#
# TTY-aware: prompts only on an interactive terminal, so it never consumes the
# piped stdin an agent feeds the UI gate below. Non-interactive runs warn loudly
# and proceed (this is a coordination signal, not a hard gate — blocking would
# break scripted PR flows).
if command -v gh &>/dev/null; then
  git fetch origin "${BASE_BRANCH}" --quiet 2>/dev/null || true
  OVERLAP_CHANGED=$( { git diff --name-only "origin/${BASE_BRANCH}...HEAD" 2>/dev/null || true; } | sort -u )
  if [ -n "$OVERLAP_CHANGED" ]; then
    OVERLAP_REPORT=""
    while IFS=$'\t' read -r PR_NUM PR_TITLE PR_HEAD PR_FILES; do
      [ -z "${PR_NUM:-}" ] && continue
      [ "$PR_HEAD" = "$BRANCH" ] && continue
      SHARED=$(comm -12 \
        <(printf '%s\n' "$OVERLAP_CHANGED") \
        <(printf '%s\n' "$PR_FILES" | tr ',' '\n' | sort -u))
      if [ -n "$SHARED" ]; then
        OVERLAP_REPORT+="  PR #${PR_NUM} — ${PR_TITLE}"$'\n'
        OVERLAP_REPORT+="$(printf '%s\n' "$SHARED" | sed 's/^/      ↳ /')"$'\n'
      fi
    done < <(gh pr list --state open --json number,title,headRefName,files \
               --jq '.[] | "\(.number)\t\(.title)\t\(.headRefName)\t\(.files | map(.path) | join(","))"' 2>/dev/null || true)
    if [ -n "$OVERLAP_REPORT" ]; then
      echo ""
      echo -e "${YELLOW}⚠  Open PR(s) already touch files this branch changes:${NC}"
      printf '%b' "$OVERLAP_REPORT"
      echo -e "${YELLOW}   Parallel edits to the same file = duplicated work or a forced rebase.${NC}"
      echo -e "${YELLOW}   Confirm this is complementary (not a re-implementation) before continuing.${NC}"
      if [ -t 0 ]; then
        echo -n "   Proceed anyway? [y/N]: "
        read -r OVERLAP_CONFIRM
        if [[ ! "$OVERLAP_CONFIRM" =~ ^[Yy]$ ]]; then
          echo -e "${RED}✗ PR creation aborted. Reconcile with the open PR(s) above, then re-run.${NC}"
          exit 1
        fi
      else
        echo -e "${YELLOW}   (non-interactive stdin — proceeding; review the overlap above.)${NC}"
      fi
    fi
  fi
fi

# ── CMS data audit ──
# If the diff touches a CMS-driven surface, validate the underlying Supabase
# data before the PR opens. Catches the silent-fallback class of regression —
# e.g. all 3 support plans shipped with NULL service_line_id, rendering with
# the brand-yellow audience tint instead of their own service line until a
# screenshot caught it (#143 retrospective).
#
# Trigger on changes under plans surfaces or the shared queries module. The
# audit-plan-data.ts script self-reports if Supabase env vars aren't set.
# Add new audits as new CMS surfaces ship (services, customer stories, etc.).
PLANS_TOUCHED=$(
  { git diff --name-only "origin/${BASE_BRANCH}...HEAD" 2>/dev/null || true; } \
    | grep -E '^src/app/\(marketing\)/plans/|^src/lib/supabase/queries\.ts$|^scripts/audit-plan-' \
    | head -1 || true
)
if [ -n "$PLANS_TOUCHED" ]; then
  echo ""
  echo -e "${YELLOW}▸ Plans surface touched — running CMS data audit...${NC}"
  if ! npm run audit:plan-data --silent; then
    echo ""
    echo -e "${RED}✗ Plans CMS data audit failed.${NC}"
    echo -e "${RED}   Fix the data in staging Supabase per the SQL above, then re-run.${NC}"
    exit 1
  fi
  echo -e "${GREEN}✓ Plans CMS data audit passed.${NC}"
fi

# ── Supabase ↔ CSV drift audit ──
# Companion to the plans-only audit above (brikdesigns#155, audit landed in
# #148). When the diff touches a CMS-driven surface beyond plans, print the
# Supabase ↔ Webflow-CSV drift state across all 5 CMS tables (service_lines,
# services, offerings, customer_stories, industry_pages).
#
# Informational by design: the underlying script doesn't assert on drift,
# only on script error (missing env, network). The report surfaces
# unintended data churn so the author can sanity-check before merging.
# Failing CI on every existing drift entry would block every CMS PR until
# the offerings/services reconciliation in #149 closes — wrong default.
CMS_TOUCHED=$(
  { git diff --name-only "origin/${BASE_BRANCH}...HEAD" 2>/dev/null || true; } \
    | grep -E '^src/app/\(marketing\)/(services|customer-stories|customers)/|^src/lib/supabase/queries\.ts$|^scripts/audit-supabase-drift\.ts$|^content/csv/' \
    | head -1 || true
)
if [ -n "$CMS_TOUCHED" ]; then
  echo ""
  echo -e "${YELLOW}▸ CMS surface touched — running Supabase ↔ CSV drift audit...${NC}"
  if ! npm run audit:cms-drift --silent; then
    echo ""
    echo -e "${RED}✗ CMS drift audit script failed (likely missing env vars or network).${NC}"
    echo -e "${RED}   Source staging Supabase env, then re-run:${NC}"
    echo "    set -a; source ~/.secrets/supabase-staging.env; set +a"
    exit 1
  fi
  echo -e "${GREEN}✓ CMS drift audit ran — review report above for surprising changes.${NC}"
fi

# ── UI-verification gate ──
# If the diff touches a user-facing .tsx / .css / .scss file, confirm the
# agent actually exercised the change in a browser. Override with
# --skip-ui-check when the change is truly non-visual (string-only copy
# tweak, prop type rename, etc).
#
# Exclusions — these files are real code but don't render into the running
# app, so they don't need a browser click-through:
#   - *.test.tsx / *.spec.tsx / __tests__/**   (unit tests)
#   - *.stories.tsx / stories/**               (Storybook stories; verify in Storybook separately)
#   - *.d.ts                                   (type-only)
# False positives train agents to answer "y" reflexively — keep exclusions
# conservative.
if [[ "${SKIP_UI_CHECK:-}" != "1" ]]; then
  # Compare against origin/BASE so a stale local branch doesn't produce false positives.
  git fetch origin "${BASE_BRANCH}" --quiet 2>/dev/null || true
  # `|| true` — grep exits 1 with no matches; set -o pipefail would kill the script.
  UI_TOUCHED=$(
    { git diff --name-only "origin/${BASE_BRANCH}...HEAD" 2>/dev/null || true; } \
      | grep -E '\.(tsx|jsx|css|scss)$' \
      | grep -vE '(\.test\.|\.spec\.|\.stories\.|/__tests__/|^stories/|\.d\.ts$)' \
      | head -5 || true
  )
  if [ -n "$UI_TOUCHED" ]; then
    echo ""
    echo -e "${YELLOW}⚠  This branch touches UI files:${NC}"
    echo "$UI_TOUCHED" | sed 's/^/    /'
    echo ""
    echo -e "${YELLOW}   Project rule: UI changes must be exercised in a browser (dev-restart.sh + click through)${NC}"
    echo -e "${YELLOW}   before opening a PR. Typecheck alone is not sufficient.${NC}"
    echo ""
    echo -n "   Verified in a browser? [y/N] (or set SKIP_UI_CHECK=1 for non-visual-only diffs): "
    read -r UI_CONFIRM
    if [[ ! "$UI_CONFIRM" =~ ^[Yy]$ ]]; then
      echo -e "${RED}✗ PR creation blocked. Verify the change in a browser, then re-run.${NC}"
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

# ── Build PR title (needed by the label resolver below, before the push) ──
if [ $# -ge 1 ]; then
  PR_TITLE="$1"
else
  # Derive from the FIRST commit subject on the branch — already a
  # conventional-commit subject (enforced by convention), so it carries the
  # type + imperative the branch slug lacked (#1177). `(#N)` is appended from
  # the branch number when the subject has none. lib/pr-title.sh is pure; this
  # block only feeds it the subject + branch and handles the not-conventional
  # case by prompting rather than emitting the old branch-slug antipattern.
  #
  # Range is `origin/${BASE_BRANCH}`, never the bare local ref (#1198).
  # new-task.sh branches from origin/, and nothing fast-forwards the local
  # `staging` inside a task worktree — so the moment anything merges upstream
  # the local ref sits behind this branch's real base, the range widens to
  # include other sessions' merged commits, and `tail -1` takes the OLDEST of
  # those. PR #1197 was titled with #1194's subject that way: well-formed,
  # conventional, right `(#N)` appended — and entirely someone else's
  # description. Every other range in this script already uses origin/.
  FIRST_SUBJECT=$(git log --format='%s' "origin/${BASE_BRANCH}..HEAD" | tail -1)
  if PR_TITLE=$(pr_title_from_subject "$FIRST_SUBJECT" "$BRANCH"); then
    :
  else
    echo -e "${YELLOW}⚠  The first commit subject is not conventional-commits shaped:${NC}"
    echo "     $FIRST_SUBJECT"
    echo -e "${YELLOW}   A PR title must be 'type(scope): imperative description (#N)' (issue-style.md).${NC}"
    if [ -t 0 ]; then
      echo -n "   Enter a PR title: "
      read -r PR_TITLE
      [ -n "$PR_TITLE" ] || { echo -e "${RED}✗ No title given — aborting.${NC}"; exit 1; }
    else
      echo -e "${RED}✗ No TTY to prompt on and no title argument. Re-run with an explicit title:${NC}"
      echo "     ./scripts/pr-task.sh \"type(scope): description (#N)\""
      exit 1
    fi
  fi
fi

# ── Resolve project-tracking labels (before pushing anything) ──
# GitHub does NOT copy a linked issue's labels onto its PR, so PRs opened by this
# script were born label-less and fell off the board (#1012). Resolve here:
#   - a Type label from the conventional-commit prefix, IF this repo has one
#     (brikdesigns has neither `enhancement` nor `bug` — label_known drops them)
#   - the area:* / size:* / theme:* labels of every issue the commit range refs
#   - an explicit --area override
# The policy lives in lib/pr-labels.sh (pure, offline, tested). This block only
# supplies it with live data: the repo's label list and each issue's labels.
LABELS_TO_ADD=()

# Repo label list, resolved once up front (fix 3: before any branch that reads
# it, or set -u aborts). Captured into a var, never piped to `grep -q` (fix 2).
REPO_LABELS=$(gh label list --limit 200 --json name --jq '.[].name')

TYPE_LABEL=$(type_label_for_title "$PR_TITLE")
if [ -n "$TYPE_LABEL" ] && label_known "$TYPE_LABEL" "$REPO_LABELS"; then
  LABELS_TO_ADD+=("$TYPE_LABEL")
fi

if [ -n "$AREA_OVERRIDE" ]; then
  # Existence-check the override too — `gh pr edit` silently drops an unknown
  # label, which reintroduces the label-less PR this guard exists to prevent.
  if ! label_known "$AREA_OVERRIDE" "$REPO_LABELS"; then
    echo -e "${RED}✗ --area '${AREA_OVERRIDE}' is not an existing label in this repo.${NC}"
    echo -e "${RED}  Valid area labels:${NC}"
    grep '^area:' <<< "$REPO_LABELS" | sed 's/^/    /'
    exit 1
  fi
  LABELS_TO_ADD+=("$AREA_OVERRIDE")
fi

# ── Resolve the issues this PR is for ──
# One resolution, two consumers: the `Closes #N` / `Refs #N` trailers appended
# to the body below (#1199), and the area:*/size:*/theme:* inheritance in the
# loop after it (#1201).
#
# It replaced a whole-range bare-`#N` scan, which conflated two different
# meanings. `Closes #N` on its own line in a commit body is "this PR completes
# #N"; a bare `#N` in body prose is only evidence. PR #1200's commit cited
# #1194 and #1189 as the historical evidence for its fix, and both are
# area:design — so the scan pulled area:design onto a shell-script-only PR and
# it had to be removed by hand. Keyword-gating fixes both halves at once: the
# labels stop leaking, and prose can never emit a spurious `Closes`.
#
# Ported from brik-client-portal (its #3557), which extracted the rule for
# exactly these failures. NOT a registered fleet twin — the registry in
# brik-llm's scripts/audit/overlap-twin-drift.py does not list issue-refs.sh
# (unlike bump-pr-closing-keyword-guard.yml, which it does). Registering it is
# its own decision; until then this is a port, so keep the copies in sync by
# hand and prefer changing the portal's first.
# shellcheck source=scripts/lib/issue-refs.sh
source "${SCRIPT_DIR}/lib/issue-refs.sh"
resolve_issue_refs "origin/${BASE_BRANCH}..HEAD"

# $ref carries its own `#` and any owner/repo prefix, so it is interpolated
# whole — re-adding `#` here is what would strip a cross-repo prefix and
# resolve the number against this repo instead.
ISSUE_LINKS=""
for ref in $ISSUE_CLOSING_REFS; do ISSUE_LINKS="${ISSUE_LINKS}Closes ${ref}"$'\n'; done
for ref in $ISSUE_MENTION_REFS; do ISSUE_LINKS="${ISSUE_LINKS}Refs ${ref}"$'\n'; done

for ref_num in $ISSUE_ALL_REFS; do
  ISSUE_LABELS=$(gh issue view "$ref_num" --json labels --jq '.labels[].name' 2>/dev/null || true)
  for l in $(inheritable_labels "$ISSUE_LABELS"); do
    if label_known "$l" "$REPO_LABELS"; then
      LABELS_TO_ADD+=("$l")
    fi
  done
done

# Gate: never open a PR that pr-label-gate will immediately fail. Refuse before
# the push, so a label-less PR is never created in the first place.
if ! has_area_label "$(printf '%s\n' "${LABELS_TO_ADD[@]+"${LABELS_TO_ADD[@]}"}")"; then
  echo -e "${RED}✗ No area:* label could be resolved for this PR.${NC}"
  echo -e "${RED}  The pr-label-gate CI check requires one. Either:${NC}"
  echo -e "${RED}    - re-run with --area area:<x>   (e.g. --area area:infra), or${NC}"
  echo -e "${RED}    - add an area:* label to a linked issue, then re-run.${NC}"
  echo -e "${YELLOW}  Valid area labels:${NC}"
  grep '^area:' <<< "$REPO_LABELS" | sed 's/^/    /'
  exit 1
fi

# ── Sync with base (catches semantic conflicts from parallel work) ──
# When another agent's PR has merged to base while this branch was in flight,
# `git push` would succeed but CI would fail on a semantic conflict (e.g. new
# code using an API this branch removes). Merge base in locally first, then
# re-typecheck against the merged tree to catch it before the push.
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
  echo -e "${YELLOW}~ Re-running typecheck against merged tree...${NC}"
  if ! npm run typecheck; then
    echo ""
    echo -e "${RED}✗ Typecheck failed after merging ${BASE_BRANCH}.${NC}"
    echo -e "${RED}  A parallel PR introduced an incompatible usage. Fix locally, commit, re-run.${NC}"
    exit 1
  fi
fi

# ── Push if needed ──
# Worktrees created via new-task.sh inherit upstream from origin/<base>, so
# the upstream branch name doesn't match the local branch. Detect that case
# and re-set upstream to origin/<branch> so plain `git push` works thereafter.
# shellcheck disable=SC1083  # `@{u}` is git's upstream shorthand, not a brace expansion
UPSTREAM=$(git rev-parse --abbrev-ref --symbolic-full-name @{u} 2>/dev/null || echo "")
EXPECTED_UPSTREAM="origin/${BRANCH}"
if [ -z "$UPSTREAM" ] || [ "$UPSTREAM" != "$EXPECTED_UPSTREAM" ]; then
  echo -e "${YELLOW}~ Pushing branch to origin (setting upstream)...${NC}"
  git push -u origin "$BRANCH"
else
  # Check if local is ahead of remote
  LOCAL=$(git rev-parse HEAD)
  # shellcheck disable=SC1083  # `@{u}` is git's upstream shorthand
  REMOTE=$(git rev-parse @{u} 2>/dev/null || echo "")
  if [ "$LOCAL" != "$REMOTE" ]; then
    echo -e "${YELLOW}~ Pushing new commits to origin...${NC}"
    git push
  fi
fi

# ── Build PR body from commit log ──
COMMIT_LOG=$(git log --oneline "origin/${BASE_BRANCH}..HEAD" --reverse)
COMMIT_BULLETS=$(echo "$COMMIT_LOG" | sed 's/^[a-f0-9]* /- /')

# `${ISSUE_LINKS}` carries its own trailing newline per ref, and is empty when
# the range links nothing — so the blank line before it is unconditional and
# the block simply collapses. GitHub parses closing keywords from the PR BODY
# only: before #1199 these trailers lived in the commit footers and nowhere
# else, so PR #1187 carried `Closes #1171/#1172/#1173` in its commits and
# closed none of them until the body was hand-edited.
PR_BODY=$(cat <<EOF
## Summary
${COMMIT_BULLETS}

## Test plan
- [ ] Build passes (\`npm run build\`)
- [ ] Visual verification in browser
- [ ] Dark mode checked (if applicable)

Generated with [Claude Code](https://claude.ai/code)

${ISSUE_LINKS}
EOF
)

# ── Create PR ──
# Don't capture stderr into PR_URL with `2>&1` — that hides the actual error
# and, combined with `set -e`, exits the script silently after "Creating PR
# targeting staging..." with no PR opened (brikdesigns#155, repro'd on PRs
# #153 and #154). Let stderr flow to the terminal; check the exit code
# explicitly so the user sees what failed and can act.
echo -e "${YELLOW}~ Creating PR targeting ${BASE_BRANCH}...${NC}"
if ! PR_URL=$(gh pr create --base "${BASE_BRANCH}" --title "$PR_TITLE" --body "$PR_BODY"); then
  echo ""
  echo -e "${RED}✗ gh pr create failed (see error above).${NC}"
  echo -e "${RED}  Branch has been pushed; resolve the failure and re-run pr-task.sh,${NC}"
  echo -e "${RED}  or open the PR manually:${NC}"
  echo "    gh pr create --base ${BASE_BRANCH} --head ${BRANCH} --title \"$PR_TITLE\""
  exit 1
fi

# ── Apply the resolved labels ──
# One `gh pr edit` for everything resolved before the push: the inherited
# area:* / size:* / theme:* and the Type label. The has_area_label gate above
# guarantees an area:* is present, so this can never re-open the label-less
# hole. pr-label-gate re-runs on `labeled`, so the PR flips green as they land.
PR_NUMBER=$(gh pr view "$BRANCH" --json number --jq '.number' 2>/dev/null || echo "")
UNIQUE=$(dedupe_labels "$(printf '%s\n' "${LABELS_TO_ADD[@]+"${LABELS_TO_ADD[@]}"}")")
if [ -n "$UNIQUE" ]; then
  ADD_ARGS=()
  while IFS= read -r l; do [ -n "$l" ] && ADD_ARGS+=(--add-label "$l"); done <<< "$UNIQUE"
  if [ ${#ADD_ARGS[@]} -gt 0 ] && [ -n "$PR_NUMBER" ] && gh pr edit "$PR_NUMBER" "${ADD_ARGS[@]}" >/dev/null 2>&1; then
    echo -e "${GREEN}✓ Labels applied: $(echo "$UNIQUE" | tr '\n' ' ')${NC}"
  else
    echo -e "${RED}⚠ Could not apply labels — pr-label-gate will fail. Apply manually:${NC}"
    echo -e "${RED}    gh pr edit ${PR_NUMBER:-<n>} $(echo "$UNIQUE" | sed 's/^/--add-label /' | tr '\n' ' ')${NC}"
  fi
fi

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
# Points at the reaper, NOT a bare `rm -rf`. The hint this replaces ran no dirty
# check, no PR check and no landed check, so an operator or agent following it on
# an unmerged or uncommitted worktree lost that work with no recovery path — and
# this repo had no reaper to fall back on, so there was no safe alternative to
# offer. That is the whole of brikdesigns/brik-llm#1634 problem 1; after
# brikdesigns/brik-llm#2254 the reaper exists here, so the hint can name it.
# It decides on PR state plus an ancestor test plus a reflog not-started guard,
# and is dry-run by default.
WORKTREE_DIR=$(git rev-parse --show-toplevel)
if [[ "$WORKTREE_DIR" == *"worktrees"* ]]; then
  echo -e "  ${YELLOW}Cleanup (run after PR is merged, from the primary worktree):${NC}"
  echo "    cd $(dirname "$WORKTREE_DIR")/../brikdesigns"
  echo "    ./scripts/sweep-merged-worktrees.sh                            # dry-run first"
  echo "    ./scripts/sweep-merged-worktrees.sh --apply --delete-branches"
  echo ""
  echo "  Dry-run by default — nothing moves until --apply. OPEN PRs, dirty"
  echo "  worktrees and not-yet-started branches are spared automatically."
  echo ""
fi
