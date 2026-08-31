#!/usr/bin/env bash
# issue-path-overlap.sh — warn when an OPEN ISSUE names a file you are about to
# edit. brik-llm#2314, the issue-side half of the #1485 collision surface.
#
# Every other gate in this family keys on PUBLISHED GIT STATE — a branch, a PR,
# a worktree. None of them read the backlog. So two sessions on legitimately
# different tickets, with no branch or PR overlap, still collide on the same
# code and every gate passes.
#
# The live shape, 2026-08-18 in `nstaner/nstanerson-macos`: session A rewrote
# `monitor/backup_health.py` under #5/#8 while session B filed #9 about a defect
# in that same file. No branch overlap, no PR overlap; `issue-overlap.sh` and
# `pr-path-overlap.sh` both clean. Two commits landed on a file that an open
# issue described as broken, and #9's eventual fixer now rebases against a
# diagnosis that moved underneath it.
#
# The signal was already public: an open issue NAMED THE FILE.
#
#   sibling gate            corpus                    catches
#   ─────────────────────────────────────────────────────────────────────────
#   issue-overlap.sh        PRs + branches by number  same ticket, two sessions
#   pr-path-overlap.sh      open PRs by path          different tickets, one file
#   this file               open ISSUES by path       a known defect in a file
#                                                     nobody has started yet
#
# Usage (sourced):
#   source scripts/lib/issue-path-overlap.sh
#   check_issue_path_overlap 2314          # task-start, paths from the ticket
#
# Return codes: always 0. This warns, it never blocks — the same advisory
# contract the sibling gates keep (#1692/#1549).

# shellcheck disable=SC2148  # sourced

_IPO_YELLOW='\033[1;33m'
_IPO_GREEN='\033[0;32m'
_IPO_NC='\033[0m'

# `ticket_paths_from_text` lives in pr-path-overlap.sh and is reused verbatim
# rather than re-derived: its false-positive behaviour is the thing #2313 spent a
# ticket tuning, and a second copy of that tuning is a second place for it to rot
# (tooling-duplication-census.py measures exactly this). Sourced only when
# absent, so new-task.sh's existing source order — which already pulls
# pr-path-overlap.sh in first — costs nothing.
#
# The set intersection is NOT `intersect_paths`: since #2910 the match is scored
# and ordered by how rare each shared path is in the corpus, which a boolean
# intersection cannot express. See `issues_naming_paths`.
if ! declare -F ticket_paths_from_text >/dev/null 2>&1; then
  # shellcheck source=scripts/lib/pr-path-overlap.sh
  . "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/pr-path-overlap.sh"
fi

# ── Pure helpers (no network, no git) ──────────────────────────────

