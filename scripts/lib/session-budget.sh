#!/usr/bin/env bash
# session-budget.sh — hold a session to the contracted size budget.
#
# Sourced by new-task.sh after the ticket-overlap gate, and callable standalone
# to read the running total. Closes brik-llm#2045.
#
# Why this exists: `.claude/references/session-contract.md` fixes a budget per
# session (1 L, or 2-3 M, or ~5 S/XS) because model quality degrades as context
# grows even inside the window. Until this file, that budget was prose. The
# ticket gate (#1485) already refuses a worktree with no ticket, so a session
# could open three L worktrees, pass every gate, and be four times over
# contract with nothing objecting.
#
# The ledger keys on CLAUDE_CODE_SESSION_ID — the only identifier that is
# stable across the several new-task.sh invocations one session makes and
# distinct between the 4-8 sessions brik-mini runs at once. A per-worktree or
# per-tty key would merge concurrent sessions into one budget and deny work
# that was never over contract.
#
# Costs one REST point per gated pickup (`repos/{o}/{r}/issues/{n}`), not
# GraphQL — the size label AND the created_at that drives the drainage duty come
# from that one read (`_sb_fetch_issue_meta`). It is a deliberate second read
# rather than an extra field on issue-overlap.sh's fetch: that file is a
# hand-kept copy in three repos (brik-bds, brik-client-portal), and widening its
# contract means three synchronised edits. rag:github-api-quota-is-shared-across-the-fleet.
#
# Two contract clauses, one ledger dir keyed on the session id:
#   - size budget (#2045): 1 L, or 2-3 M, or ~5 S/XS — REFUSES over budget.
#   - drainage duty (#2722): one aged-item pull, or three re-triages — WARN-ONLY
#     for now (flip _SB_DRAIN_ENFORCE=refuse after a clean window). A pickup of a
#     > 30d item auto-counts the pull; re-triage is logged with --drain.
#
# Usage (sourced):
#   source scripts/lib/session-budget.sh
#   check_session_budget "2045" 0       # 0 = enforce, 1 = --over-budget override
#
# Usage (standalone):
#   scripts/lib/session-budget.sh --status                    # size + drainage
#   scripts/lib/session-budget.sh --drain <ref> <kind>        # log a re-triage
#   scripts/lib/session-budget.sh --check-drainage            # close-time nudge
#
# Exit / return codes:
#   0  within budget, recorded — or unenforceable and skipped loudly
#   1  over budget, refused (size gate) / drainage unmet when enforce=refuse

_SB_YELLOW='\033[1;33m'
_SB_GREEN='\033[0;32m'
_SB_RED='\033[0;31m'
_SB_NC='\033[0m'

# Points, not hours. Hours cannot reproduce the canon table: 3 x M is inside
# contract at 7-21h each, so an hour ceiling that admits 3 M also admits 1 L.
# These weights reproduce session-contract.md exactly against a 15-point cap —
# 1 L, 3 M, and 5 S/XS each land on 15, a 4th M and a 2nd L each land over.
_SB_BUDGET_POINTS=15

_sb_points_for_size() {
  case "$1" in
    xs) echo 3 ;;
    s)  echo 3 ;;
    m)  echo 5 ;;
    l)  echo 15 ;;
    *)  echo 0 ;;
  esac
}

# An unsized ticket is not free. Counting it 0 would make `needs:size` the
# cheapest way through this gate, which inverts the incentive the gate exists
# to create. M is the median rung and the loud line below says so.
_SB_UNSIZED_POINTS=5

# Drainage duty (.claude/references/session-contract.md § Entry, operator
# decision 2026-08-26): every session's contract includes one drainage action —
# pull one aged (> 30d) open item, OR re-triage three aged items. An item is
# "aged" once it is older than this many days; picking one up counts the pull
# automatically at the gate below. Warn-only for now — the close check nudges,
# it does not refuse — mirroring the auto-merge rollout (#2046). Flip
# _SB_DRAIN_ENFORCE=refuse after a clean window; the test pins the current level.
_SB_AGED_DAYS=30
# Ages travel in whole HOURS, not whole days (#2852). Flooring to days first and
# then testing `> 30` turns the contract's "> 30d" into ">= 31d" in the code and
# discards up to 24h of eligibility: on 2026-08-28 five open items sat between
# 30.0d and 30.4d, aged by any reading of the rule, and every one was refused.
# The threshold itself is unchanged and stays a governance decision (#2721/#2722).
_SB_AGED_HOURS=$((_SB_AGED_DAYS * 24))
_SB_DRAIN_RETRIAGE_KINDS='close reprioritize digest-fold'
# warn = nudge, never block (current rollout state, #2722). refuse = block the
# PR open at pr-task.sh once the warn window is clean (#2724). Env-overridable so
# the flip is a one-line default change here, and a deliberate per-invocation
# override stays possible the way --over-budget is for the size gate — the same
# lever the test uses to exercise the refuse path without editing this file.
_SB_DRAIN_ENFORCE="${_SB_DRAIN_ENFORCE:-warn}"

