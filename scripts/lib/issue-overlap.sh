#!/usr/bin/env bash
# issue-overlap.sh — warn when a ticket is already being worked somewhere else.
#
# Sourced by new-task.sh before a worktree is created, and callable standalone
# by the /resume skill. Closes brik-llm#1533 (the detection slice of #1485).
#
# Why this exists: on 2026-07-26 two independent sessions both worked brik-llm
# #1525 — one built the portal migration (brik-client-portal#2412) + client
# wiring (#1531), another built the golden-set eval (#1530). Two retrieval-eval
# harnesses landed on main the same night (#1532 to consolidate). Neither
# session saw the other, because the only overlap detection that existed keyed
# on branch-name slug, and the two slugs shared no keyword. Keying on the ISSUE
# NUMBER is what catches that class.
#
# ── This file is a byte-identical copy. brikdesigns/brik-llm is the SOURCE. ────
#
# Several repos ship it, and they are separate git repos, so these are deliberate
# copies and not an import. brikdesigns/brik-llm is the SOURCE OF TRUTH; edit here.
#
# WHICH repos carry it is deliberately NOT written here. The `TWINS` registry in
# brik-llm's scripts/audit/overlap-twin-drift.py is the record. The list that used
# to sit on this line named four repos and was already wrong — tncld adopted the
# gate in tncld#105 and never appeared in it. That is the exact defect
# brik-llm#2272/#2447 are about, reproduced in the header warning against it, and
# it is why the sibling twin pr-path-overlap.sh:53-57 refuses to keep a count in
# prose.
#
# NEVER edit this file anywhere but brik-llm. Fix it there and re-sync every copy
# in the same change — brik-llm's `overlap-twin-drift` workflow compares each
# copy's sha256 against brik-llm's and reads a local edit as DRIFT, not an
# improvement. It fails on a missing copy too.
#
# (This paragraph is deliberately worded to be TRUE in all four copies. The
# header it replaced said "identical twins … keep all three in sync", which read
# as an instruction to whichever copy you had open and was false in every copy.)
#
# What that cost, measured 2026-08-20 for #2442: four copies, four different
# md5s, a 130-line spread, and the fourth copy not named at all. All three
# consumers still carried the fail-open #2422/#2298 had already fixed in
# brik-llm, so `new-task.sh --issue` there created a branch when this gate could
# not run — the #1485 duplicate-work class it exists to stop. Drift ran the other
# way too: brik-bds grew sibling detection (#1663) that brik-llm lacked for 18
# days. A sync claim with no gate behind it is what let both happen, so the gate
# ships with the re-sync.
#
# Usage (sourced):
#   source scripts/lib/issue-overlap.sh
#   check_issue_overlap "1525"                       # issue in the current repo
#   check_issue_overlap "brikdesigns/brik-llm#1525"  # cross-repo reference
#
# Usage (sourced, local git only — no GitHub call, brik-llm#1932):
#   check_worktree_overlap "$PATHS"          # refuses on a live collision (rc 7)
#   check_worktree_overlap "$PATHS" --report # same report, always returns 0
#
# Usage (standalone, for /resume — reports without prompting):
#   scripts/lib/issue-overlap.sh --report 1522
#
# Usage (standalone, BEFORE filing — no issue number exists yet, #2855):
#   scripts/lib/issue-overlap.sh --title "<draft title>" --repo brikdesigns/brik-llm
#
#   Scores the draft against open issues AND open PRs. --repo defaults to the
#   current repo. Always report-only; exits 3 when it printed hits.
#
# Exit / return codes:
#   0  no overlap found, or the operator chose to continue
#   1  operator aborted at the prompt (sourced mode only)
#   2  bad usage / unresolvable issue reference
#   3  pre-file mode only: open work matched the draft title (advisory, #2855)
#   4  the issue does not exist in the resolved repo — check did NOT run (#2298)
#   5  the issue could not be read (transport/auth) — check did NOT run (#2422)
#   6  the number is a PULL REQUEST, not an issue — check did NOT run (#2448)
#
# 4, 5 and 6 are NOT "no overlap". A caller that treats any non-zero as "proceed"
# has reinstated the fail-open both of those tickets are about; see
# new-task.sh's guarded call for the shape that refuses instead.

_IO_YELLOW='\033[1;33m'
_IO_GREEN='\033[0;32m'
_IO_RED='\033[0;31m'
_IO_NC='\033[0m'

# gh_repo_slug / gh_explain_failure (#1590). Guarded because a twin repo may not
# carry the file yet — _io_repo_slug degrades to the old API call if it's absent.
_IO_LIB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ -r "${_IO_LIB_DIR}/gh-error-classify.sh" ]; then
  # shellcheck source=scripts/lib/gh-error-classify.sh
  source "${_IO_LIB_DIR}/gh-error-classify.sh"
fi

# owner/name for the current repo, for zero GraphQL points (#1748).
#
# `gh repo view --json nameWithOwner` costs 1 point and runs on the fleet's hot
# path — new-task.sh sources this lib on every task branch. Worse, an exhausted
# bucket makes it echo nothing, so the caller returned 2 ("unresolvable issue
# reference") for what is a quota problem. `gh_repo_slug` reads `origin` locally
# and costs nothing; the API is the fallback for a checkout with no usable
# remote, and its failure is named by class instead of swallowed.
_io_repo_slug() {
  local slug err
  if declare -F gh_repo_slug >/dev/null 2>&1 && slug="$(gh_repo_slug)"; then
    printf '%s\n' "$slug"
    return 0
  fi
  err="$(mktemp "${TMPDIR:-/tmp}/io-slug-err.XXXXXXXX")"
  if slug="$(gh repo view --json nameWithOwner --jq .nameWithOwner 2>"$err")" \
    && [ -n "$slug" ]; then
    rm -f "$err"
    printf '%s\n' "$slug"
    return 0
  fi
  if declare -F gh_explain_failure >/dev/null 2>&1; then
    gh_explain_failure "$(cat "$err" 2>/dev/null)" >/dev/null
  fi
  rm -f "$err"
  return 1
}

