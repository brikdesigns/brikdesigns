#!/usr/bin/env bash
# new-task.sh — Create an isolated git worktree for a single brikdesigns task.
#
# Branches from origin/staging (staging-first flow). Enforces task/{scope}-{name}
# naming. Installs dependencies in the new worktree.
#
# Usage:
#   ./scripts/new-task.sh --issue brikdesigns/brik-llm#N {scope}-{name}  # gate on ticket
#   ./scripts/new-task.sh {scope-with-N}                    # ticket derived from the slug
#   ./scripts/new-task.sh --no-issue {scope}-{name}         # ticketless work (loud, opt-in)
#   ./scripts/new-task.sh --base main {scope}-{name}        # override base
#
# Flags may be written before or after the slug.
#
# A ticket is REQUIRED unless --no-issue is passed: the ticket-overlap gate is the
# only check that catches a parallel session working the same problem. Worktrees
# isolate files, not intent. brik-llm#1485.
#
# The flag loop + the four-gate block below are PORTED from brik-llm's canonical
# new-task.sh (brik-llm#2985), sourcing the gate libs synced in brik-llm#2984.
# This file is NOT yet a registered twin — that decision, and the shared+deltas
# entry it needs, is brik-llm#2963. Do not add a "gated twin" header until it is
# actually in the TWINS registry (brik-llm#2981). The brikdesigns-specific parts
# below — staging base, op-run dependency install, worktree symlinks — are
# legitimate per-repo deltas.

set -euo pipefail

# Prevent shells that sourced ~/.secrets/brik-packages.env from inheriting
# PACKAGES_READ_TOKEN as GITHUB_TOKEN — gh CLI auths to that instead of the
# user's PAT, using a wrong-scope (read:packages) token for arbitrary gh calls.
unset GITHUB_TOKEN

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

ISSUE_REF=""
NO_ISSUE=0
OVER_BUDGET=0
# Opt-out for the sibling-worktree gate (brik-llm#1932). Its own flag rather than
# a NEW_TASK_YES branch on purpose: NEW_TASK_YES=1 is set by every agent session,
# so folding this into it would auto-proceed the one signal that means another
# session is editing the file right now.
ALLOW_WT_OVERLAP=0

# ── Config ──
BASE_BRANCH="staging"

# ── Resolve repo root ──
PROJECT_ROOT="$(git rev-parse --show-toplevel)"
WORKTREE_BASE="$(dirname "$PROJECT_ROOT")/brikdesigns-worktrees"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# ── OP_SERVICE_ACCOUNT_TOKEN loader (#813) ──
# `op run` below needs the token, and brik-mini is headless — no 1Password GUI
# and no interactive `op signin` — so with nothing in the environment op aborts
# with "You are not currently signed in" before npm ci ever starts. brik-llm
# owns the one implementation; source it rather than adding another local copy
# of the self-source logic. Guarded and cross-repo: this repo can be cloned
# without its sibling, and the deps assertion after the install still fails
# loudly if the token turns out to be genuinely missing.
for _op_wrapper in \
  "${PROJECT_ROOT}/../../brik/brik-llm/scripts/lib/op-run-wrapper.sh" \
  "$HOME/Documents/GitHub/brik/brik-llm/scripts/lib/op-run-wrapper.sh"; do
  if [ -r "$_op_wrapper" ]; then
    # shellcheck source=/dev/null  # sibling repo, resolved at runtime
    source "$_op_wrapper"
    break
  fi
done
unset _op_wrapper
if ! declare -F rws_load_sa_token >/dev/null 2>&1; then
  echo -e "${YELLOW}⚠  brik-llm/scripts/lib/op-run-wrapper.sh not found — 'op run'${NC}" >&2
  echo "   below will only work if OP_SERVICE_ACCOUNT_TOKEN is already set (#813)." >&2
fi