# Open issues whose TITLE or BODY names one of MINE.
#
#   stdin:  number<TAB>title<TAB>flattened-title-and-body
#   args:   1 = my paths (newline-separated)
#           2 = issue number to exclude (this session's own ticket)
#           3 = tracked paths for the repo the records came from
#   stdout: number<TAB>title<TAB>shared,shared
#
# The candidate extraction is `ticket_paths_from_text`, so the anchoring rule is
# #2313's, unchanged: a token only counts if it resolves to a file that actually
# EXISTS in that repo. `brikdesigns/brik-llm`, `https://…/context-rot` and `e.g.`
# all match a path-shaped regex and none of them survives `git ls-files`. That is
# what keeps this under AC3's bar — #2101, where a gate that cries wolf got
# switched off.
#
# The self-exclusion is not cosmetic. The ticket you are about to build names
# the files you are about to edit, by construction, so without it this gate
# reports the session's own ticket back at it on every single run — and a warning
# that fires every time is the #1485 merged-branch warning, learned past within a
# week.
#
# ── Ubiquity suppression (#2910) ────────────────────────────────────────────
#
# Anchoring against `git ls-files` rejects prose that merely looks path-shaped.
# It does not reject a real tracked file that half the backlog mentions in
# passing, and that is a different failure with the same #2101 ending. Measured
# on brik-llm's 200 newest open issues, 2026-08-30 — 277 distinct paths resolved,
# 190 of them named by exactly one issue:
#
#   path                              issues naming it   % of corpus
#   ──────────────────────────────────────────────────────────────────
#   CLAUDE.md                                36             18.0
#   scripts/morning-check.sh                 23             11.5
#   operations/security/secrets.yaml         22             11.0
#   scripts/lib/issue-overlap.sh             13              6.5
#
# A single passing reference to `CLAUDE.md` in a body pulled in 35 unrelated
# issues — 73% of #2906's 48-hit run. So ubiquity is keyed on DOCUMENT FREQUENCY
# in the corpus, never on a denylist of filenames: frequency is a property of the
# backlog and moves with it, whereas a denylist trades one wrong answer for
# another and would silence a ticket that genuinely IS about `CLAUDE.md`.
#
# The 15% default is the midpoint of the largest gap in that distribution
# (11.5% → 18.0%), not a guess. Swept across the same data, every threshold from
# 8% to 15% produced the identical #2906 result (47 hits → 16); below 8% it began
# eating `scripts/lib/issue-overlap.sh` at 6.5%, and at 18% nothing suppresses at
# all. 15% therefore sits with ~3 points of headroom on both sides of the band.
#
# `IPO_UBIQUITY_MIN` is a floor, not a second threshold: on a repo with 12 open
# issues, 15% is under two issues and every path would read as ubiquitous. A path
# has to be named by at least this many issues before frequency means anything.
#
# And the suppression is a FALLBACK, never absolute: a ubiquitous path is dropped
# only while some rarer path survives. A ticket whose only named file is
# `CLAUDE.md` still gets all 36 hits, which is AC3 — the case a denylist gets
# wrong by construction.
#
# Ordering (AC4) happens here rather than at display time, because the
# `IPO_MAX_HITS` cap slices whatever it is handed. On the #2906 run the cap's 8
# rows were in ISSUE-NUMBER order and therefore dominated by `CLAUDE.md`, while
# the two genuinely relevant hits sat inside the `… and 40 more` remainder. Rows
# come out rarest-shared-path first, ties broken by how many paths are shared,
# and each row's own path list is ordered the same way.
issues_naming_paths() {
  local mine="${1:-}" exclude="${2:-}" tracked="${3:-}" num title text paths
  [ -n "$mine" ] && [ -n "$tracked" ] || return 0

  # One pass over the corpus, extracting each issue's paths ONCE into an index of
  # `number<TAB>title<TAB>path` triples. Document frequency needs the whole
  # corpus in hand before any hit can be judged, and re-reading it would mean a
  # second `ticket_paths_from_text` per row — the most expensive thing here.
  local index="" corpus=0
  # `|| [ -n "$num" ]` so the LAST record survives an unterminated stream. The
  # rows reach here through a cache round-trip that does not preserve the
  # trailing newline `gh --jq` emits, and a plain `read` loop silently drops the
  # final row — which in a one-row corpus is the whole corpus.
  while IFS=$'\t' read -r num title text || [ -n "$num" ]; do
    [ -n "$num" ] || continue
    [ -n "$exclude" ] && [ "$num" = "$exclude" ] && continue
    corpus=$((corpus + 1))
    paths="$(ticket_paths_from_text "$text" "$tracked")"
    [ -n "$paths" ] || continue
    index="${index}$(printf '%s\n' "$paths" | sed "s|^|${num}	${title}	|")
"
  done
  [ -n "$index" ] || return 0

  # Sort keys are emitted as leading columns and stripped again, because the awk
  # here is POSIX awk — `asort` is a gawk extension and macOS ships BWK awk.
  # Second key is negated so a plain ascending numeric sort puts the row sharing
  # the MOST paths first.
  # `mine` is space-joined for the handoff: an `awk -v` assignment cannot carry a
  # raw newline — BWK awk, which macOS ships, rejects it outright with
  # `newline in string` and leaves the variable empty, so every hit silently
  # vanishes. No path can contain a space, per ticket_paths_from_text's regex.
  printf '%s' "$index" | awk -F'\t' \
      -v mine="$(printf '%s' "$mine" | tr '\n' ' ')" -v corpus="$corpus" \
      -v pct="${IPO_UBIQUITY_PCT:-15}" -v floor="${IPO_UBIQUITY_MIN:-5}" '
    BEGIN {
      n = split(mine, m, " ")
      for (i = 1; i <= n; i++) if (m[i] != "") want[m[i]] = 1
    }
    { df[$3]++; rows[NR] = $0 }
    END {
      cut = corpus * pct / 100
      if (cut < floor) cut = floor

      # Only paths that actually hit something can be suppressed — a path no open
      # issue names is neither ubiquitous nor useful, and counting it would make
      # the fallback below fire on a set that was never going to report anyway.
      nspec = 0; nhit = 0
      for (p in want) if (p in df) {
        hitting[p] = 1; nhit++
        if (df[p] <= cut) { keys[p] = 1; nspec++ }
      }
      if (nhit == 0) exit 0
      if (nspec == 0) for (p in hitting) keys[p] = 1

      for (i = 1; i <= NR; i++) {
        split(rows[i], f, "\t")
        if (!(f[3] in keys)) continue
        if (!(f[1] in cnt)) { tit[f[1]] = f[2]; ord[++ni] = f[1] }
        cnt[f[1]]++
        plist[f[1]] = plist[f[1]] (cnt[f[1]] > 1 ? " " : "") f[3]
        if (cnt[f[1]] == 1 || df[f[3]] < mind[f[1]]) mind[f[1]] = df[f[3]]
      }

      for (j = 1; j <= ni; j++) {
        num = ord[j]
        # Insertion sort — the list is one row of shared paths, single digits in
        # practice. No path can contain a space: the extraction regex in
        # ticket_paths_from_text cannot emit one.
        k = split(plist[num], pp, " ")
        for (a = 2; a <= k; a++) {
          v = pp[a]; b = a - 1
          while (b >= 1 && df[pp[b]] > df[v]) { pp[b + 1] = pp[b]; b-- }
          pp[b + 1] = v
        }
        csv = pp[1]
        for (a = 2; a <= k; a++) csv = csv "," pp[a]
        printf "%d\t%d\t%s\t%s\t%s\n", mind[num], -cnt[num], num, tit[num], csv
      }
    }
  ' | sort -t"$(printf '\t')" -k1,1n -k2,2n -k3,3n | cut -f3-

  # Explicit, for the same reason `_ipo_identical_paths` carries one: the status
  # of the pipeline above is the last thing it evaluated, and a `cut` that emits
  # nothing would otherwise return into a caller running `set -e`.
  return 0
}

