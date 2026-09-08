#!/usr/bin/env bash
# Contract gate for the intended-visual declaration helpers
# (lib/visual-change-routes.sh), brikdesigns#1282.
#
# The failure this reproduces: pr-task.sh emitted no `Visual-change:` body line,
# so every intentional-visual PR failed the `regression` gate on first run
# (#1279 — `home` moved 10.64%, gate red until the line was hand-added).
#
# The load-bearing assertions are the ones that fail SILENTLY:
#
#   1. known_visual_routes extracts from the ROUTES array ONLY. If the awk range
#      guard breaks, the VIEWPORTS names (desktop/tablet/mobile) leak in as
#      routes — then `--visual-change desktop` would pass validation and waive
#      NOTHING at CI, the exact silent re-red the gate exists to prevent.
#   2. An unknown route name fails LOUD (rc 1), not silently. A typo'd route in
#      the declaration waives nothing (the gate's knownRoutes filter drops it),
#      so it must be caught at author time, not rediscovered at CI.
#   3. The emitted line matches the format lib/visual-change-declaration.mjs
#      parses: `Visual-change: r1, r2`, de-duped.
#
# No network, no git, no gh — drives the pure helpers against a fixture.
# Run: bash scripts/__tests__/test-pr-visual-change.sh

set -u
unset GIT_DIR GIT_WORK_TREE GIT_INDEX_FILE GIT_COMMON_DIR GIT_NAMESPACE \
      GIT_OBJECT_DIRECTORY GIT_ALTERNATE_OBJECT_DIRECTORIES

SCRIPTS_DIR="$(cd "$(dirname "$0")/.." && pwd)"
LIB="${SCRIPTS_DIR}/lib/visual-change-routes.sh"
[ -f "$LIB" ] || { echo "lib not found at $LIB"; exit 1; }
# shellcheck source=/dev/null
source "$LIB"

# Fixture mirrors visual-parity.mjs's shape: a ROUTES array (incl. a multi-line
# entry, as the events route is) followed by a VIEWPORTS array whose names must
# NOT be read as routes.
FIXTURE="$(mktemp)"
trap 'rm -f "$FIXTURE"' EXIT
cat > "$FIXTURE" <<'JS'
const ROUTES = [
  { netlify: '/', webflow: '/', name: 'home' },
  { netlify: '/about', webflow: '/about', name: 'about' },
  {
    netlify: '/events/grind-after-graduation',
    name: 'events-grind-after-graduation',
  },
];
const VIEWPORTS = [
  { name: 'desktop', width: 1280, height: 800 },
  { name: 'tablet',  width: 768,  height: 1024 },
];
JS
export VISUAL_PARITY_FILE="$FIXTURE"

PASS=0; FAIL=0; FAILED_CASES=()

assert_eq() {
  local desc="$1" expected="$2" actual="$3"
  if [ "$expected" = "$actual" ]; then PASS=$((PASS+1)); else
    FAIL=$((FAIL+1)); FAILED_CASES+=("$desc"$'\n'"    expected: [$expected]"$'\n'"    actual:   [$actual]")
  fi
}
assert_rc() {
  local desc="$1" expected="$2" actual="$3"
  if [ "$expected" -eq "$actual" ]; then PASS=$((PASS+1)); else
    FAIL=$((FAIL+1)); FAILED_CASES+=("$desc — expected rc $expected, got $actual")
  fi
}

# 1. Route extraction is ROUTES-only — viewport names must not leak.
GOT_ROUTES="$(known_visual_routes | paste -sd, -)"
assert_eq "known_visual_routes lists routes only, no viewports" \
  "home,about,events-grind-after-graduation" "$GOT_ROUTES"

# 2. Empty / whitespace-only → nothing declared, rc 0, no output.
OUT="$(visual_change_line "" )"; assert_rc "empty CSV rc" 0 $?
assert_eq "empty CSV emits nothing" "" "$OUT"
OUT="$(visual_change_line "  ,  , " )"; assert_rc "whitespace/comma-only rc" 0 $?
assert_eq "whitespace/comma-only emits nothing" "" "$OUT"

# 3. Single + multi (sorted, de-duped) + whitespace-tolerant.
OUT="$(visual_change_line "home")"; assert_eq "single route line" "Visual-change: home" "$OUT"
OUT="$(visual_change_line "home, about")"; assert_eq "two routes sorted" "Visual-change: about, home" "$OUT"
OUT="$(visual_change_line "  home , about ")"; assert_eq "whitespace trimmed" "Visual-change: about, home" "$OUT"
OUT="$(visual_change_line "home,home")"; assert_eq "duplicate de-duped" "Visual-change: home" "$OUT"

# 4. Unknown name fails LOUD (rc 1) and names the offender on stderr.
ERR="$(visual_change_line "home,bogus" 2>&1 >/dev/null)"; RC=$?
assert_rc "unknown route rc" 1 "$RC"
case "$ERR" in *bogus*) PASS=$((PASS+1));; *) FAIL=$((FAIL+1)); FAILED_CASES+=("unknown route names offender on stderr — got [$ERR]");; esac

# 5. A VIEWPORT name is NOT a valid route (the leak guard, end-to-end).
visual_change_line "desktop" >/dev/null 2>&1; assert_rc "viewport name rejected as route" 1 $?

echo ""
echo "  visual-change-routes: ${PASS} passed, ${FAIL} failed"
if [ "$FAIL" -gt 0 ]; then
  printf '\n  ✗ %s\n' "${FAILED_CASES[@]}"
  exit 1
fi