# ── Ticket-overlap gate libs (brik-llm#2984, wired here by #2985) ──
# Issue-number overlap gate (brik-llm#1533). Keeps two sessions off the same ticket.
# shellcheck source=scripts/lib/issue-overlap.sh
source "${SCRIPT_DIR}/lib/issue-overlap.sh"
# shellcheck source=scripts/lib/overlap-filters.sh
source "${SCRIPT_DIR}/lib/overlap-filters.sh"
# Same-path overlap gate (brik-llm#2313). Complements the number gate, which is
# blind to two sessions on DIFFERENT tickets editing the same file.
# shellcheck source=scripts/lib/pr-path-overlap.sh
source "${SCRIPT_DIR}/lib/pr-path-overlap.sh"
# Open-issue path gate (brik-llm#2314). Reads the backlog the git-state gates cannot.
# Sourced after pr-path-overlap.sh, whose helpers it reuses.
# shellcheck source=scripts/lib/issue-path-overlap.sh
source "${SCRIPT_DIR}/lib/issue-path-overlap.sh"
# Session size-budget gate (brik-llm#2045). Sourced after issue-overlap.sh —
# _sb_resolve_ref reuses _io_resolve_ref when it is present.
# shellcheck source=scripts/lib/session-budget.sh
source "${SCRIPT_DIR}/lib/session-budget.sh"
# Claim gate (brik-llm#2676, porting brik-bds#1541). The only gate that sees a
# session which has a worktree but has not pushed — the new-task.sh → pr-task.sh
# window the number/path gates are blind to. A claim is written before any code.
# shellcheck source=scripts/lib/issue-claim.sh
source "${SCRIPT_DIR}/lib/issue-claim.sh"

# ── Must run from the primary worktree on a base branch ──
# Running new-task.sh from inside another task worktree creates nested state
# that breaks the one-worktree-per-task contract. The primary worktree is
# also the one place a base branch is meant to live — if it's on a task branch,
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
# Flags are accepted on either side of the slug. The loop used to `break` at the
# first positional, so `new-task.sh {slug} --issue N` silently dropped the flag
# and fell through to derive_issue_from_slug — gating on whatever trailing number
# the slug happened to carry rather than on N. A skipped gate is bad; a gate on
# the wrong ticket is worse. brik-llm#1820.
POSITIONAL=()
while [[ $# -gt 0 ]]; do
  case "$1" in
    --base)
      BASE_BRANCH="$2"
      shift 2
      ;;
    --issue)
      ISSUE_REF="$2"
      shift 2
      ;;
    --no-issue)
      NO_ISSUE=1
      shift
      ;;
    --over-budget)
      OVER_BUDGET=1
      shift
      ;;
    --allow-worktree-overlap)
      ALLOW_WT_OVERLAP=1
      shift
      ;;
    -*)
      echo -e "${RED}Unknown flag: $1${NC}"
      exit 1
      ;;
    *)
      POSITIONAL+=("$1")
      shift
      ;;
  esac
done
# `${arr[@]+...}` guards the empty-array expansion under `set -u` on bash 3.2.
set -- ${POSITIONAL[@]+"${POSITIONAL[@]}"}