# Which of MINE are literally the SAME FILE in another checkout, by blob hash.
#
#   args:   1 = my paths, 2 = path to the other repo's checkout
#   stdout: the subset of MINE whose blob at that repo's HEAD is byte-identical
#
# This is the whole defence for the cross-repo half, and it is worth stating why
# a cheaper one does not work. A path string is not a file: `scripts/new-task.sh`
# exists in SIX Brik checkouts as six different programs. Measured on 2026-08-29
# against 839 open issues org-wide, with a three-path set for a session editing
# the overlap libs:
#
#   predicate                       cross-repo hits   genuine
#   ─────────────────────────────────────────────────────────
#   path string matches                     9              2
#   blob hash matches                       2              2
#
# The seven it drops are all `scripts/new-task.sh` — five distinct blobs, plus
# two in a retired repo. The two it keeps are `scripts/lib/issue-overlap.sh` in
# tncld#125 and brik-client-portal#3368, which is a watched identical twin and
# therefore genuinely the file being edited here.
#
# Blob identity rather than the TWINS registry in overlap-twin-drift.py: the
# registry is the right source for what SHOULD be in sync, and this needs what IS.
# An ungated twin (`pr-path-overlap.sh` carries three distinct blobs across four
# repos, verified 2026-08-29) is correctly dropped by identity and would be
# wrongly reported by a registry lookup.
#
# Local and free — no API call, no network. It runs BEFORE any `gh` call so a
# foreign repo is only ever queried when it demonstrably shares a file.
_ipo_identical_paths() {
  local mine="${1:-}" other="${2:-}" p mine_blob their_blob
  [ -n "$mine" ] && [ -n "$other" ] || return 0
  [ -d "$other/.git" ] || return 0
  while IFS= read -r p || [ -n "$p" ]; do
    [ -n "$p" ] || continue
    mine_blob="$(git rev-parse "HEAD:$p" 2>/dev/null)" || continue
    their_blob="$(git -C "$other" rev-parse "HEAD:$p" 2>/dev/null)" || continue
    # `if`, not `[ … ] && printf`. As the LAST statement in a loop body the `&&`
    # form makes the whole loop — and therefore this function — return the test's
    # status, so one non-matching path at the end of the list returns 1 and
    # `set -e` in new-task.sh kills the gate mid-output. Observed live on #2314:
    # `issue-overlap.sh` matched, `pr-path-overlap.sh` did not, and the run
    # printed nothing at all. #2423.
    if [ "$mine_blob" = "$their_blob" ]; then printf '%s\n' "$p"; fi
  done <<<"$mine"
  return 0
}

