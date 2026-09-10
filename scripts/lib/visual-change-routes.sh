#!/usr/bin/env bash
# visual-change-routes.sh — pure helpers behind pr-task.sh's intended-visual
# declaration (brikdesigns#1282). Tested by scripts/__tests__/test-pr-visual-change.sh.
#
# The `regression` CI gate reds any captured route that moves >1% vs staging
# unless the PR body carries a `Visual-change: <route>` line naming routes from
# visual-parity.mjs ROUTES[].name (parsed by lib/visual-change-declaration.mjs).
# pr-task.sh used to emit neither the line nor the `visual-change` label, so
# every intentional-visual PR failed the gate on first run (#1279). These two
# pure functions let it declare correctly at author time.
#
# No side effects, no network — just file read + string work — so the test can
# exercise them against a fixture with VISUAL_PARITY_FILE.

# Print the visual-parity ROUTES[].name list, one per line — the SoT the gate
# validates a declaration against. Extracted from the ROUTES array ONLY (awk
# stops at its closing `];`), so the VIEWPORTS names (desktop/tablet/mobile)
# declared below it can never leak in as spurious route names.
#
# File resolves from VISUAL_PARITY_FILE (test override), else the scripts/
# sibling of this lib.
known_visual_routes() {
  local file="${VISUAL_PARITY_FILE:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/visual-parity.mjs}"
  awk '/const ROUTES = \[/{f=1} f{print} f&&/^\];/{exit}' "$file" \
    | grep -oE "name: *'[^']+'" | sed "s/name: *'//; s/'//"
}

# Validate a comma-separated route CSV and echo the exact `Visual-change: r1, r2`
# body line the gate parses. Behaviour:
#   - empty / whitespace-only CSV → no output, return 0 (nothing declared)
#   - exactly `none`              → no output, return 0 (declared: nothing moves)
#   - all names known             → echo the line, return 0
#   - any unknown name            → list the unknowns on stderr, return 1
# De-dupes and sorts; a bad name fails here rather than silently waiving nothing
# at CI (the gate's knownRoutes filter would drop it).
#
# `none` is the EXPLICIT no-move declaration (#1344). pr-task.sh refuses a
# non-interactive run that touches a renderable path with nothing declared, so
# "I checked, nothing moves" has to be sayable — empty already means "never
# asked". It emits no body line and no label, exactly like empty: the sentinel
# is for the caller's refusal check, not for the gate, which only ever sees the
# absence. `none` is not a ROUTES[].name (asserted in
# scripts/__tests__/test-pr-visual-change.sh), so it cannot shadow a route.
#
# Mixing it with a real route (`none,home`) is a contradiction, not a waiver —
# it falls through to the unknown-name branch and fails loud.
visual_change_line() {
  local csv="${1:-}" known declared unknown
  [ -n "$(printf '%s' "$csv" | tr -d '[:space:],')" ] || return 0
  [ "$(printf '%s' "$csv" | tr -d '[:space:]')" = "none" ] && return 0
  known=$(known_visual_routes | sort -u)
  declared=$(printf '%s' "$csv" | tr ',' '\n' \
    | sed 's/^[[:space:]]*//; s/[[:space:]]*$//' | grep -v '^$' | sort -u)
  unknown=$(comm -23 <(printf '%s\n' "$declared") <(printf '%s\n' "$known"))
  if [ -n "$unknown" ]; then
    printf '%s\n' "$unknown" >&2
    return 1
  fi
  printf 'Visual-change: %s\n' "$(printf '%s' "$declared" | paste -sd, - | sed 's/,/, /g')"
}

# Filter a changed-file list down to the paths that can move a captured route,
# i.e. the ones that should raise the declaration prompt (brikdesigns#1256).
#
# Reads paths on stdin, prints the matches. Empty output = nothing renderable
# changed, so the prompt stays silent.
#
# The set is the RENDERING half of visual-regression.yml's own `paths:` filter —
# if the gate would run, the author should be offered the declaration. #1282
# keyed the prompt on the UI-verification file list (`.tsx|.jsx|.css|.scss`),
# which misses `public/`: swapping a hero image moves the route by every pixel
# it covers and never prompted, so an image-only PR still ate the first-run red
# that #1282 existed to remove.
#
# Deliberately narrower than the workflow's filter: `next.config.*` and
# `package*.json` are in there because a dep bump CAN repaint, but that is the
# undeclarable case — the author does not know which routes move until the run
# says so, and prompting there would train a guess. Test/story files are
# excluded for the same reason #1282 excluded them: they do not render.
visual_declaration_paths() {
  grep -E '\.(tsx|jsx|css|scss)$|^public/' \
    | grep -vE '(\.test\.|\.spec\.|\.stories\.|/__tests__/|^stories/|\.d\.ts$)' \
    || true
}