# ── Validate input ──
if [ $# -lt 1 ]; then
  echo -e "${RED}Usage: $0 [--base branch] [--over-budget] [--allow-worktree-overlap] (--issue N | --no-issue) {scope}-{name}${NC}"
  echo ""
  echo "  scope = area of the site (marketing, content, seo, site, infra, docs, intel)"
  echo "  name  = what the task delivers (hero-rework, pricing-copy, analytics-4-setup)"
  echo ""
  echo "  Example: $0 --issue brikdesigns/brik-llm#2985 infra-new-task-gates"
  echo "  Example: $0 content-pricing-copy-2412"
  echo "  Example: $0 --no-issue infra-scratch-spike"
  echo ""
  echo "  --issue takes 1525 or owner/repo#1525 and warns if a branch or PR"
  echo "  already exists for that ticket, in this repo or any other. Most"
  echo "  brikdesigns tooling tickets live in brik-llm, so pass the cross-repo"
  echo "  form owner/repo#N."
  echo ""
  echo "  A ticket is REQUIRED. It is derived automatically when the slug ends in"
  echo "  the number (e.g. content-pricing-copy-2412). Use --no-issue only for"
  echo "  genuinely ticketless work — it disables the one gate that catches a"
  echo "  parallel session working the same problem."
  echo ""
  echo "  The ticket's size:* label is charged against this session's budget"
  echo "  (1 L, or 2-3 M, or ~5 S/XS). Over budget refuses; --over-budget takes"
  echo "  it anyway."
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

if [ -d "${WORKTREE_BASE}/${TASK_NAME}" ]; then
  echo -e "${RED}Error: worktree directory ${WORKTREE_BASE}/${TASK_NAME} already exists.${NC}"
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
    # _io_confirm, not a bare `read -r`: it honours NEW_TASK_YES so a headless
    # agent pickup is not killed by a prompt, and returns cleanly on EOF under
    # `set -euo pipefail` (brik-llm#2812).
    _io_confirm
  fi
fi

# ── Check for overlapping scope (live branches only) ──
# Slug-fuzzy: catches a second branch in the same problem area even when no issue
# number was passed. Weaker than the --issue gate below — it only matches branches
# sharing the leading slug token — so it is a complement, not a substitute.
# MERGED branches are excluded, or every stale task/* ref becomes a false positive
# and everyone learns to press Enter through the one real overlap. brik-llm#1485.
SCOPE_KEYWORD="${TASK_NAME%%-*}"
CANDIDATES=$(git branch -r 2>/dev/null | grep -i "origin/task/.*${SCOPE_KEYWORD}" | grep -v HEAD || true)
SIMILAR_BRANCHES=""

if [ -n "$CANDIDATES" ]; then
  # One API call for all merged head-refs. Empty on failure, which degrades to
  # the ancestor check inside filter_live_branches rather than to silence.
  MERGED_HEADS=$(gh pr list --state merged --limit 400 --json headRefName \
                   --jq '.[].headRefName' 2>/dev/null || true)
  SIMILAR_BRANCHES=$(printf '%s\n' "$CANDIDATES" \
    | filter_live_branches "origin/${BASE_BRANCH}" "$MERGED_HEADS" \
    | drop_merged_by_lookup)
fi

if [ -n "$SIMILAR_BRANCHES" ]; then
  echo -e "${YELLOW}⚠  LIVE branches with similar scope (merged/landed ones excluded):${NC}"
  echo "$SIMILAR_BRANCHES" | sed 's/^/    /'
  echo ""
  echo -e "${YELLOW}   These carry unlanded work — a real overlap risk, not stale refs.${NC}"
  # _io_confirm, not a bare `read -r` — honours NEW_TASK_YES and survives EOF
  # under `set -euo pipefail` (brik-llm#2812).
  _io_confirm
fi

# ── Ticket-level overlap gate ──
# The one that catches cross-repo collisions: it reads the issue's own timeline,
# so a PR in another repo against this ticket still surfaces. brik-llm#1533/#1485.
#
# Order: explicit --issue > derived from the slug > refuse. --no-issue is the
# deliberate escape hatch for genuinely ticketless work, and it is loud.
if [ -z "$ISSUE_REF" ] && [ "$NO_ISSUE" != "1" ]; then
  DERIVED_ISSUE="$(derive_issue_from_slug "$TASK_NAME")"
  if [ -n "$DERIVED_ISSUE" ]; then
    ISSUE_REF="$DERIVED_ISSUE"
    echo -e "${YELLOW}▸ Derived --issue ${ISSUE_REF} from the slug (pass --issue to override, --no-issue to skip).${NC}"
  fi
fi

if [ -n "$ISSUE_REF" ]; then
  # Guarded, and the guard is load-bearing in BOTH directions (brik-llm#2422).
  # Findings return 0 — an overlap warns and proceeds. But rc 4 (no such issue)
  # and rc 5 (unreadable) mean the gate DID NOT RUN, and creating the worktree on
  # that is the fail-open. Catch it and say what to do.
  overlap_rc=0
  check_issue_overlap "$ISSUE_REF" || overlap_rc=$?
  if [ "$overlap_rc" -ne 0 ]; then
    echo ""
    echo -e "${RED}✗ Refusing to create a worktree — the overlap gate could not run.${NC}"
    echo ""
    echo -e "${RED}  Worktrees isolate files, not intent. Without this check nothing${NC}"
    echo -e "${RED}  catches a parallel session on the same ticket (brik-llm#1485).${NC}"
    echo ""
    case "$overlap_rc" in
      2) echo -e "${YELLOW}  The reference could not be parsed. Use 1525 or owner/repo#1525.${NC}" ;;
      4) echo -e "${YELLOW}  That issue does not exist in the repo the number resolved against.${NC}"
         echo -e "${YELLOW}  Check the number, or pass the cross-repo form owner/repo#N.${NC}" ;;
      5) echo -e "${YELLOW}  The read failed rather than came back empty — usually transient.${NC}"
         echo -e "${YELLOW}  Re-run the same command; it retries once on its own first.${NC}" ;;
      6) echo -e "${YELLOW}  That number is a PULL REQUEST, not an issue. Pass the issue it is for.${NC}" ;;
      *) echo -e "${YELLOW}  Unexpected gate status ${overlap_rc}.${NC}" ;;
    esac
    echo ""
    echo -e "${YELLOW}  Deliberately proceeding without the gate: re-run with --no-issue${NC}"
    echo -e "${YELLOW}  (which also forgoes the session size budget).${NC}"
    exit 1
  fi
  # Sibling-issue detection (brik-llm#1663/#2765): another session filed its OWN
  # issue for the same problem, so both number gates pass while the work is
  # identical. Advisory — never refuses, never aborts on an unreadable title.
  check_title_overlap "$ISSUE_REF"
  check_ticket_path_overlap "$ISSUE_REF"
  # Sibling-worktree gate (brik-llm#1932). Reads `git worktree list` + `git status`
  # — the window every GitHub-side gate is blind to: a session with a worktree and
  # edits but no commit, push or PR. Runs HERE because it consumes
  # check_ticket_path_overlap's PTO_TICKET_PATHS. Guarded and REFUSING: rc 7 is a
  # file being edited right now by another session. --allow-worktree-overlap is the
  # opt-out; NEW_TASK_YES deliberately does NOT cover it.
  worktree_rc=0
  check_worktree_overlap "$PTO_TICKET_PATHS" || worktree_rc=$?
  if [ "$worktree_rc" -eq 7 ] && [ "$ALLOW_WT_OVERLAP" != "1" ]; then
    echo ""
    echo -e "${RED}✗ Refusing to create a worktree — a sibling worktree is editing these files now.${NC}"
    echo ""
    echo -e "${YELLOW}  Those changes are uncommitted, so no branch, PR or claim reports them.${NC}"
    echo -e "${YELLOW}  Read that worktree first. Never commit or push a branch you did not${NC}"
    echo -e "${YELLOW}  create (brik-llm#2635) — the owning session is mid-edit.${NC}"
    echo ""
    echo -e "${YELLOW}  If the overlap is genuinely benign — a twin-sync branch of your own${NC}"
    echo -e "${YELLOW}  session, or a file you are only reading — re-run with:${NC}"
    echo -e "${YELLOW}    ./scripts/new-task.sh --allow-worktree-overlap --issue ${ISSUE_REF} ${TASK_NAME}${NC}"
    exit 1
  fi
  # The issue-side half (brik-llm#2314): "does anyone have an open ticket ABOUT
  # these files". Advisory and unguarded — returns 0 on everything.
  check_issue_path_overlap "$ISSUE_REF"
  # Guarded: check_session_budget returns 1 to refuse, and an unguarded call under
  # `set -e` would exit before the refusal's remedy lines are reached. brik-llm#2045.
  if ! check_session_budget "$ISSUE_REF" "$OVER_BUDGET"; then
    exit 1
  fi
  # Refuses when another host/branch holds a live claim; otherwise takes it.
  if ! check_issue_claim "$ISSUE_REF" "$BRANCH_NAME"; then
    exit 1
  fi
  # Comment digest (brik-llm#2755). LAST, after the claim: no point telling a
  # session to read comments on a ticket it is about to be refused. Free —
  # check_issue_claim primed the cache with the same endpoint read. Advisory.
  report_issue_comments "$ISSUE_REF"