_sb_ledger_dir() {
  printf '%s\n' "${BRIK_SESSION_BUDGET_DIR:-${XDG_CACHE_HOME:-$HOME/.cache}/brik/session-budget}"
}

# Empty when no session identifier is available — the caller degrades loudly
# rather than silently sharing one ledger across every session on the host.
_sb_session_key() {
  local key="${CLAUDE_CODE_SESSION_ID:-${CLAUDE_PID:-}}"
  # Path component, so constrain it rather than trusting the environment.
  printf '%s\n' "$(printf '%s' "$key" | tr -c 'A-Za-z0-9_.-' '-')"
}

_sb_ledger_path() {
  local key
  key="$(_sb_session_key)"
  [ -z "$key" ] && return 1
  printf '%s/%s.tsv\n' "$(_sb_ledger_dir)" "$key"
}

# Ledgers outlive their sessions; nothing else reaps them. Cheap enough to run
# on the pickup path and it keeps the directory from growing without bound.
_sb_prune_stale() {
  local dir
  dir="$(_sb_ledger_dir)"
  [ -d "$dir" ] || return 0
  find "$dir" -maxdepth 1 -name '*.tsv' -type f -mtime +7 -delete 2>/dev/null || true
}

# Sum the points column. Empty ledger, missing file, and malformed line all
# read as 0 rather than as an error — a broken ledger must not block a pickup.
_sb_total_points() {
  local path="$1"
  [ -r "$path" ] || { echo 0; return 0; }
  awk -F'\t' '$2 ~ /^[0-9]+$/ { n += $2 } END { print n + 0 }' "$path"
}

_sb_already_recorded() {
  local path="$1" ref="$2"
  [ -r "$path" ] || return 1
  awk -F'\t' -v ref="$ref" '$1 == ref { found = 1 } END { exit found ? 0 : 1 }' "$path"
}