# ── Registry reads (local files, no network) ───────────────────────

_ipo_repo_root() {
  cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd
}

# `owner/name` per line, from operations/retired-repos.txt.
#
# renew-pms and freedom-client-portal are dead and unsupported permanently. Three
# of the nine cross-repo hits measured above were renew-pms issues; reporting a
# retired repo as a live collision is worse than useless, because the only
# possible action on it is forbidden.
_ipo_retired_names() {
  local list; list="$(_ipo_repo_root)/operations/retired-repos.txt"
  [ -f "$list" ] || return 0
  sed 's/#.*//' "$list" | tr -d '[:blank:]' | awk 'NF { n = split($0, s, "/"); print s[n] }'
}

# Local checkout paths of every non-retired sibling repo, from the shared
# registry scripts/lib/repo-registry.tsv — the same single source of truth
# repo-state.sh and markdown-census.py read, never a second list.
#
#   stdout: absolute-checkout-path<TAB>repo-name
_ipo_fleet_checkouts() {
  local root tsv gh_root retired path name
  root="$(_ipo_repo_root)"
  tsv="$root/scripts/lib/repo-registry.tsv"
  # The registry is canon in brik-llm and is NOT mirrored into the consumer repos
  # (verified 2026-08-29: neither brik-bds nor brik-client-portal carries
  # scripts/lib/repo-registry.tsv). This file is an identical twin, so it ships
  # there with a cross-repo half that cannot run — and a half that goes quiet is
  # indistinguishable from a half that found nothing, which is the failure this
  # whole family keeps paying for. Say so once, on stderr, and carry on: the
  # local half is the primary signal and works everywhere.
  if [ ! -f "$tsv" ]; then
    echo -e "${_IPO_YELLOW}⚠  No scripts/lib/repo-registry.tsv here — the cross-repo half of the${_IPO_NC}" >&2
    echo -e "${_IPO_YELLOW}   open-issue path check is SKIPPED, not passed. The local half still ran.${_IPO_NC}" >&2
    return 0
  fi
  # The registry is keyed by `<group>/<name>` relative to the GitHub root, so the
  # root has to be derived from the PRIMARY checkout — not from this one.
  # Every Brik session runs in a worktree (`brik-llm-worktrees/<slug>/`), one
  # level deeper than the primary, so `$root/../..` resolves to `…/Github/brik`
  # and every registry lookup misses. That is not a degraded cross-repo half, it
  # is a dead one, everywhere the gate actually runs.
  #
  # `--git-common-dir` is the same value in a worktree and in the primary — it
  # points at the primary's `.git` in both — so this needs no worktree special
  # case. BRIK_GITHUB_ROOT is the test seam.
  if [ -n "${BRIK_GITHUB_ROOT:-}" ]; then
    gh_root="$BRIK_GITHUB_ROOT"
  else
    local common
    common="$(git rev-parse --path-format=absolute --git-common-dir 2>/dev/null)" || return 0
    [ -n "$common" ] || return 0
    gh_root="$(cd "$(dirname "$common")/../.." && pwd)" || return 0
  fi
  retired="$(_ipo_retired_names)"
  while IFS=$'\t' read -r path _ _; do
    [ -n "$path" ] || continue
    case "$path" in \#*) continue ;; esac
    name="${path##*/}"
    [ "$name" = "brik-llm" ] && continue
    printf '%s\n' "$retired" | grep -qxF "$name" && continue
    [ -d "$gh_root/$path/.git" ] || continue
    printf '%s\t%s\n' "$gh_root/$path" "$name"
  done < "$tsv"
  return 0
}