elif [ "$NO_ISSUE" = "1" ]; then
  echo -e "${YELLOW}⚠  --no-issue: ticket-overlap gate deliberately skipped.${NC}"
  echo -e "${YELLOW}   Nothing will catch a parallel session working the same problem.${NC}"
  echo -e "${YELLOW}   Nothing is charging this work against the session size budget either.${NC}"
  # ...except this. The slug is the only statement of intent a ticketless branch
  # has, so score it against open issue TITLES (brik-llm#1663/#2765). The phrase
  # transform is inlined — the IDF scorer tokenises on whitespace AND hyphens and
  # drops tokens under 4 chars, so leaving the scope prefix in costs nothing.
  check_phrase_overlap "$(printf '%s' "$TASK_NAME" | tr '-' ' ')"
else
  echo -e "${RED}✗ Refusing to create a worktree with no ticket.${NC}"
  echo ""
  echo -e "${RED}  The ticket-overlap gate is the only check that catches a parallel${NC}"
  echo -e "${RED}  session already working this problem. Worktrees isolate files, not${NC}"
  echo -e "${RED}  intent — brik-llm#1485 is two sessions building the same fix in two${NC}"
  echo -e "${RED}  correctly-created worktrees.${NC}"
  echo ""
  echo -e "${YELLOW}  Fix one of these ways:${NC}"
  echo -e "${YELLOW}    $0 --issue N ${TASK_NAME}       # gate on the ticket${NC}"
  echo -e "${YELLOW}    $0 ${TASK_NAME}-N               # or put the number in the slug${NC}"
  echo -e "${YELLOW}    $0 --no-issue ${TASK_NAME}      # genuinely ticketless work${NC}"
  exit 1