# owner/repo#num for a bare number or an already-qualified ref. Reuses
# issue-overlap.sh's resolver when it is loaded; both are sourced by new-task.sh.
_sb_resolve_ref() {
  local ref="$1"
  if declare -F _io_resolve_ref >/dev/null 2>&1; then
    local resolved owner repo num
    resolved="$(_io_resolve_ref "$ref")" || return 1
    read -r owner repo num <<<"$resolved"
    printf '%s/%s#%s\n' "$owner" "$repo" "$num"
    return 0
  fi
  case "$ref" in
    */*\#[0-9]*) printf '%s\n' "$ref" ;;
    [0-9]*)
      local slug
      slug="$(gh repo view --json nameWithOwner --jq .nameWithOwner 2>/dev/null)" || return 1
      [ -z "$slug" ] && return 1
      printf '%s#%s\n' "$slug" "$ref"
      ;;
    *) return 1 ;;
  esac
}

# "<size>\t<age_hours>" for a ticket in ONE REST read — size is the bare size:*
# label (xs|s|m|l) or empty, age is whole HOURS since created_at or empty (see
# _SB_AGED_HOURS for why hours and not days). Kept a single gh call so a pickup
# still costs one REST point even though drainage now needs the age too (see
# header). Empty on all three failure modes (unlabelled, unreadable, no gh)
# because they are one decision for the caller.
_sb_fetch_issue_meta() {
  local qualified="$1" owner_repo num
  owner_repo="${qualified%%#*}"
  num="${qualified##*#}"
  command -v gh >/dev/null 2>&1 || return 0
  gh api "repos/${owner_repo}/issues/${num}" \
    --jq '(([.labels[].name] | map(select(startswith("size:"))) | first // "") | ltrimstr("size:") | ascii_downcase)
          + "\t"
          + (if .created_at then (((now - (.created_at | fromdateiso8601)) / 3600) | floor | tostring) else "" end)' \
    2>/dev/null | head -1
}

# Whole hours → "30.4d" for display. The tenth is what makes an accepted 30.4d
# item legible next to a refused 30.0d one; printing both as "30d" is what made
# the old refusal read as an off-by-one to the operator.
_sb_fmt_age() {
  local hours="$1"
  [ -n "$hours" ] || { printf 'unknown\n'; return 0; }
  printf '%d.%dd\n' "$((hours / 24))" "$(((hours % 24) * 10 / 24))"
}

# "<number>\t<age_hours>" for the OLDEST open issue in a repo, or empty when the
# read fails. Pull requests share the issues endpoint, so they are filtered out —
# an oldest "issue" that is really a PR would report a vacancy that is not one.
# Only called on the unmet path of --check-drainage, so it costs nothing on the
# common run.
_sb_oldest_open_issue() {
  local owner_repo="$1"
  [ -n "$owner_repo" ] || return 0
  command -v gh >/dev/null 2>&1 || return 0
  gh api "repos/${owner_repo}/issues?state=open&sort=created&direction=asc&per_page=50" \
    --jq '[.[] | select(has("pull_request") | not)] | first
          | if . then "\(.number)\t\((((now - (.created_at | fromdateiso8601)) / 3600) | floor))" else "" end' \
    2>/dev/null | head -1
}

_sb_render_ledger() {
  local path="$1"
  [ -r "$path" ] || return 0
  awk -F'\t' '$1 != "" { printf "    %-34s %s (%s pts)\n", $1, toupper($3), $2 }' "$path"
}

# ── Drainage duty ────────────────────────────────────────────────────
# A second, parallel ledger to the size one: same session key, same dir, same
# stale-prune, so it lives and dies with its session. Columns: ref, kind,
# age_hours.
_sb_drain_ledger_path() {
  local key
  key="$(_sb_session_key)"
  [ -z "$key" ] && return 1
  printf '%s/%s.drain.tsv\n' "$(_sb_ledger_dir)" "$key"
}

# Record one drainage action, idempotent per (ref, kind) so re-running a pickup
# or re-logging the same close does not inflate the count. Silently no-ops when
# there is no session key — same degradation as the size ledger.
_sb_record_drain() {
  local ref="$1" kind="$2" age="$3" dpath
  dpath="$(_sb_drain_ledger_path)" || return 0
  mkdir -p "$(_sb_ledger_dir)"
  if [ -r "$dpath" ] && \
     awk -F'\t' -v r="$ref" -v k="$kind" '$1==r && $2==k{f=1} END{exit f?0:1}' "$dpath"; then
    return 0
  fi
  printf '%s\t%s\t%s\n' "$ref" "$kind" "$age" >>"$dpath"
}

# Prints "<pulls> <retriage> <satisfied>" where satisfied is 1 when the duty is
# met: one pull OR three re-triage actions (session-contract.md § Entry).
_sb_drain_state() {
  local dpath="$1" pulls=0 retri=0 sat=0
  if [ -r "$dpath" ]; then
    pulls=$(awk -F'\t' '$2=="pull"{n++} END{print n+0}' "$dpath")
    retri=$(awk -F'\t' -v k=" $_SB_DRAIN_RETRIAGE_KINDS " \
      'index(k, " "$2" ")>0{n++} END{print n+0}' "$dpath")
  fi
  { [ "$pulls" -ge 1 ] || [ "$retri" -ge 3 ]; } && sat=1
  printf '%s %s %s\n' "$pulls" "$retri" "$sat"
}

_sb_render_drain() {
  local dpath="$1"
  [ -r "$dpath" ] || return 0
  awk -F'\t' '$1 != "" { printf "    %-34s %s (%.1fd)\n", $1, $2, $3 / 24 }' "$dpath"
}

# check_session_budget <issue-ref> [allow_over]
# allow_over=1 records the ticket and warns instead of refusing (--over-budget).
check_session_budget() {
  local ref="${1:-}" allow_over="${2:-0}"
  [ -z "$ref" ] && return 0

  local path
  if ! path="$(_sb_ledger_path)"; then
    echo "" >&2
    echo -e "${_SB_YELLOW}⚠  No CLAUDE_CODE_SESSION_ID — session size-budget gate skipped.${_SB_NC}" >&2
    echo -e "${_SB_YELLOW}   Nothing is tracking this session's contracted size. Hold the${_SB_NC}" >&2
    echo -e "${_SB_YELLOW}   budget by hand: .claude/references/session-contract.md § Entry.${_SB_NC}" >&2
    return 0
  fi

  local qualified
  if ! qualified="$(_sb_resolve_ref "$ref")" || [ -z "$qualified" ]; then
    echo -e "${_SB_YELLOW}⚠  Could not resolve '${ref}' — size-budget gate skipped.${_SB_NC}" >&2
    return 0
  fi

  _sb_prune_stale
  mkdir -p "$(_sb_ledger_dir)"

  local spent
  spent="$(_sb_total_points "$path")"

  # Re-picking up a ticket already in this session's contract is not new scope.
  # Without this, a worktree recreated after a sweep would double-charge it.
  if _sb_already_recorded "$path" "$qualified"; then
    echo "" >&2
    echo -e "${_SB_YELLOW}▸ Session budget — ${spent}/${_SB_BUDGET_POINTS} pts (${qualified} already contracted)${_SB_NC}" >&2
    _sb_render_ledger "$path" >&2
    return 0
  fi

  local size points sized_note="" meta age_hours
  meta="$(_sb_fetch_issue_meta "$qualified")"
  size="${meta%%$'\t'*}"
  age_hours="${meta#*$'\t'}"
  # No tab in the reply → the whole thing is the size field, age is unknown.
  [ "$age_hours" = "$meta" ] && age_hours=""
  if [ -z "$size" ] || [ "$(_sb_points_for_size "$size")" = "0" ]; then
    points="$_SB_UNSIZED_POINTS"
    size="unsized"
    sized_note="counted as M — label the ticket size:* to correct"
  else
    points="$(_sb_points_for_size "$size")"
  fi

  local projected=$((spent + points))

  echo "" >&2
  echo -e "${_SB_YELLOW}▸ Session budget — ${qualified} is ${size} (${points} pts)${_SB_NC}" >&2
  [ -n "$sized_note" ] && echo -e "${_SB_YELLOW}    ${sized_note}${_SB_NC}" >&2
  _sb_render_ledger "$path" >&2
  echo "    ${spent} spent + ${points} = ${projected}/${_SB_BUDGET_POINTS} pts" >&2

  if [ "$projected" -gt "$_SB_BUDGET_POINTS" ]; then
    if [ "$allow_over" = "1" ]; then
      echo "" >&2
      echo -e "${_SB_RED}⚠  --over-budget: taking this ticket puts the session at ${projected}/${_SB_BUDGET_POINTS} pts.${_SB_NC}" >&2
      echo -e "${_SB_RED}   The contract is being broken deliberately. Context rot is not${_SB_NC}" >&2
      echo -e "${_SB_RED}   advisory — quality degrades inside the window, not at its edge.${_SB_NC}" >&2
      echo -e "${_SB_RED}   .claude/references/session-contract.md § Entry${_SB_NC}" >&2
    else
      echo "" >&2
      echo -e "${_SB_RED}✗ Refusing: ${projected}/${_SB_BUDGET_POINTS} pts exceeds the session budget.${_SB_NC}" >&2
      echo "" >&2
      echo -e "${_SB_RED}  Budget per session (.claude/references/session-contract.md § Entry):${_SB_NC}" >&2
      echo -e "${_SB_RED}    1 x L,  or 2-3 x M,  or ~5 x S/XS,  or 1 M + 2-3 S${_SB_NC}" >&2
      echo "" >&2
      echo -e "${_SB_YELLOW}  The contract can only grow by explicit operator approval, and only${_SB_NC}" >&2
      echo -e "${_SB_YELLOW}  within the same budget shape — a 4th M is a new session, not a${_SB_NC}" >&2
      echo -e "${_SB_YELLOW}  bigger contract.${_SB_NC}" >&2
      echo "" >&2
      echo -e "${_SB_YELLOW}  Fix one of these ways:${_SB_NC}" >&2
      echo -e "${_SB_YELLOW}    finish and hand off this session, then pick the ticket up fresh${_SB_NC}" >&2
      echo -e "${_SB_YELLOW}    new-task.sh --issue ${qualified##*#} --over-budget {slug}   # operator-approved${_SB_NC}" >&2
      return 1
    fi
  fi

  printf '%s\t%s\t%s\n' "$qualified" "$points" "$size" >>"$path"

  if [ "$projected" -le "$_SB_BUDGET_POINTS" ]; then
    echo -e "${_SB_GREEN}    within contract.${_SB_NC}" >&2
  fi

  # Drainage: picking up an aged item IS the "pull one aged item" branch of the
  # duty, so count it here rather than asking the session to re-declare it. Only
  # the pull branch is auto-detectable; re-triage is logged with --drain.
  if [ -n "$age_hours" ] && [ "$age_hours" -gt "$_SB_AGED_HOURS" ] 2>/dev/null; then
    _sb_record_drain "$qualified" "pull" "$age_hours"
    echo -e "${_SB_GREEN}    drainage: pulled an aged item ($(_sb_fmt_age "$age_hours") old) — duty satisfied.${_SB_NC}" >&2
  fi
  return 0
}

# Standalone: report the running total without recording anything.
if [ "${BASH_SOURCE[0]}" = "${0}" ]; then
  case "${1:-}" in
    --status)
      _sb_path="$(_sb_ledger_path)" || {
        echo "No CLAUDE_CODE_SESSION_ID — no session ledger." >&2
        exit 0
      }
      echo "Session ledger: ${_sb_path}"
      echo "Spent: $(_sb_total_points "$_sb_path")/${_SB_BUDGET_POINTS} pts"
      _sb_render_ledger "$_sb_path"
      _sb_dpath="$(_sb_drain_ledger_path)" || _sb_dpath=""
      read -r _sb_pulls _sb_retri _sb_sat < <(_sb_drain_state "$_sb_dpath")
      if [ "$_sb_sat" = "1" ]; then
        echo "Drainage: satisfied (${_sb_pulls} pull, ${_sb_retri} re-triage)"
      else
        echo "Drainage: NOT met (${_sb_pulls} pull, ${_sb_retri}/3 re-triage) — pull one aged item or re-triage three"
      fi
      _sb_render_drain "$_sb_dpath"
      ;;
    --drain)
      # Log a drainage action for the re-triage branch (or a manual pull). Reads
      # the item's age and refuses to record one that is not actually aged — a
      # fresh item is not draining the tail. This is input validation, not the
      # warn-only contract gate; a bad kind or a young item exits non-zero.
      _sb_ref="${2:-}"; _sb_kind="${3:-}"
      case " pull $_SB_DRAIN_RETRIAGE_KINDS " in
        *" $_sb_kind "*) : ;;
        *)
          echo "Usage: $0 --drain <issue-ref> <pull|close|reprioritize|digest-fold>" >&2
          exit 2 ;;
      esac
      [ -z "$_sb_ref" ] && { echo "Usage: $0 --drain <issue-ref> <kind>" >&2; exit 2; }
      _sb_q="$(_sb_resolve_ref "$_sb_ref")" || { echo "Could not resolve '${_sb_ref}'." >&2; exit 2; }
      _sb_meta="$(_sb_fetch_issue_meta "$_sb_q")"
      _sb_age="${_sb_meta#*$'\t'}"; [ "$_sb_age" = "$_sb_meta" ] && _sb_age=""
      if [ -z "$_sb_age" ]; then
        echo "Could not read age for ${_sb_q} — not recording (is gh authed?)." >&2
        exit 1
      fi
      if [ "$_sb_age" -le "$_SB_AGED_HOURS" ] 2>/dev/null; then
        # Name the strict inequality in hours as well as days. "only 30d old"
        # against a 30d bar read as an off-by-one to the operator (#2852); it is
        # a real boundary, and the hour counts are what show that.
        echo "${_sb_q} is $(_sb_fmt_age "$_sb_age") old — drainage is for items strictly older than ${_SB_AGED_DAYS}d (${_SB_AGED_HOURS}h; this one is ${_sb_age}h)." >&2
        exit 1
      fi
      _sb_record_drain "$_sb_q" "$_sb_kind" "$_sb_age" || {
        echo "No CLAUDE_CODE_SESSION_ID — cannot key a drainage ledger." >&2
        exit 0
      }
      echo "Logged drainage: ${_sb_kind} on ${_sb_q} ($(_sb_fmt_age "$_sb_age") old)."
      ;;
    --check-drainage)
      # Close-time gate. WARN-ONLY (_SB_DRAIN_ENFORCE=warn): a session that ships
      # without a drainage action is nudged, never blocked, until the level is
      # flipped to refuse after a clean rollout window. Always exit 0 while warn.
      _sb_dpath="$(_sb_drain_ledger_path)" || {
        echo -e "${_SB_YELLOW}⚠  No CLAUDE_CODE_SESSION_ID — drainage gate skipped.${_SB_NC}" >&2
        exit 0
      }
      read -r _sb_pulls _sb_retri _sb_sat < <(_sb_drain_state "$_sb_dpath")
      if [ "$_sb_sat" = "1" ]; then
        echo -e "${_SB_GREEN}▸ Drainage duty met (${_sb_pulls} pull, ${_sb_retri} re-triage).${_SB_NC}" >&2
        exit 0
      fi

      # Nothing logged is TWO findings, and the old warning collapsed them: the
      # session skipped the duty, or the repo has nothing left to drain. A gate
      # that fires when no issue can satisfy it trains sessions to mute it, and
      # then it is ignored on the days there IS aged work — the same cry-wolf
      # failure the funnel_exposure verdict was built to avoid (#2846).
      _sb_slug="$(gh repo view --json nameWithOwner --jq .nameWithOwner 2>/dev/null || true)"
      _sb_oldest="$(_sb_oldest_open_issue "$_sb_slug")"
      _sb_oldest_num="${_sb_oldest%%$'\t'*}"
      _sb_oldest_age="${_sb_oldest#*$'\t'}"
      [ "$_sb_oldest_age" = "$_sb_oldest" ] && _sb_oldest_age=""
      if [ -n "$_sb_oldest_num" ] && [ -n "$_sb_oldest_age" ] && \
         [ "$_sb_oldest_age" -le "$_SB_AGED_HOURS" ] 2>/dev/null; then
        echo -e "${_SB_GREEN}▸ Drainage duty satisfied by vacancy — nothing in ${_sb_slug} clears the ${_SB_AGED_DAYS}d bar.${_SB_NC}" >&2
        echo -e "${_SB_GREEN}    oldest open issue: #${_sb_oldest_num} at $(_sb_fmt_age "$_sb_oldest_age") — the backlog is drained, not the query broken.${_SB_NC}" >&2
        exit 0
      fi

      echo "" >&2
      echo -e "${_SB_YELLOW}⚠  Drainage duty not met — this session logged no aged-item drainage.${_SB_NC}" >&2
      if [ -n "$_sb_oldest_num" ] && [ -n "$_sb_oldest_age" ]; then
        echo -e "${_SB_YELLOW}   ${_sb_slug}'s oldest open issue is #${_sb_oldest_num} at $(_sb_fmt_age "$_sb_oldest_age") — that one qualifies.${_SB_NC}" >&2
      else
        echo -e "${_SB_YELLOW}   Could not read ${_sb_slug:-this repo}'s oldest open issue, so this is${_SB_NC}" >&2
        echo -e "${_SB_YELLOW}   \"nothing was logged\", NOT \"nothing qualifies\". Is gh authed?${_SB_NC}" >&2
      fi
      echo -e "${_SB_YELLOW}   Every contract owes one: pull a > ${_SB_AGED_DAYS}d item, or re-triage three${_SB_NC}" >&2
      echo -e "${_SB_YELLOW}   (close-with-evidence, re-prioritize, or fold into the weekly digest).${_SB_NC}" >&2
      echo -e "${_SB_YELLOW}   Log one with: scripts/lib/session-budget.sh --drain <ref> <kind>${_SB_NC}" >&2
      echo -e "${_SB_YELLOW}   .claude/references/session-contract.md § Entry${_SB_NC}" >&2
      if [ "$_SB_DRAIN_ENFORCE" = "refuse" ]; then exit 1; fi
      exit 0
      ;;
    *)
      echo "Usage: $0 --status | --drain <ref> <kind> | --check-drainage" >&2
      exit 2
      ;;
  esac
fi