# Resolve "1525" or "owner/repo#1525" into OWNER REPO NUMBER on stdout.
# Bare numbers resolve against the current repo.
_io_resolve_ref() {
  local ref="$1" owner repo num
  if [[ "$ref" =~ ^([A-Za-z0-9._-]+)/([A-Za-z0-9._-]+)#?([0-9]+)$ ]]; then
    owner="${BASH_REMATCH[1]}"; repo="${BASH_REMATCH[2]}"; num="${BASH_REMATCH[3]}"
  elif [[ "$ref" =~ ^#?([0-9]+)$ ]]; then
    num="${BASH_REMATCH[1]}"
    local nwo
    nwo="$(_io_repo_slug)" || return 2
    [ -z "$nwo" ] && return 2
    owner="${nwo%%/*}"; repo="${nwo##*/}"
  else
    return 2
  fi
  printf '%s %s %s\n' "$owner" "$repo" "$num"
}

# Run a `gh` read that emits LINES, with the exit-status discipline
# _io_issue_state established below — and the reason it has to exist twice.
#
# STDOUT IS NOT EVIDENCE OF SUCCESS. `gh api` writes the response BODY to stdout
# whenever `--jq` cannot apply, and for GraphQL that includes a well-formed
# `{"data":…,"errors":[…]}` where gh still exits 1. Measured 2026-08-29:
#
#   $ gh api graphql -f query='…issue(number:2858){state}' --jq '.data…state'
#   rc=1
#   stdout: {"data":{"repository":{"issue":null}},"errors":[{"type":"NOT_FOUND",…
#   stderr: gh: Could not resolve to an Issue with the number of 2858
#
# So `… 2>/dev/null || true` hands back rc 0 with a JSON payload on stdout, and
# the caller prints that payload under a ⚠ banner as if it were a finding. That
# is #2298's defect verbatim, surviving in the two functions #2298 and #2422
# never touched (brik-llm#2448).
#
# Echoes stdout ONLY on success. On failure it echoes NOTHING — a partial or
# error body must never reach a caller that treats output as findings — and
# returns gh's status, with gh's stderr in the caller-owned file $1.
#
# $1 is a caller-owned path, not a global, for the reason _io_issue_state's own
# comment gives: this runs inside a command substitution, so a global assigned
# here is set in a subshell and lost.
_io_gh_lines() {
  local errout="$1"; shift
  local out rc=0
  out="$("$@" 2>"$errout")" || rc=$?
  [ "$rc" -eq 0 ] || return "$rc"
  printf '%s' "$out"
}

# Print every PR that GitHub already associates with this issue, in any repo.
# Uses the issue's own timeline, so a cross-repo PR (the #1525 case: a
# brik-client-portal PR against a brik-llm issue) is caught — a same-repo
# `gh pr list` search would miss it entirely.
#
# Returns non-zero and prints nothing when the read fails; $4 is a caller-owned
# file for gh's diagnostic. The caller must report that as "could not read",
# never as "no linked PRs" — that collapse is #2422.
_io_linked_prs() {
  local owner="$1" repo="$2" num="$3" errout="${4:-/dev/null}"
  _io_gh_lines "$errout" gh api graphql -f query="
    query {
      repository(owner: \"$owner\", name: \"$repo\") {
        issue(number: $num) {
          state
          title
          timelineItems(first: 100, itemTypes: [CROSS_REFERENCED_EVENT, CONNECTED_EVENT]) {
            nodes {
              ... on CrossReferencedEvent {
                source {
                  ... on PullRequest {
                    number state title repository { nameWithOwner }
                  }
                }
              }
              ... on ConnectedEvent {
                subject {
                  ... on PullRequest {
                    number state title repository { nameWithOwner }
                  }
                }
              }
            }
          }
        }
      }
    }" --jq '
      .data.repository.issue.timelineItems.nodes
      | map(.source // .subject)
      | map(select(. != null and .number != null))
      | unique_by(.number)
      | .[]
      | "\(.repository.nameWithOwner)#\(.number) [\(.state)] \(.title)"
    '
}

# Org-wide PR search on the bare issue number. Second signal, because the
# timeline alone is not enough: a cross-repo `Closes brikdesigns/brik-llm#N`
# closes the issue WITHOUT emitting a CrossReferencedEvent (verified 2026-07-26
# — brik-client-portal#2455 closed brik-llm#1551 and left no timeline link), and
# the qualified string is not indexed by search either.
#
# Searching the bare number is the only form that works — GitHub's tokenizer
# drops `#`, so "#1551" and "brik-llm#1551" are no more precise (verified).
# That makes the raw result set noisy, so it is filtered twice: this coarse pass
# keeps any OPEN pr, any CLOSED/MERGED one whose TITLE carries the number, and
# any whose title or body carries a repo-qualified reference — and
# _io_classify_search_hits below then qualifies what survives.
#
# Emits TSV, one row per surviving hit:
#   repo <TAB> number <TAB> STATE-LABEL <TAB> title <TAB> qualified(0|1)
#
# `qualified` is 1 when a REPO-QUALIFIED reference to this issue — `brik-llm#N`
# or `brikdesigns/brik-llm#N` — appears in the PR's title or body. That is the
# only textual form that proves the PR meant *this* repo's #N.
#
# It is a `select` term and not only a column because the coarse pass used to
# gate on the TITLE alone: a closed PR carrying `Closes brikdesigns/brik-llm#N`
# in its BODY and nothing in its title was discarded before the qualifier could
# ever see it — which is the exact shape the org-wide leg was added for, since a
# cross-repo closing keyword emits no CrossReferencedEvent either.
#
# Same exit-status discipline as _io_linked_prs, and #2448 AC 3 is specifically
# that this function was audited rather than assumed clean: it carried the
# identical `2>/dev/null || true`. The search endpoint fails differently from
# GraphQL — 403 on secondary rate limit, 422 on a malformed query — but the leak
# is the same shape, an error body arriving on stdout where the caller reads
# lines. $4 is the caller-owned diagnostic file.
_io_search_raw() {
  local num="$1" org="$2" repo="$3" errout="${4:-/dev/null}"
  # `gh api --jq` takes only a program — it has no --arg — so the values are
  # inlined. Safe: _io_resolve_ref constrained num to [0-9]+ and org/repo to
  # [A-Za-z0-9._-]+. `.` is the only regex metachar that survives; BOTH are
  # escaped, not just repo — the validator that lets a dot through does not
  # distinguish them, so neither may rely on GitHub's own naming rules.
  local repo_re="${repo//./\\\\.}" org_re="${org//./\\\\.}"
  local qual_re="(^|[^A-Za-z0-9/_.-])(${org_re}/)?${repo_re}#${num}(\\\\D|\$)"
  _io_gh_lines "$errout" \
    gh api -X GET search/issues \
    --raw-field q="${num} type:pr org:${org}" \
    --jq ".items[]
      | {repo: (.repository_url|split(\"/\")|last), number, title, state,
         merged: (.pull_request.merged_at != null), body: (.body // \"\")}
      | . + {qualified: ((.title + \" \" + .body) | test(\"${qual_re}\"))}
      | select(.state == \"open\"
               or (.title | test(\"#${num}(\\\\D|\$)\"))
               or .qualified)
      | [ .repo, (.number|tostring),
          (if .merged then \"MERGED\" else (.state|ascii_upcase) end),
          (.title | gsub(\"[\\\\t\\\\n\\\\r]\"; \" \")),
          (if .qualified then \"1\" else \"0\" end) ]
      | @tsv"
}

# Qualify the org-wide hits. Pure: TSV on stdin, "<class><TAB><display>" out,
# one of three classes — `keep`, `caveat`, `drop`. No network, no globals.
#
# Why a filter at all (#2331): every Brik repo numbers in the same range, so a
# bare-number search returns other repos' *own* #N as a matter of course. The
# gate labelled the whole block "may include unrelated" and made the operator
# dismiss it by hand on the fleet's two hottest paths — and a gate whose hits
# are usually noise is one that stops being read, which is the #1485 failure it
# exists to prevent.
#
# Why NOT the rule #2331 proposed. That rule was "cross-repo + CLOSED/MERGED →
# keep only if repo-qualified", flagged in the ticket as needing confirmation
# against the data. Confirmed 2026-08-29, and it fails: the true positives the
# org-wide leg was ADDED for are not repo-qualified anywhere.
#
#   brik-client-portal#2455  "…hybrid lexical dash negation + avg_score mode
#                             split (#1551)"   ← the work for brik-llm#1551
#   brik-client-portal#1555  "Retire dev_analytics; Launch phase owns GA4
#                             (#1551)"         ← portal's OWN #1551
#
# Same repo, same state, same bare-number title shape — one real, one noise. No
# text rule keyed on the reference can separate them, so the reference is not
# the discriminator. The TITLE is: a cross-repo PR that is genuinely this
# ticket's work describes the same problem, and one that merely shares a number
# describes something else. Scored on shared significant tokens, ≥2 to keep,
# which sorted all five live cases correctly (the two above, plus portal#2366 /
# #2363 against brik-llm#2313 and portal#2525 against brik-llm#2333 — all noise,
# all zero shared tokens).
#
# Deliberately cheaper than check_title_overlap's IDF scorer below: that one
# needs the whole open-issue set as a document corpus and shells out to node.
# Here the corpus is ~8 search hits, and this runs on new-task.sh's hot path.
#
# KNOWN LIMIT, and the reason nothing is ever dropped silently: a paraphrase
# scores zero. "Reduce runtime of the overnight data dump" and "Speed up the
# nightly export job" are the same ticket and share no token, and an issue whose
# own title yields fewer than MINSHARED significant tokens ("Fix auth bug" → one)
# can never reach the threshold at all. So `drop` means "not shown as a parallel
# track", never "confirmed unrelated" — the caller prints the count and
# _IO_SEARCH_SHOW_DROPPED=1 names them.
_IO_SEARCH_MIN_SHARED="${_IO_SEARCH_MIN_SHARED:-2}"

_io_classify_search_hits() {
  local issue_repo="$1" issue_title="$2"
  awk -F'\t' -v IREPO="$issue_repo" -v ITITLE="$issue_title" \
             -v MINSHARED="$_IO_SEARCH_MIN_SHARED" '
    function tok(str, out,   i, n, arr, w, c) {
      delete out
      str = tolower(str)
      gsub(/[^a-z0-9]+/, " ", str)
      n = split(str, arr, " ")
      c = 0
      for (i = 1; i <= n; i++) {
        w = arr[i]
        # <4 chars is almost always a preposition or a version marker, and the
        # conventional-commit type ("feat", "chore", "refactor") is on every
        # Brik PR title — counting it would make any two of them look alike.
        if (length(w) < 4 || (w in STOP)) continue
        if (!(w in out)) { out[w] = 1; c++ }
      }
      return c
    }
    BEGIN {
      n = split("feat chore refactor docs test tests spec perf build style " \
                "with without from this that these those which where when what " \
                "have has had been being will would should could into onto over " \
                "under than then such very more most less least each every some " \
                "many much also only just even still both same other " \
                "adds added make makes made using uses used fixes fixed " \
                "issue issues", s, " ")
      for (i = 1; i <= n; i++) STOP[s[i]] = 1
      tok(ITITLE, TGT)
    }
    {
      disp = $1 "#" $2 " [" $3 "] " $4
      # Same repo: unchanged. A bare #N here means exactly what it says.
      if ($1 == IREPO)   { print "keep\t" disp; next }
      # Open, elsewhere: the live concurrency risk. Kept, and kept labelled —
      # a false positive on an open PR is cheap, a miss is the #1525 double-build.
      if ($3 == "OPEN")  { print "caveat\t" disp; next }
      # Closed/merged, elsewhere: needs a reason.
      if ($5 == "1")     { print "keep\t" disp; next }
      shared = 0
      tok($4, HIT)
      for (w in TGT) if (w in HIT) shared++
      if (shared >= MINSHARED) { print "keep\t" disp; next }
      print "drop\t" disp
    }
  '
}

# Drop search hits the timeline already reported. The two sources key
# differently (owner/repo#N vs repo#N), so normalise to repo#N before comparing.
#
# Two-file read, not awk -v: a -v value cannot carry literal newlines, and awk
# fails outright on one — which would silently blank the search list.
_io_minus_timeline() {
  awk '
    function key(s,   f, g, h, m) {
      split(s, f, " "); split(f[1], g, "#"); m = split(g[1], h, "/")
      return h[m] "#" g[2]
    }
    NR == FNR { if ($0 != "") seen[key($0)] = 1; next }
    { if ($0 != "" && !(key($0) in seen)) print }
  ' <(printf '%s\n' "$1") <(printf '%s\n' "$2")
}

# Read "<state>\t<title>". THREE outcomes, and collapsing them is what #2422 and
# #2298 both are:
#
#   rc 0 + stdout   the read succeeded
#   rc 3            the API answered definitively: no such issue
#   rc 2            the read FAILED — transport, auth, timeout. "Could not tell."
#
# Measured with gh 2.x on 2026-08-20, because the three are NOT separable by
# stdout alone:
#
#   ok          rc=0  stdout="open\tTitle"    stderr=""
#   404         rc=1  stdout=<raw JSON body>  stderr="gh: Not Found (HTTP 404)"
#   401         rc=1  stdout=<raw JSON body>  stderr="gh: Bad credentials (HTTP 401)"
#   no network  rc=1  stdout=""               stderr='Get "https://…": proxyconnect…'
#
# Note the PAYLOAD ON STDOUT whenever `--jq` cannot apply. The previous body was
#
#     gh api … --jq '…' 2>/dev/null || true
#
# so a 404 body became the issue's "state" and landed under the ⚠ PRs-already-
# linked banner (#2298), while a network failure became the empty string that the
# caller reported as "no parallel work" (#2422). gh's EXIT STATUS is what
# separates all four; stdout cannot.
#
# Retried ONCE, and only on a transport failure: the observed rate was 1 in 4 on
# an issue that was readable seconds before and after, while a 404 is a settled
# answer that a retry cannot improve.
#
# gh's stderr is handed back through $4, a caller-owned file — NOT a global. This
# function is invoked inside a command substitution, so anything it assigns to a
# global is set in a subshell and lost; the first cut of this fix did exactly
# that and the diagnostic came out empty.
#
# Emits a THIRD field, `pr` or `issue`. `GET repos/{o}/{r}/issues/{n}` answers
# for a pull request too — that is why the gate sailed past a PR number and only
# fell over later, in the GraphQL leg, which has no `issue(number:)` to return
# (brik-llm#2448). The discriminator is the `pull_request` key, present on a PR
# and absent on an issue, and it is FREE: same endpoint, same call, same round
# trip. Verified live 2026-08-29 — brik-llm#2858 (a PR) has it, #2448 does not.
_io_issue_state() {
  local owner="$1" repo="$2" num="$3" errout="${4:-}"
  local out rc errfile attempt
  errfile="$(mktemp)"
  for attempt in 1 2; do
    if out="$(gh api "repos/$owner/$repo/issues/$num" \
                --jq '.state + "\t" + .title + "\t" + (if has("pull_request") then "pr" else "issue" end)' \
                2>"$errfile")"; then
      rc=0
    else
      rc=$?
    fi
    if [ "$rc" -eq 0 ] && [ -n "$out" ]; then
      rm -f "$errfile"
      printf '%s' "$out"
      return 0
    fi
    if grep -q 'HTTP 404' "$errfile" 2>/dev/null; then
      [ -n "$errout" ] && tr '\n' ' ' < "$errfile" > "$errout"
      rm -f "$errfile"
      return 3
    fi
    if [ "$attempt" -eq 1 ]; then sleep 1; fi
  done
  [ -n "$errout" ] && tr '\n' ' ' < "$errfile" > "$errout"
  rm -f "$errfile"
  return 2
}

# Branches (local + remote) whose name carries the issue number as a distinct
# token — `1525` matches `task/rag-1525` and `task/1525-eval`, but not `11525`.
_io_matching_branches() {
  local num="$1"
  {
    git branch --format='%(refname:short)' 2>/dev/null
    git branch -r --format='%(refname:short)' 2>/dev/null | grep -v HEAD
  } | grep -E "(^|[^0-9])${num}([^0-9]|$)" || true
}

# check_issue_overlap <issue-ref> [--report]
# --report prints findings and always returns 0 (no prompt) — for /resume.
check_issue_overlap() {
  local ref="${1:-}" mode="${2:-prompt}"
  [ -z "$ref" ] && return 0

  if ! command -v gh >/dev/null 2>&1; then
    echo -e "${_IO_YELLOW}⚠  gh not on PATH — skipping the issue-overlap check.${_IO_NC}" >&2
    return 0
  fi

  local resolved owner repo num
  if ! resolved="$(_io_resolve_ref "$ref")"; then
    echo -e "${_IO_RED}Error: could not parse issue reference '${ref}'.${_IO_NC}" >&2
    echo "  Expected: 1525  or  owner/repo#1525" >&2
    return 2
  fi
  read -r owner repo num <<<"$resolved"

  # "I could not tell" must NOT wear the shape of "I found nothing". Both of the
  # old fail-open branches returned 0, so new-task.sh:270 read an unanswered
  # lookup as an all-clear and created the branch with the gate never having run
  # (#2422) — the failure mode #2298's own AC4 calls the more serious half.
  local state_line state title read_rc=0 read_err errfile
  errfile="$(mktemp)"
  state_line="$(_io_issue_state "$owner" "$repo" "$num" "$errfile")" || read_rc=$?
  read_err="$(cat "$errfile" 2>/dev/null)"
  rm -f "$errfile"

  if [ "$read_rc" -eq 3 ]; then
    echo "" >&2
    echo -e "${_IO_RED}✗ ${owner}/${repo}#${num} not found — the overlap check did NOT run.${_IO_NC}" >&2
    echo -e "   A bare number resolves against ${owner}/${repo}; for another repo pass 'owner/repo#${num}'." >&2
    return 4
  fi

  if [ "$read_rc" -ne 0 ] || [ -z "$state_line" ]; then
    echo "" >&2
    echo -e "${_IO_RED}✗ Could not read ${owner}/${repo}#${num} — the overlap check did NOT run.${_IO_NC}" >&2
    echo -e "   ${_IO_YELLOW}This is NOT a 'no parallel work' result. Retry before starting work.${_IO_NC}" >&2
    [ -n "$read_err" ] && echo "   gh: ${read_err}" >&2
    return 5
  fi

  # Three fields now, so the title is the MIDDLE one — `${x#*\t}` would carry the
  # kind marker into it and put "issue" on the end of every printed title.
  local kind
  state="$(printf '%s' "$state_line" | cut -f1)"
  title="$(printf '%s' "$state_line" | cut -f2)"
  kind="$(printf '%s' "$state_line" | cut -f3)"

  # A PR number is a caller mistake, and answering it as if it were an issue is
  # what put a raw GraphQL error under the ⚠ banner: the REST read succeeds for a
  # PR, so the gate proceeded, and only the GraphQL leg — which has no
  # `issue(number:)` to resolve — failed, into a `|| true` (brik-llm#2448).
  # Say so in one line instead, before any of that runs.
  if [ "$kind" = "pr" ]; then
    echo "" >&2
    echo -e "${_IO_RED}✗ ${owner}/${repo}#${num} is a PULL REQUEST, not an issue — the overlap check did NOT run.${_IO_NC}" >&2
    echo -e "   ${title}" >&2
    echo -e "   Pass the issue number this PR is for. A bare number resolves against ${owner}/${repo}." >&2
    return 6
  fi

  local prs raw classified searched caveated dropped branches findings=0
  # "Could not read" must not wear the shape of "found nothing" — the #2422
  # collapse, one function over. Both reads are SECOND signals (the hard gate is
  # the issue read above), so a failure here warns and counts as a finding rather
  # than aborting: an unreadable timeline is exactly when the operator should not
  # be told the coast is clear.
  local prs_err search_err prs_rc=0 raw_rc=0
  prs_err="$(mktemp)"; search_err="$(mktemp)"
  prs="$(_io_linked_prs "$owner" "$repo" "$num" "$prs_err")" || prs_rc=$?
  raw="$(_io_search_raw "$num" "$owner" "$repo" "$search_err")" || raw_rc=$?
  local prs_err_txt search_err_txt
  prs_err_txt="$(tr '\n' ' ' < "$prs_err" 2>/dev/null)"
  search_err_txt="$(tr '\n' ' ' < "$search_err" 2>/dev/null)"
  rm -f "$prs_err" "$search_err"
  classified="$(printf '%s\n' "$raw" \
                 | awk 'NF' \
                 | _io_classify_search_hits "$repo" "$title")"
  # head -8 per class, not over the raw set: a slot spent on a same-numbered PR
  # from another repo is exactly what could crowd out the real hit.
  #
  # `|| true` on both, as the line they replaced had: `head` closing the pipe
  # early kills awk with SIGPIPE, the pipeline reports 141, and new-task.sh runs
  # this under `set -euo pipefail` — an aborted pickup with no worktree (#1692).
  searched="$(printf '%s\n' "$classified" | awk -F'\t' '$1=="keep"{print $2}'   | head -8 || true)"
  caveated="$(printf '%s\n' "$classified" | awk -F'\t' '$1=="caveat"{print $2}' | head -8 || true)"
  # awk, not `grep -c`: grep exits 1 on a zero count, and new-task.sh calls this
  # under `set -euo pipefail` — the exact shape of the #1692 abort.
  dropped="$(printf '%s\n' "$classified" | awk -F'\t' '$1=="drop"{n++} END{print n+0}')"
  branches="$(_io_matching_branches "$num")"

  # Drop search hits the timeline already reported. The two sources key
  # differently (owner/repo#N vs repo#N), so normalise to repo#N before
  # comparing — and skip the whole ticket's own number in the current repo.
  if [ -n "$prs" ]; then
    [ -n "$searched" ] && searched="$(_io_minus_timeline "$prs" "$searched")"
    [ -n "$caveated" ] && caveated="$(_io_minus_timeline "$prs" "$caveated")"
  fi

  echo "" >&2
  echo -e "${_IO_YELLOW}▸ Issue-overlap check — ${owner}/${repo}#${num} [${state}]${_IO_NC}" >&2
  echo "    ${title}" >&2

  if [ "$state" = "closed" ]; then
    echo "" >&2
    echo -e "${_IO_YELLOW}⚠  This issue is already CLOSED.${_IO_NC}" >&2
    findings=1
  fi

  if [ "$prs_rc" -ne 0 ]; then
    echo "" >&2
    echo -e "${_IO_YELLOW}⚠  Could NOT read the linked-PR timeline — this is not 'no linked PRs'.${_IO_NC}" >&2
    [ -n "$prs_err_txt" ] && echo "    gh: ${prs_err_txt}" >&2
    findings=1
  elif [ -n "$prs" ]; then
    echo "" >&2
    echo -e "${_IO_YELLOW}⚠  PRs already linked to this issue:${_IO_NC}" >&2
    echo "$prs" | sed 's/^/    /' >&2
    findings=1
  fi

  if [ "$raw_rc" -ne 0 ]; then
    echo "" >&2
    echo -e "${_IO_YELLOW}⚠  Could NOT run the org-wide PR search — this is not 'nothing found'.${_IO_NC}" >&2
    [ -n "$search_err_txt" ] && echo "    gh: ${search_err_txt}" >&2
    findings=1
  fi

  if [ -n "$searched" ]; then
    echo "" >&2
    echo -e "${_IO_YELLOW}⚠  PRs mentioning ${num} (org-wide search):${_IO_NC}" >&2
    echo "$searched" | sed 's/^/    /' >&2
    findings=1
  fi

  # Split out on purpose: an open PR elsewhere is kept on the bare number alone,
  # so it is the one class that still needs the caveat (#2331).
  if [ -n "$caveated" ]; then
    echo "" >&2
    echo -e "${_IO_YELLOW}⚠  OPEN PRs in another repo naming ${num} (may include unrelated):${_IO_NC}" >&2
    echo "$caveated" | sed 's/^/    /' >&2
    findings=1
  fi

  # Never silent, and never counted as an all-clear either. `drop` means "not
  # shown as a parallel track", NOT "confirmed unrelated" — the scorer is
  # lexical, so a paraphrase of this ticket in another repo lands here too. It
  # deliberately does NOT set findings=1 (suppressing noise is the point), so the
  # green line below is suppressed instead: a count and "no parallel work" on
  # the same screen contradict each other, and the operator would believe the
  # greener one.
  if [ "${dropped:-0}" -gt 0 ]; then
    echo "" >&2
    echo -e "\033[2m    ${dropped} closed/merged PR(s) in other repos share the number ${num}" >&2
    echo -e "    with no qualified reference and no title overlap — not shown (#2331)." >&2
    echo -e "    _IO_SEARCH_SHOW_DROPPED=1 lists them.\033[0m" >&2
    if [ "${_IO_SEARCH_SHOW_DROPPED:-0}" = "1" ]; then
      printf '%s\n' "$classified" | awk -F'\t' '$1=="drop"{print "      " $2}' >&2
    fi
  fi

  if [ -n "$branches" ]; then
    echo "" >&2
    echo -e "${_IO_YELLOW}⚠  Branches naming this issue number:${_IO_NC}" >&2
    echo "$branches" | sed 's/^/    /' >&2
    findings=1
  fi

  if [ "$findings" -eq 0 ]; then
    if [ "${dropped:-0}" -gt 0 ]; then
      echo -e "    ${_IO_GREEN}No qualified parallel branch or PR found.${_IO_NC}" >&2
    else
      echo -e "    ${_IO_GREEN}No parallel branch or PR found.${_IO_NC}" >&2
    fi
    return 0
  fi

  [ "$mode" = "--report" ] && return 0

  echo "" >&2
  echo -e "${_IO_YELLOW}   Another track may already be building this ticket.${_IO_NC}" >&2
  echo -e "${_IO_YELLOW}   Check the hits above before duplicating work (brik-llm#1485).${_IO_NC}" >&2
  _io_confirm
  return 0
}

# Gate the warning on acknowledgement WITHOUT ever aborting the caller.
#
# This replaces a bare `read -r`, which killed the pickup outright: on EOF `read`
# returns 1, new-task.sh calls this function unguarded under `set -euo pipefail`
# (scripts/new-task.sh:236 / :19), so a closed stdin took down the script before
# the worktree was created — and the usual trigger is a noisy org-wide search hit
# on a long-merged PR. Reproduced on 2026-07-29 (#1692); fixed first in
# brikdesigns/brik-bds#1549, ported here.
#
# Same contract as new-task.sh's own confirm(): interactive TTY waits, everything
# else prints and proceeds. NEW_TASK_YES=1 is honoured so one env var covers every
# prompt in the pickup path.
_io_confirm() {
  if [ "${NEW_TASK_YES:-0}" = "1" ] || [ ! -t 0 ]; then
    echo -e "${_IO_YELLOW}   → non-interactive: proceeding automatically.${_IO_NC}" >&2
    return 0
  fi
  echo -e "${_IO_YELLOW}   Press Enter to continue anyway, Ctrl+C to abort.${_IO_NC}" >&2
  # `|| true` even on a TTY: a terminal can still deliver EOF (Ctrl+D), and that
  # must not be the difference between a worktree and no worktree.
  read -r || true
}

# ── Sibling-worktree detection (#1932) ─────────────────────────────────────────
#
# Every other detector in this file reads PUBLISHED state — a branch name, a PR,
# an issue title. A session that has created a worktree and started editing, but
# has not committed, pushed or opened a PR, emits none of those. It is invisible
# to all of them, and that is the commonest shape on a machine running eight
# concurrent sessions.
#
# Measured on brikdesigns/brik-bds#1662: two sessions, two worktrees, both with
# `operations/security/secrets.yaml` staged, both rewriting the same
# `github-app-fleet-automation` block, zero commits and zero PRs between them.
# The second session noticed because an unrelated `rg` happened to print the
# first one's worktree path. Nothing but luck separated that from two conflicting
# credential-registry PRs (brik-llm#1932).
#
# The signal is free and LOCAL — `git worktree list` plus a per-worktree
# `git status`. No GitHub call, so this is safe on new-task.sh's hot path where
# every other detector here spends quota (the `gh_repo_slug` precedent at :85).
#
# TWO severities, and keeping them apart is the whole point (AC2). A dirty
# sibling is ambient — eight sessions on brik-mini means eight dirty worktrees on
# a normal afternoon, and a gate that shouts about all of them is one that gets
# read past. A dirty sibling holding a file THIS work is about is a live
# collision, and it gets a distinct block and a non-zero return the caller can
# refuse on.
#
# Why it does NOT depend on pr-path-overlap.sh's intersect_paths, which is the
# same predicate: that file is a twin with a SMALLER consumer set (brik-bds and
# brik-client-portal only — see the TWINS registry in
# scripts/audit/overlap-twin-drift.py). treehouse-pediatric-dentistry and tncld
# carry this file and not that one, so sourcing it would make this function
# silently absent in exactly the two repos with no other overlap tooling at all.
# The intersection is six lines of awk; the cross-twin dependency is permanent.
#
# Exit codes (check_worktree_overlap only — check_issue_overlap's contract at :59
# is deliberately untouched, because new-task.sh's guard keys on it):
#   0  no sibling worktree holds a file in the caller's set
#   7  LIVE FILE COLLISION — a sibling worktree has uncommitted changes to a file
#      the caller's set names. Advisory ONLY in --report mode.

# Physical path of a directory, symlinks resolved on both sides of every
# comparison below. `git worktree list` prints the path git recorded at creation
# time, which on macOS routinely differs from the caller's `pwd` by /private —
# and a string compare that misses makes the caller its own sibling, which is a
# guaranteed self-collision on every dirty worktree.
_io_physical() {
  ( cd "${1:-}" 2>/dev/null && pwd -P ) || printf '%s' "${1:-}"
}

# Every worktree path except the caller's own, one per line.
#
# IO_WORKTREE_LIST_CMD / IO_WORKTREE_STATUS_CMD are the test injection points.
# Without them, exercising this would mean running `git worktree list` against
# whatever repo the test is standing in — the brik-llm#1539 failure mode that
# pr-path-overlap.sh's PPO_DIFF_CMD seam exists to avoid.
_io_worktree_list() {
  git worktree list --porcelain 2>/dev/null | awk '/^worktree /{print $2}'
}

_io_worktree_status() {
  # Porcelain v1, and `cut -c4-` rather than awk on $2: the status code occupies
  # columns 1-2 and a path may contain spaces. Rename rows read `R  old -> new`;
  # the arrow form is normalised to the destination, which is the file that is
  # actually dirty on disk.
  git -C "${1:-}" status --porcelain 2>/dev/null \
    | cut -c4- \
    | sed 's/.* -> //' \
    | sed 's/^"\(.*\)"$/\1/' \
    | awk 'NF'
}

_io_sibling_worktrees() {
  local self here
  self="$(_io_physical "$(git rev-parse --show-toplevel 2>/dev/null || printf '.')")"
  while IFS= read -r wt; do
    [ -n "$wt" ] || continue
    here="$(_io_physical "$wt")"
    [ "$here" = "$self" ] && continue
    printf '%s\n' "$wt"
  done < <(${IO_WORKTREE_LIST_CMD:-_io_worktree_list})
}

# Exact-match intersection of two newline-separated path lists.
#
# Two process substitutions rather than `awk -v`: an -v value cannot carry
# literal newlines and awk fails outright on one, which would silently blank the
# result — the same trap _io_minus_timeline at :363 documents.
_io_intersect() {
  local mine="${1:-}" theirs="${2:-}"
  [ -n "$mine" ] && [ -n "$theirs" ] || return 0
  awk '
    NR == FNR { if ($0 != "") mine[$0] = 1; next }
    { if ($0 != "" && ($0 in mine) && !seen[$0]++) print }
  ' <(printf '%s\n' "$mine") <(printf '%s\n' "$theirs")
}

# check_worktree_overlap [<caller-path-set>] [--report]
#
# The caller's path set resolves in two steps, and BOTH are needed:
#
#   1. the argument, when given. new-task.sh passes the paths the TICKET names —
#      already computed for check_ticket_path_overlap, so this costs no extra
#      read. It has to be passed in, because at new-task.sh time the caller's own
#      dirty set is guaranteed EMPTY: scripts/new-task.sh:119-132 refuses to run
#      at all when the primary worktree has uncommitted changes. Reading "the
#      caller's files" literally there would make this half of AC2 dead code on
#      the one path it most needs to fire.
#   2. otherwise the caller's own dirty files. That is the /resume case and the
#      re-run-from-inside-a-worktree case — which is precisely the shape of the
#      #1662 incident, where the session that noticed was mid-edit in its own
#      worktree with the colliding file already staged.
check_worktree_overlap() {
  local mine="${1:-}" mode="${2:-prompt}"
  case "$mine" in --report) mode="--report"; mine="" ;; esac

  command -v git >/dev/null 2>&1 || return 0
  git rev-parse --is-inside-work-tree >/dev/null 2>&1 || return 0

  local siblings
  siblings="$(_io_sibling_worktrees)"
  [ -n "$siblings" ] || return 0

  if [ -z "$mine" ]; then
    mine="$(${IO_WORKTREE_STATUS_CMD:-_io_worktree_status} \
              "$(git rev-parse --show-toplevel 2>/dev/null)")"
  fi

  local wt dirty shared dirty_report="" collisions=""
  while IFS= read -r wt; do
    [ -n "$wt" ] || continue
    dirty="$(${IO_WORKTREE_STATUS_CMD:-_io_worktree_status} "$wt")"
    [ -n "$dirty" ] || continue
    dirty_report="${dirty_report}${wt}"$'\t'"$(printf '%s\n' "$dirty" | wc -l | tr -d ' ')"$'\n'
    shared="$(_io_intersect "$mine" "$dirty")"
    [ -n "$shared" ] || continue
    collisions="${collisions}${wt}"$'\t'"$(printf '%s\n' "$shared" | paste -sd, -)"$'\n'
  done < <(printf '%s\n' "$siblings")

  # Ambient class. Named, never dressed as a finding: on a machine running eight
  # sessions this is the normal state of the afternoon.
  if [ -n "$dirty_report" ]; then
    echo "" >&2
    echo -e "\033[2m    Sibling worktrees with uncommitted changes (local git, no API):" >&2
    printf '%s' "$dirty_report" \
      | awk -F'\t' '{ printf "      %s — %s dirty file(s)\n", $1, $2 }' >&2
    echo -e "      Not a finding on its own; report them, never commit or push one (#2635).\033[0m" >&2
  fi

  [ -n "$collisions" ] || return 0

  # Collision class. A DISTINCT block, deliberately not sharing the ⚠ banner the
  # branch/PR hits use: "someone published work on this ticket" and "someone is
  # editing this file right now" are different facts and must not read alike.
  echo "" >&2
  echo -e "${_IO_RED}⛔ LIVE FILE COLLISION — a sibling worktree is editing a file this work names:${_IO_NC}" >&2
  printf '%s' "$collisions" \
    | awk -F'\t' '{ printf "    %s\n        %s\n", $1, $2 }' >&2
  # BOTH sides named, not only the far one (AC6). "operations/security/secrets.yaml
  # is contended" is not actionable until the operator can see which two checkouts
  # hold it — and on a machine with eight worktrees the near side is not obvious
  # from the cwd, because this also runs from the primary via new-task.sh.
  echo -e "    ${_IO_YELLOW}yours:${_IO_NC} $(git rev-parse --show-toplevel 2>/dev/null)" >&2
  echo "" >&2
  echo -e "${_IO_YELLOW}   Those changes are UNCOMMITTED, so no branch, PR or claim can see them —${_IO_NC}" >&2
  echo -e "${_IO_YELLOW}   this is the only check that can. brik-bds#1662: two sessions rewrote the${_IO_NC}" >&2
  echo -e "${_IO_YELLOW}   same secrets.yaml block, and only an unrelated rg caught it (brik-llm#1932).${_IO_NC}" >&2
  echo -e "${_IO_YELLOW}   Read that worktree before you start. Never commit or push it (#2635).${_IO_NC}" >&2

  # AC4, decided: a non-zero return AND a distinctly-marked block, and NO
  # _io_confirm. Every other warning here funnels through _io_confirm, which
  # honours NEW_TASK_YES and a closed stdin — correct for a stale merged-PR hit,
  # and wrong for this one, because NEW_TASK_YES=1 is how the entire fleet runs.
  # Sharing that disposition would make the strongest signal in the file the one
  # nobody ever sees. The caller decides instead; new-task.sh refuses on 7 and
  # documents its own opt-out.
  [ "$mode" = "--report" ] && return 0
  return 7
}

# ── Sibling-issue detection (#1663) ────────────────────────────────────────────
#
# The number-keyed gate above is blind to the commonest duplicate shape: two
# sessions each notice the same problem, each FILE THEIR OWN ISSUE, and each
# claim their own number. Both gates are satisfied while the work is identical.
# Measured 2026-08-02: #1645 (14:16Z) and #1648 (14:40Z) were the same brik-rag
# ingest-cap fix, and produced PRs #1650 and #1651 thirty seconds apart.
#
# Scores open issue titles against this one by SHARED SIGNIFICANT TOKENS, then
# weights each shared token by inverse document frequency across the open set —
# so a rare pair like "standards"+"ingest" outranks a common domain phrase like
# "story"+"shape", which otherwise buries the signal under six false positives.
# Verified against the real pair: scoring #1648's title with #1645 open returns
# #1645 alone at 2.00, and an unrelated title returns only itself.
#
# It protects the SECOND mover only, and cannot see a session that files later.
# Neither this nor pr-path-overlap.sh could have caught the 30-second PR race in
# #1660/#1661 — nothing polling GitHub can. This closes the 23-minute case.
#
# Written first in brik-bds (#1663) and ported here by #2442, which is the whole
# point of the gate below: this block existed in ONE of four copies for 18 days,
# so brik-llm's own new-task.sh never had sibling detection at all.
#
# It sits BEFORE the standalone guard on purpose. brik-bds had it after, past an
# `exit $?`, so `issue-overlap.sh --report N` never defined these at all — only
# sourced callers saw them.
_IO_TITLE_MIN_TOKENS="${_IO_TITLE_MIN_TOKENS:-2}"
_IO_TITLE_MIN_SCORE="${_IO_TITLE_MIN_SCORE:-0.5}"

# Score a corpus of open work against a title. Pure: rows JSON on stdin,
# "number<TAB>score<TAB>shared<TAB>title<TAB>kind" out, best first. No network.
#
# Each row is {number, title} plus an optional "kind" ("issue" | "pr"), which
# defaults to "issue" so the two callers that predate #2855 need no change. The
# kind is the FIFTH column for the same reason: `check_title_overlap` and
# `check_phrase_overlap` both awk on $1/$3/$4, and appending cannot disturb them.
#
# Self-exclusion is kind-aware. A PR and an issue can carry the same number in
# the same repo, so excluding on the number alone would drop a genuine PR hit
# whenever it happened to collide with the issue being scored.
_io_score_titles() {
  SELF_NUM="$1" TITLE="$2" node --input-type=commonjs -e '
    const fs = require("node:fs");
    const STOP = new Set(("a an the and or but if is are was were be been being of to in on for " +
      "from with without at by as it its this that these those not no never when where which who " +
      "whom how why what add adds added fix fixes fixed use uses using make makes made into onto " +
      "over under every all any some more most less least than then so such via per we our you your"
      ).split(/\s+/));
    const sig = (t) => [...new Set(String(t || "").toLowerCase()
      .replace(/[^a-z0-9\s-]/g, " ").split(/[\s-]+/)
      .filter((w) => w.length >= 4 && !STOP.has(w)))];
    const rows = JSON.parse(fs.readFileSync(0, "utf8"));
    const self = Number(process.env.SELF_NUM);
    const minTokens = Number(process.env.MIN_TOKENS || 2);
    const minScore = Number(process.env.MIN_SCORE || 0.5);
    const df = new Map();
    for (const r of rows) for (const w of sig(r.title)) df.set(w, (df.get(w) ?? 0) + 1);
    const target = sig(process.env.TITLE);
    rows.map((r) => {
      const have = new Set(sig(r.title));
      const shared = target.filter((w) => have.has(w));
      const kind = r.kind === "pr" ? "pr" : "issue";
      return { r, kind, shared, score: shared.reduce((a, w) => a + 1 / (df.get(w) ?? 1), 0) };
    })
      .filter((x) => !(x.kind === "issue" && x.r.number === self))
      .filter((x) => x.shared.length >= minTokens && x.score >= minScore)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .forEach((x) => console.log(
        [x.r.number, x.score.toFixed(2), x.shared.join("+"), x.r.title, x.kind].join("\t")));
  '
}

# Emits "number<TAB>score<TAB>shared<TAB>title<TAB>kind" per candidate, best first.
_io_similar_open_issues() {
  local owner="$1" repo="$2" num="$3" title="$4" rows
  command -v node >/dev/null 2>&1 || return 0

  rows="$(gh issue list --repo "${owner}/${repo}" --state open --limit 200 \
            --json number,title 2>/dev/null)" || return 0
  [ -z "$rows" ] && return 0

  _io_score_titles "$num" "$title" <<<"$rows"
}

# Warn (never block) when another OPEN issue looks like the same problem.
check_title_overlap() {
  local ref="${1:-}" mode="${2:-prompt}"
  [ -z "$ref" ] && return 0
  command -v gh >/dev/null 2>&1 || return 0

  local resolved owner repo num
  resolved="$(_io_resolve_ref "$ref")" || return 0
  read -r owner repo num <<<"$resolved"

  # `|| return 0` is load-bearing, and was NOT needed in brik-bds's version.
  # There, _io_issue_state ended in `|| true` and could only return 0; #2422 gave
  # it rc 2 (unreadable) and rc 3 (no such issue). new-task.sh runs under
  # `set -euo pipefail`, so an unguarded assignment from a command substitution
  # that returns non-zero takes the whole script down before the worktree exists.
  # This gate is advisory — an unreadable title means no advice, never an abort.
  local state_line title siblings
  state_line="$(_io_issue_state "$owner" "$repo" "$num")" || return 0
  [ -z "$state_line" ] && return 0
  # Field 2 of three. `${x#*\t}` took "title<TAB>kind" once the kind marker was
  # added, which fed the marker into the similarity scorer as a title token.
  title="$(printf '%s' "$state_line" | cut -f2)"

  siblings="$(MIN_TOKENS="$_IO_TITLE_MIN_TOKENS" MIN_SCORE="$_IO_TITLE_MIN_SCORE" \
              _io_similar_open_issues "$owner" "$repo" "$num" "$title")"
  [ -z "$siblings" ] && return 0

  echo "" >&2
  echo -e "${_IO_YELLOW}⚠  Open issues that look like the same problem:${_IO_NC}" >&2
  printf '%s\n' "$siblings" | awk -F'\t' '{ printf "    #%s  [%s]  %s\n", $1, $3, $4 }' >&2
  echo "" >&2
  echo -e "${_IO_YELLOW}   Two sessions each filing their own ticket is how #1645/#1648 became${_IO_NC}" >&2
  echo -e "${_IO_YELLOW}   duplicate PRs #1650/#1651. Read those before building (#1663).${_IO_NC}" >&2

  [ "$mode" = "--report" ] && return 0
  _io_confirm
  return 0
}

# Same warning for work that has no issue to compare FROM — `--no-issue`, where
# the branch slug is the only statement of intent that exists.
#
# This is the half of #1663 that check_title_overlap structurally cannot cover:
# it needs an issue number to read a title off. #1660 was a `--no-issue` branch
# that duplicated issue #1661, so the duplicate was an OPEN ISSUE the session
# never looked for. Scoring the slug against open titles is the only signal
# available before a PR exists.
#
# Self-exclusion is passed 0: a ticketless slug has no issue of its own to skip,
# and issue numbering starts at 1.
check_phrase_overlap() {
  local phrase="${1:-}" mode="${2:-prompt}"
  [ -z "$phrase" ] && return 0
  command -v gh >/dev/null 2>&1 || return 0

  local nwo owner repo siblings
  nwo="$(_io_repo_slug)" || return 0
  [ -z "$nwo" ] && return 0
  owner="${nwo%%/*}"; repo="${nwo##*/}"

  siblings="$(MIN_TOKENS="$_IO_TITLE_MIN_TOKENS" MIN_SCORE="$_IO_TITLE_MIN_SCORE" \
              _io_similar_open_issues "$owner" "$repo" 0 "$phrase")"
  [ -z "$siblings" ] && return 0

  echo "" >&2
  echo -e "${_IO_YELLOW}⚠  This slug looks like an open issue that already exists:${_IO_NC}" >&2
  printf '%s\n' "$siblings" | awk -F'\t' '{ printf "    #%s  [%s]  %s\n", $1, $3, $4 }' >&2
  echo "" >&2
  echo -e "${_IO_YELLOW}   --no-issue means \"genuinely no ticket\". If one of these IS the ticket,${_IO_NC}" >&2
  echo -e "${_IO_YELLOW}   re-run with --issue <N> so the claim gate can see you (#1663).${_IO_NC}" >&2

  [ "$mode" = "--report" ] && return 0
  _io_confirm
  return 0
}

# ── Pre-file detection (#2855) ─────────────────────────────────────────────────
#
# Both detectors above need an issue that already exists — one takes a number to
# read a title off, the other a branch slug. Neither is reachable from the
# FILING path, so the one tool in the fleet that can see an open PR only runs
# after the duplicate ticket has been created.
#
# That is not theoretical. brik-client-portal#3670 was filed 8 minutes after
# #3671 opened, for the same defect, and the pre-filing checklist's gate 1 was
# satisfied the whole time — it names issue searches only, and `gh issue list`
# does not return PRs. The evidence got worse after filing: #2860 and #2861 both
# bumped the brik-bds submodule to v0.177.0 and BOTH merged, 2.5h apart on
# 2026-08-29. The miss now produces duplicate merged work, not just duplicate
# filings.
#
# So the corpus here is open issues AND open PRs, and the input is a draft title
# rather than a number.
#
# Silence on no match is a requirement, not an accident (AC4). #1485's own
# history is a merged-branch warning that fired on every task and was learned
# past; a pre-file gate that speaks on every filing is the same failure.

# Open issues + open PRs in one rows array, each tagged with its kind.
#
# Two calls, not one search: `gh issue list` excludes PRs by design, and the
# search API's `type:` split is the same two round-trips against a rate-limit
# bucket 25x smaller. Both are best-effort — an unreadable half degrades to the
# other rather than aborting a filing, which is the advisory contract the rest
# of this file keeps.
#
# Assembled with gh's OWN --jq (one compact object per line, joined here) rather
# than the jq binary. jq is not currently a dependency of this lib or of
# new-task.sh, and a gate that needs a tool the host may not have is a gate that
# goes quiet on the machines that lack it — the #2765 shape, where the failure
# is silence rather than an error.
#
# `awk NF` and `|| true` are the #2423 discipline: this lib is sourced under
# `set -euo pipefail`, where a `grep` that filters everything exits 1 and takes
# the caller down before it can print anything.
_io_open_work_rows() {
  local owner="$1" repo="$2" issues prs joined
  issues="$(gh issue list --repo "${owner}/${repo}" --state open --limit 200 \
              --json number,title \
              --jq '.[] | {number, title, kind: "issue"}' 2>/dev/null)" || issues=""
  prs="$(gh pr list --repo "${owner}/${repo}" --state open --limit 200 \
           --json number,title \
           --jq '.[] | {number, title, kind: "pr"}' 2>/dev/null)" || prs=""

  joined="$(printf '%s\n%s\n' "$issues" "$prs" | awk 'NF' | paste -sd, - || true)"
  [ -z "$joined" ] && return 0
  printf '[%s]' "$joined"
}

# Warn (never block) when a DRAFT title looks like open work that already exists.
#
# Report-only by design, with no _io_confirm branch. The caller is an agent about
# to run `gh issue create`, usually with no TTY — prompting there is the #2812
# shape, where a bare `read` killed non-interactive pickups outright.
#
#   check_draft_overlap "<draft title>" [owner/repo]
#
# Returns 0 when nothing matched, 3 when it printed hits, so a wrapper can gate
# on it. 3 is advisory: the scorer is lexical, so a hit is a thing to READ, never
# a refusal to file.
check_draft_overlap() {
  local title="${1:-}" nwo="${2:-}"
  [ -z "$title" ] && return 0
  command -v gh >/dev/null 2>&1 || return 0
  command -v node >/dev/null 2>&1 || return 0

  local owner repo rows hits
  if [ -z "$nwo" ]; then
    nwo="$(_io_repo_slug)" || return 0
    [ -z "$nwo" ] && return 0
  fi
  case "$nwo" in
    */*) owner="${nwo%%/*}"; repo="${nwo##*/}" ;;
    *)   return 2 ;;
  esac

  rows="$(_io_open_work_rows "$owner" "$repo")" || return 0
  [ -z "$rows" ] && return 0

  # Self-exclusion is 0: nothing has been filed yet, and issue numbering
  # starts at 1.
  hits="$(MIN_TOKENS="$_IO_TITLE_MIN_TOKENS" MIN_SCORE="$_IO_TITLE_MIN_SCORE" \
          _io_score_titles 0 "$title" <<<"$rows")"
  [ -z "$hits" ] && return 0

  echo "" >&2
  echo -e "${_IO_YELLOW}⚠  Open work in ${owner}/${repo} that looks like this draft:${_IO_NC}" >&2
  printf '%s\n' "$hits" | awk -F'\t' \
    '{ printf "    %s #%s  [%s]  %s\n", ($5 == "pr" ? "PR " : "issue"), $1, $3, $4 }' >&2
  echo "" >&2
  echo -e "${_IO_YELLOW}   An OPEN PR satisfies the issue-search gate and still duplicates the${_IO_NC}" >&2
  echo -e "${_IO_YELLOW}   work — portal#3670 was filed 8 minutes after #3671 opened (#2855).${_IO_NC}" >&2
  echo -e "${_IO_YELLOW}   Read each before filing; the scorer is lexical, so a hit is not a verdict.${_IO_NC}" >&2
  return 3
}

# Standalone invocation: scripts/lib/issue-overlap.sh [--report] <issue-ref>
#
# BOTH detectors run, and that is the point of #2765. This dispatch called only
# check_issue_overlap, so `/resume` step 4 — which shells out to exactly this
# path — never saw a sibling issue. #2717 and #2747 were filed 18 hours apart,
# both p1/M, both children of the same umbrella #2472, both about the same lens
# on the same Item, and `--report` on #2747 printed "No parallel branch or PR
# found." It was telling the truth about branches and PRs and silent about the
# duplicate sitting beside it.
#
# The title half is ADVISORY and returns 0 on anything it cannot read, so it
# cannot change this script's exit status. The number half's rc is therefore
# still the one that propagates — rc 4/5 ("the gate did NOT run") must keep
# reaching new-task.sh's guard, which is what #2422/#2298 bought.
# The dispatch is a FUNCTION, not inline under the guard, so a test can stub both
# detectors and assert the calls. Inline it could not be reached: the guard only
# fires when the file is run as a script, and by then the lib's own definitions
# have overridden any stub a test could inject.
#
# That matters more than it sounds. The #2765 defect was a dispatch that omitted a
# call — a class no unit test of the scorer can catch, and the only class this
# file's history says actually happens. See scripts/test/test-overlap-standalone-dispatch.sh.

# Two ranges, not the usual one: lines 15-44 are the twin-sync warning, which is
# for whoever EDITS this file, not for whoever runs it. Printing them would bury
# the usage under an essay about sha256 drift.
_io_usage() { sed -n '2,3p;46,75p' "$0" | sed 's/^# \{0,1\}//'; }

_io_main() {
  local mode="prompt" ref="" draft="" nwo="" rc=0
  while [ $# -gt 0 ]; do
    case "$1" in
      -h|--help) _io_usage; return 0 ;;
      --report) mode="--report" ;;
      --title)  draft="${2:-}"; shift ;;
      --repo)   nwo="${2:-}"; shift ;;
      -*)       echo "issue-overlap: unknown flag $1" >&2; return 2 ;;
      *)        ref="$1" ;;
    esac
    shift
  done

  # Pre-file mode (#2855): a draft title and no issue, so the number half has
  # nothing to resolve. It is its own branch rather than an extra detector on
  # the issue path, because there IS no issue yet — that is the whole gap.
  if [ -n "$draft" ]; then
    [ -n "$ref" ] && { echo "issue-overlap: --title takes no issue ref" >&2; return 2; }
    check_draft_overlap "$draft" "$nwo"
    return $?
  fi
  [ -n "$nwo" ] && { echo "issue-overlap: --repo is only valid with --title" >&2; return 2; }

  if [ "$mode" = "--report" ]; then
    check_issue_overlap "$ref" --report || rc=$?
  else
    check_issue_overlap "$ref" || rc=$?
  fi

  # Only when the number half could actually read the issue. rc 4 (no such
  # issue) and rc 5 (unreadable) mean the gate did NOT run, and a title lookup
  # would fail the same way and print nothing — running it would only add noise
  # to a failure the caller is about to refuse on (#2422 / #2298).
  if [ "$rc" -eq 0 ]; then
    if [ "$mode" = "--report" ]; then
      check_title_overlap "$ref" --report
    else
      check_title_overlap "$ref"
    fi
  fi

  # Third detector, and the only one that reads UNPUBLISHED state (brik-llm#1932).
  # Runs regardless of $rc, unlike the title half above: that one needs a title it
  # could not read on rc 4/5, while this one reads local git and is just as true
  # when the issue lookup failed. It is also the reason rc 4/5 is survivable —
  # "the API gate did not run" is exactly when a local signal is worth the most.
  #
  # --report here even in prompt mode: the standalone script is /resume's step 4,
  # which must never abort a pickup, and $rc must keep carrying the number half's
  # 4/5/6 to new-task.sh's guard. new-task.sh calls the function directly for the
  # refusing form.
  check_worktree_overlap --report

  return "$rc"
}

if [ "${BASH_SOURCE[0]}" = "${0}" ]; then
  _io_main "$@"
  exit $?
fi