# ── Network-touching orchestration ─────────────────────────────────

# ONE `gh` call per repo, cached for the life of the shell. The fleet shares a
# single hourly bucket (rag:github-api-quota-is-shared-across-the-fleet) and this
# runs on every new-task.sh.
#
# Body included, flattened to one line per issue: AC1 is title OR body, and the
# #9 case that motivated this named the file in the body only. `--limit 200`
# bounds it; brik-llm carries 248 open issues, so this is an under-report by
# design and an under-report is the safe direction for a warning.
_IPO_ROWS_CACHE=""

_ipo_open_issue_rows() {
  local nwo="$1" hit rows
  hit="$(printf '%s' "$_IPO_ROWS_CACHE" | grep -m1 -F "◆${nwo}◆" 2>/dev/null)" || hit=""
  if [ -n "$hit" ]; then
    printf '%s' "${hit#*◆"${nwo}"◆}" | tr '\v' '\n'
    return 0
  fi
  rows="$(gh issue list --repo "$nwo" --state open --limit 200 \
            --json number,title,body \
            --jq '.[] | [.number, .title, ((.title + " " + (.body // "")) | gsub("[\\s]+"; " "))] | @tsv' \
            2>/dev/null)" || rows=""
  _IPO_ROWS_CACHE="${_IPO_ROWS_CACHE}
◆${nwo}◆$(printf '%s' "$rows" | tr '\n' '\v')"
  printf '%s' "$rows"
}

_ipo_tracked_files() {
  git ls-files 2>/dev/null
}

_ipo_tracked_files_in() {
  git -C "$1" ls-files 2>/dev/null
}