fi

# ── Fetch and branch from base ──
echo -e "${YELLOW}▸ Fetching latest ${BASE_BRANCH}...${NC}"
git fetch origin "${BASE_BRANCH}" --quiet

echo -e "${YELLOW}▸ Creating worktree at ${WORKTREE_BASE}/${TASK_NAME}...${NC}"
mkdir -p "$WORKTREE_BASE"
git worktree add "${WORKTREE_BASE}/${TASK_NAME}" -b "${BRANCH_NAME}" "origin/${BASE_BRANCH}"

# ── Record the ticket ON the branch (brik-llm#1707) ──
# The only durable branch → ticket link there is. Branches are `task/<slug>` with
# no number in them (brik-llm#2514). Per-branch git config: local, free, survives
# the worktree being removed and re-added. `|| true` — a convenience record, not a
# gate; a config write failing must not destroy a worktree that already exists.
if [ -n "$ISSUE_REF" ]; then
  git -C "${WORKTREE_BASE}/${TASK_NAME}" config "branch.${BRANCH_NAME}.brikTaskIssue" "$ISSUE_REF" || true
fi

cd "${WORKTREE_BASE}/${TASK_NAME}"

# ── Symlink shared resources from primary ──
# brikdesigns has runtime secrets (.env / .env.local) and gitignored CSV
# fixtures (content/csv/) that the reconciliation pipeline reads. Symlink
# (don't copy) so the worktree always sees primary's canonical state.
echo -e "${YELLOW}▸ Symlinking shared resources from primary...${NC}"
for f in .env .env.local; do
  if [ -f "${PRIMARY_PATH}/${f}" ]; then
    ln -sf "${PRIMARY_PATH}/${f}" "./${f}"
    echo "    ${f} → primary"
  fi
