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

# 6. The prompt trigger (#1256). The load-bearing case is `public/`: #1282 keyed
# the prompt on the UI-verification file list, so an image-only PR never got
# asked and ate the first-run red anyway. The negative cases matter just as
# much — a prompt that fires on a test file trains a reflexive blank answer.
paths() { printf '%s\n' "$@" | visual_declaration_paths | paste -sd, -; }

assert_eq "an image under public/ triggers the prompt" \
  "public/images/hero.webp" "$(paths public/images/hero.webp)"
assert_eq "a component triggers the prompt" \
  "src/app/page.tsx" "$(paths src/app/page.tsx)"
assert_eq "a stylesheet triggers the prompt" \
  "src/app/globals.css" "$(paths src/app/globals.css)"
assert_eq "test / story / type files do not trigger it" \
  "" "$(paths src/x.test.tsx src/y.stories.tsx src/z.d.ts src/__tests__/a.tsx)"
assert_eq "a CI or script-only diff does not trigger it" \
  "" "$(paths .github/workflows/visual-regression.yml scripts/visual-parity.mjs README.md)"
assert_eq "a mixed diff yields only the renderable paths" \
  "src/app/page.tsx,public/logo.svg" \
  "$(paths scripts/pr-task.sh src/app/page.tsx public/logo.svg src/app/page.test.tsx)"
printf '' | visual_declaration_paths >/dev/null; assert_rc "empty stdin is rc 0, not a grep miss" 0 $?

# 7. The `none` sentinel (#1344). pr-task.sh refuses a non-interactive run that
# touches a renderable path with nothing declared, so "I checked, nothing moves"
# has to be SAYABLE — empty already means "never asked". `none` emits no line
# and no label (identical to empty, from the gate's side); it exists purely so
# the caller can tell the two apart.
OUT="$(visual_change_line "none")"; assert_rc "none rc" 0 $?
assert_eq "none emits nothing" "" "$OUT"
OUT="$(visual_change_line "  none  ")"; assert_eq "none is whitespace-tolerant" "" "$OUT"

# The sentinel must not shadow a real route, or declaring that route would
# silently waive nothing. Asserted against the LIVE route list, not the fixture.
LIVE_HAS_NONE="$(VISUAL_PARITY_FILE="${SCRIPTS_DIR}/visual-parity.mjs" known_visual_routes | grep -cx none || true)"
assert_eq "'none' is not a real ROUTES[].name" "0" "$LIVE_HAS_NONE"

# Mixing the sentinel with a route is a contradiction, not a waiver — it must
# fail loud rather than resolve to one or the other.
visual_change_line "none,home" >/dev/null 2>&1; assert_rc "none mixed with a route rejected" 1 $?

# 8. The refusal itself, DRIVEN (#1344). Both holes this closes were invisible
# to a grep: `[ -t 0 ]` made the block unreachable for every agent run, and
# nesting it under SKIP_UI_CHECK let the browser gate's escape waive it too. So
# assert on the OBSERVABLE behaviour of the real script.
#
# Hermetic: throwaway repo, bare local remote, fake `gh` on PATH. The refusal
# fires before any gh call, so the fake is defensive only.
drive_pr_task() {
  # $1 = SKIP_UI_CHECK value ('' or '1'); rest = extra pr-task.sh flags.
  # Echoes the combined output; returns pr-task.sh's real exit code.
  local skip="$1"; shift
  local t; t="$(mktemp -d)"
  mkdir -p "$t/fakebin"
  printf '#!/bin/sh\nexit 0\n' > "$t/fakebin/gh"; chmod +x "$t/fakebin/gh"
  git init --bare -q "$t/remote.git"
  git init -q "$t/repo"
  (
    cd "$t/repo" || exit 1
    git config user.email t@t.t; git config user.name T; git config commit.gpgsign false
    mkdir -p src/app scripts/lib
    cp "${SCRIPTS_DIR}/pr-task.sh" scripts/
    cp -R "${SCRIPTS_DIR}/lib/." scripts/lib/
    cp "${SCRIPTS_DIR}/visual-parity.mjs" scripts/
    echo x > README.md
    git add -A && git commit -qm init
    git remote add origin "$t/remote.git"
    git push -q origin HEAD:staging
    git switch -qc task/probe-visual
    printf '.a{color:red}\n' > src/app/probe.css
    # Conventional-commit shaped on purpose: pr-task.sh derives the PR title from
    # the first commit subject and refuses non-interactively without one. A
    # non-conforming subject would stop the run at THAT gate, and the driven
    # cases below would pass for the wrong reason — the pre-fix script reaches
    # the title gate precisely because it skipped the declaration.
    git add -A && git commit -qm "fix(probe): move a captured route (#1)"
    # VISUAL_PARITY_FILE is exported by this suite for the fixture; unset it so
    # the driven copy reads its own scripts/visual-parity.mjs.
    unset VISUAL_PARITY_FILE
    PATH="$t/fakebin:$PATH" SKIP_UI_CHECK="$skip" bash scripts/pr-task.sh "$@" < /dev/null 2>&1
  )
  local rc=$?
  rm -rf "$t"
  return $rc
}

# Every driven case sets SKIP_UI_CHECK=1 on purpose. It is the AGENT path — with
# it unset the browser gate's own `read` hits EOF first and refuses there, so the
# declaration block is unobservable. It is also the exact configuration both
# holes lived in: pre-fix, SKIP_UI_CHECK=1 skipped the whole block (hole 2), and
# `[ -t 0 ]` would have skipped it on a closed stdin anyway (hole 1). One case
# regresses both locks.

# 8a. Agent path + renderable diff + nothing declared → refuse, and say why.
DRIVEN="$(drive_pr_task 1)"; RC=$?
assert_rc "SKIP_UI_CHECK=1 + no declaration refuses" 1 "$RC"
case "$DRIVEN" in
  *"no intended-visual declaration"*) PASS=$((PASS+1));;
  *) FAIL=$((FAIL+1)); FAILED_CASES+=("refusal names the reason — got [$DRIVEN]");;
esac
# The refusal is only actionable if it prints both escapes and the route list.
case "$DRIVEN" in
  *"--visual-change none"*) PASS=$((PASS+1));;
  *) FAIL=$((FAIL+1)); FAILED_CASES+=("refusal does not offer --visual-change none");;
esac
case "$DRIVEN" in
  *"events-grind-after-graduation"*) PASS=$((PASS+1));;
  *) FAIL=$((FAIL+1)); FAILED_CASES+=("refusal does not list the valid route names");;
esac

# 8b. An explicit `--visual-change none` clears the refusal. Without the
# sentinel the fix would block every legitimate no-move PR.
DRIVEN="$(drive_pr_task 1 --visual-change none)"; RC=$?
case "$DRIVEN" in
  *"no intended-visual declaration"*)
    FAIL=$((FAIL+1)); FAILED_CASES+=("--visual-change none hit the refusal branch — got [$DRIVEN]");;
  *) PASS=$((PASS+1));;
esac

# 8c. A real route also clears it, and reaches the body as the parsed line.
DRIVEN="$(drive_pr_task 1 --visual-change home)"; RC=$?
case "$DRIVEN" in
  *"no intended-visual declaration"*)
    FAIL=$((FAIL+1)); FAILED_CASES+=("--visual-change home hit the refusal branch — got [$DRIVEN]");;
  *) PASS=$((PASS+1));;
esac

echo ""
echo "  visual-change-routes: ${PASS} passed, ${FAIL} failed"
if [ "$FAIL" -gt 0 ]; then
  printf '\n  ✗ %s\n' "${FAILED_CASES[@]}"
  exit 1
fi