# check_issue_path_overlap <issue-ref>
#
# Task-start entry point, wired in new-task.sh beside check_ticket_path_overlap.
# Paths come from the TICKET — the same source #2313 uses, for the same reason:
# there is no diff yet, and asking at PR-create is a collision REPORT rather than
# a gate.
#
# Always returns 0.
check_issue_path_overlap() {
  local ref="${1:-}"
  [ -n "$ref" ] || return 0

  if ! command -v gh >/dev/null 2>&1; then
    echo -e "${_IPO_YELLOW}⚠  gh not on PATH — skipping the open-issue path check.${_IPO_NC}" >&2
    return 0
  fi

  local api_path num nwo
  api_path="$(_pto_issue_api_path "$ref")" || return 0
  num="${api_path##*/}"
  # `{owner}/{repo}` when the ref carried no slug — gh expands it, this needs a
  # literal for `gh issue list --repo`, so resolve it the way the sibling lib does.
  case "$api_path" in
    repos/\{owner\}/\{repo\}/*) nwo="$(_io_repo_slug 2>/dev/null)" || nwo="" ;;
    *) nwo="$(printf '%s' "$api_path" | awk -F/ '{ print $2 "/" $3 }')" ;;
  esac
  [ -n "$nwo" ] || return 0

  local mine tracked
  tracked="$(${IPO_TRACKED_CMD:-_ipo_tracked_files})"
  mine="$(ticket_paths_from_text \
            "$(${PTO_TEXT_CMD:-_pto_issue_text} "$api_path")" \
            "$tracked")"

  if [ -z "$mine" ]; then
    # Says SKIPPED, never all-clear: silence here is indistinguishable from a
    # clean read, and #2313 pays for the same distinction one gate over.
    echo -e "  ${_IPO_YELLOW}No repo paths named in #${num} — open-issue path check skipped, not passed.${_IPO_NC}"
    return 0
  fi

  local hits
  hits="$(${IPO_ROWS_CMD:-_ipo_open_issue_rows} "$nwo" \
          | issues_naming_paths "$mine" "$num" "$tracked" || true)"

  # ── the cross-repo half ──
  # Only repos that demonstrably share one of these files, and the sharing test
  # is local. A session editing nothing twinned spends ZERO extra API calls here,
  # which is the common case; a session editing the overlap lib — the single
  # highest-collision file in the fleet — spends one call per repo that carries
  # a byte-identical copy, and that is the trade this gate is worth.
  local foreign_hits="" checkout name shared_paths frows
  while IFS=$'\t' read -r checkout name || [ -n "$checkout" ]; do
    [ -n "$checkout" ] || continue
    shared_paths="$(_ipo_identical_paths "$mine" "$checkout")"
    [ -n "$shared_paths" ] || continue
    frows="$(${IPO_ROWS_CMD:-_ipo_open_issue_rows} "brikdesigns/${name}" \
             | issues_naming_paths "$shared_paths" "" \
                 "$(${IPO_TRACKED_IN_CMD:-_ipo_tracked_files_in} "$checkout")" || true)"
    [ -n "$frows" ] || continue
    foreign_hits="${foreign_hits}$(printf '%s\n' "$frows" | sed "s|^|${name}\t|")
"
  done < <(${IPO_FLEET_CMD:-_ipo_fleet_checkouts})
  foreign_hits="$(printf '%s' "$foreign_hits" | awk 'NF' || true)"

  if [ -z "$hits" ] && [ -z "$foreign_hits" ]; then
    echo -e "  ${_IPO_GREEN}No open issue names a path #${num} touches.${_IPO_NC}"
    return 0
  fi

  # Bounded display, with the remainder COUNTED rather than dropped. A ticket
  # about the overlap libs themselves names them in prose and legitimately hits
  # 11 open issues (measured on #2314, 2026-08-29) — all true positives, and a
  # 22-line wall is still a wall. Silent truncation is the thing forbidden here,
  # not truncation: an unread warning and an unmentioned remainder fail the same
  # way. IPO_MAX_HITS=0 prints everything.
  local max="${IPO_MAX_HITS:-8}" total shown block=""
  if [ -n "$hits" ]; then
    block="$(printf '%s\n' "$hits" | awk -F'\t' \
      '{ printf "    #%s — %s\n        %s\n", $1, $2, $3 }' || true)"
  fi
  if [ -n "$foreign_hits" ]; then
    block="${block}${block:+$'\n'}$(printf '%s\n' "$foreign_hits" | awk -F'\t' \
      '{ printf "    %s#%s — %s\n        %s (byte-identical here)\n", $1, $2, $3, $4 }' || true)"
  fi
  total="$(printf '%s\n%s\n' "$hits" "$foreign_hits" | awk 'NF' | wc -l | tr -d ' ' || true)"

  echo ""
  echo -e "${_IPO_YELLOW}⚠  Open issue(s) naming a file this ticket touches:${_IPO_NC}"
  # awk does its own limiting rather than `| head`: under `set -o pipefail` head
  # closing the pipe kills the producer with SIGPIPE (rc 141) and takes
  # new-task.sh down with it — the #2423 class, and the exact break this file's
  # strict-mode test case exists to catch. It caught this one.
  printf '%s\n' "$block" | awk -v n="$((max * 2))" 'NF { if (n > 0 && ++c > n) exit; print }'

  shown="$max"
  [ "$max" -eq 0 ] && shown="$total"
  if [ "$total" -gt "$shown" ]; then
    echo -e "${_IPO_YELLOW}    … and $((total - shown)) more — IPO_MAX_HITS=0 to list them all.${_IPO_NC}"
  fi
  echo ""
  echo -e "${_IPO_YELLOW}   These are OPEN ISSUES, not branches or PRs — no other gate reads${_IPO_NC}"
  echo -e "${_IPO_YELLOW}   the backlog, so a known defect in a file you are about to rewrite${_IPO_NC}"
  echo -e "${_IPO_YELLOW}   is invisible to all of them. Read them before you start: the fix${_IPO_NC}"
  echo -e "${_IPO_YELLOW}   may be yours to fold in, or the diagnosis may be about to move${_IPO_NC}"
  echo -e "${_IPO_YELLOW}   underneath its author. brik-llm#2314.${_IPO_NC}"
  echo ""

  if [ -t 0 ]; then
    echo -e "${_IPO_YELLOW}   Press Enter to continue, Ctrl+C to abort.${_IPO_NC}"
    read -r || true
  else
    echo -e "${_IPO_YELLOW}   → non-interactive: continuing.${_IPO_NC}"
  fi
  return 0
}