done
if [ -d "${PRIMARY_PATH}/content/csv" ]; then
  mkdir -p ./content
  ln -sf "${PRIMARY_PATH}/content/csv" ./content/csv
  echo "    content/csv/ → primary"
fi
# .netlify/state.json carries the linked siteId. Symlink only that file —
# never the whole .netlify/ dir, which netlify dev writes runtime artifacts
# into (blobs-serve/, functions-internal/, v1/). Per-worktree runtime state,
# shared siteId is the right split. Symlinking the whole dir also creates
# ELOOP traps when netlify dev rewrites it. See #86.
if [ -f "${PRIMARY_PATH}/.netlify/state.json" ]; then
  mkdir -p .netlify
  ln -sf "${PRIMARY_PATH}/.netlify/state.json" .netlify/state.json
  echo "    .netlify/state.json → primary"
fi

# ── Install dependencies ──
echo -e "${YELLOW}▸ Installing dependencies (op run -- npm ci --prefer-offline)...${NC}"
# rws_load_sa_token puts the token in THIS process only, from the mode-600 SA
# file — never the parent shell.
if declare -F rws_load_sa_token >/dev/null 2>&1; then
  rws_load_sa_token
fi
# Run without aborting so the assertion below can report *why* it failed. The
# `| tail -1` pipe would otherwise mask the exit code under pipefail and leave
# the worktree looking fine with an empty node_modules.
set +e
op run --env-file=.env.op -- npm ci --prefer-offline 2>&1 | tail -1
set -e

# ── Assert the install actually populated node_modules ──
# A worktree with no deps must not look like success: the next command would
# die on `tsc: command not found` with nothing pointing back to here.
if [ ! -x node_modules/.bin/tsc ]; then
  echo ""
  echo -e "${RED}Error: dependency install did not complete.${NC}"
  echo ""
  echo "  The worktree exists but node_modules is empty or incomplete"
  echo "  (node_modules/.bin/tsc is missing)."
  echo ""
  if [ -z "${OP_SERVICE_ACCOUNT_TOKEN:-}" ]; then
    echo "  OP_SERVICE_ACCOUNT_TOKEN is not set and could not be loaded (#813)."
    echo "  Expected at ~/.secrets/op-service-account.env, sourced via"
    echo "  brik-llm/scripts/lib/op-run-wrapper.sh. On a headless machine that"
    echo "  file IS the only auth path — there is no desktop integration to"
    echo "  fall back to. Check it exists and is readable, then re-run."
  else
    echo "  The token WAS loaded, so this is not #813 — likely the 1Password"
    echo "  session or the registry itself. Running it directly in your shell"
    echo "  reliably works."
  fi
  echo ""
  echo "  Finish setup from the worktree, then you're ready:"
  echo "    cd ${WORKTREE_BASE}/${TASK_NAME}"
  echo "    set -a; source ~/.secrets/op-service-account.env; set +a"
  echo "    op run --env-file=.env.op -- npm ci --prefer-offline"
  echo "    test -x node_modules/.bin/tsc && echo 'deps OK'"
  echo ""
  echo -e "${RED}  NOT printing the 'ready' summary — the worktree is not usable yet.${NC}"
  exit 1
fi

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
echo "  When done (REQUIRED — branches without PRs rot):"
echo "    git diff ${BASE_BRANCH}..${BRANCH_NAME}   # review changes"
echo "    ./scripts/pr-task.sh             # push + create PR (mandatory)"
echo ""
