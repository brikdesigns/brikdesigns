#!/usr/bin/env bash
# Contract gate for dev-restart.sh's process cleanup (#1368).
#
# The bug: `next dev` under Next 16 hands the port to a child whose process
# title has been rewritten to `next-server (vX.Y.Z)`. Measured on brik-mini
# 2026-09-10, port 3096 — the port owner's cmdline contained neither key that
# dev-restart.sh's sweep greps for:
#
#   $ ps -o command= -p <port owner>   →  next-server (v16.2.11)
#     grep -c node          →  0
#     grep -c $PROJECT_DIR  →  0
#
# So `ps aux | grep node | grep $PROJECT_DIR` returned only the `op run` / `npx`
# wrappers, and killing exactly that set left the port owner alive and LISTENing.
# In the window before it binds, `lsof` cannot see it either — which is how a
# port every check called free produced `EADDRINUSE :::$PORT` on the next run.
#
# The load-bearing assertion is therefore NOT "cleanup ran". It is the negative
# control in T3: killing the CMDLINE-MATCHED set alone must leave the retitled
# grandchild alive. Without T3 this file would pass against the bug it exists to
# catch, because kill_tree and the old sweep agree on every process the sweep
# can actually see.
#
# kill_tree is EXTRACTED from the shipped script rather than copied, so the test
# cannot drift into asserting against its own stale duplicate.
#
# No network, no repo writes: every PID under test is one this file spawned, and
# nothing is killed by pattern.
#
# Run: bash scripts/__tests__/test-dev-restart-kill-tree.sh

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TARGET="${DEV_RESTART_PATH:-${SCRIPT_DIR}/dev-restart.sh}"

RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m'
FAILED=0

pass() { printf '%b\n' "  ${GREEN}✓${NC} $1"; }
fail() { printf '%b\n' "  ${RED}✗${NC} $1"; FAILED=1; }

echo "▸ dev-restart.sh kill_tree contract (#1368)"
echo "  target: $TARGET"

if [ ! -r "$TARGET" ]; then
  fail "dev-restart.sh not readable at $TARGET"
  exit 1
fi

# ── Extract kill_tree from the shipped script ──
KT_SRC=$(sed -n '/^kill_tree() {/,/^}/p' "$TARGET")
if [ -z "$KT_SRC" ]; then
  fail "kill_tree() not found in $TARGET — the #1368 fix is missing or was renamed"
  exit 1
fi
eval "$KT_SRC"
if ! declare -F kill_tree >/dev/null; then
  fail "kill_tree() extracted but did not define a function"
  exit 1
fi
pass "kill_tree() extracted from the shipped script"

# ── Fixture: parent → grandchild, grandchild retitled so it matches neither
#    key the old sweep greps for. `exec -a` is how we stand in for Next's own
#    process-title rewrite without needing Next in CI.
DECOY="next-server-1368-fixture"
PARENT_TAG="node-devrestart-1368-fixture"

# `exec -a` replaces the shell that ran it, so the decoy sits at whatever depth
# the exec happened — search descendants recursively rather than assuming one.
find_decoy() {
  local pid="$1" child
  for child in $(pgrep -P "$pid" 2>/dev/null || true); do
    if ps -o command= -p "$child" 2>/dev/null | grep -q "$DECOY"; then
      echo "$child"
      return 0
    fi
    local deeper
    deeper=$(find_decoy "$child") && { echo "$deeper"; return 0; }
  done
  return 1
}

spawn_fixture() {
  bash -c "exec -a $PARENT_TAG bash -c 'bash -c \"exec -a $DECOY sleep 300\" & wait'" &
  FIX_PARENT=$!
  # Detach so bash does not print "Killed: 9" job-control noise when we reap it.
  disown "$FIX_PARENT" 2>/dev/null || true
  local tries=0
  FIX_LEAF=""
  while [ "$tries" -lt 50 ]; do
    if FIX_LEAF=$(find_decoy "$FIX_PARENT"); then
      [ -n "$FIX_LEAF" ] && return 0
    fi
    tries=$((tries + 1))
    sleep 0.1
  done
  return 1
}

alive() { ps -p "$1" -o pid= >/dev/null 2>&1; }

# ── T1: the retitled leaf carries neither grep key ──
if ! spawn_fixture; then
  fail "could not spawn the fixture tree"
  exit 1
fi
LEAF_CMD=$(ps -o command= -p "$FIX_LEAF" 2>/dev/null || true)
if [ -z "$LEAF_CMD" ]; then
  fail "T1: fixture leaf $FIX_LEAF has no readable cmdline"
elif echo "$LEAF_CMD" | grep -q "node"; then
  fail "T1: fixture leaf matches 'node' — it does not model the retitled next-server"
else
  pass "T1: retitled leaf ($FIX_LEAF) does not match the sweep's 'node' key"
fi

# ── T2: kill_tree reaps the retitled leaf via the parent ──
kill_tree "$FIX_PARENT"
sleep 0.6
if alive "$FIX_LEAF"; then
  fail "T2: kill_tree left the retitled leaf $FIX_LEAF alive"
  kill -9 "$FIX_LEAF" 2>/dev/null || true
else
  pass "T2: kill_tree reaped the retitled leaf through its parent"
fi

# ── T3: NEGATIVE CONTROL — the cmdline-matched set alone does not reach it.
#    This is the assertion that fails against the pre-#1368 script. If it ever
#    starts passing for the wrong reason, T2 above proves nothing.
if ! spawn_fixture; then
  fail "T3: could not respawn the fixture tree"
else
  # The old sweep, verbatim in shape: match on cmdline, kill only those PIDs.
  SWEEP_PIDS=$(ps aux | grep "node" | grep "$PARENT_TAG" | grep -v grep | awk '{print $2}' || true)
  if echo "$SWEEP_PIDS" | tr ' ' '\n' | grep -qx "$FIX_LEAF"; then
    fail "T3: the cmdline sweep DID return the retitled leaf — fixture does not model #1368"
  else
    for p in $SWEEP_PIDS; do kill -9 "$p" 2>/dev/null || true; done
    sleep 0.6
    if alive "$FIX_LEAF"; then
      pass "T3: negative control holds — the cmdline sweep alone leaves the leaf alive"
    else
      fail "T3: leaf died without kill_tree — the fixture cannot discriminate the bug"
    fi
  fi
  kill_tree "$FIX_PARENT" 2>/dev/null || true
  kill -9 "$FIX_LEAF" 2>/dev/null || true
fi

# ── T4: the timeout path reaps what it launched (#1368's leak source) ──
# The pre-fix script printed its failure and `exit 1`'d with the nohup'd tree
# still running, so a slow cold boot left a mid-bind next-server behind. Assert
# the launch records a PID and the timeout branch kills that tree.
if grep -q 'DEV_PID=\$!' "$TARGET"; then
  pass "T4a: the backgrounded boot's PID is captured (DEV_PID=\$!)"
else
  fail "T4a: the backgrounded boot's PID is not captured — the timeout path cannot reap it"
fi
TIMEOUT_BLOCK=$(sed -n '/failed to bind port/,$p' "$TARGET")
if echo "$TIMEOUT_BLOCK" | grep -q 'kill_tree "\$DEV_PID"'; then
  pass "T4b: the 40s-timeout path calls kill_tree on the boot it launched"
else
  fail "T4b: the 40s-timeout path exits without reaping the boot it launched (#1368 leak)"
fi

# ── T5: the port-still-held advice does not point only at lsof ──
# #1368's session was told `Check: lsof -i :$PORT` by a script whose own lsof
# query had already come back empty. netstat reports the socket rather than
# attributing it to a PID, so it is the query that can still say something.
HELD_BLOCK=$(sed -n '/still in use after cleanup/,/^fi$/p' "$TARGET")
if echo "$HELD_BLOCK" | grep -q 'netstat'; then
  pass "T5: the port-held failure surfaces netstat, not just lsof"
else
  fail "T5: the port-held failure still points only at lsof (the query that came back empty)"
fi

echo ""
if [ "$FAILED" -eq 0 ]; then
  printf '%b\n' "${GREEN}✓ dev-restart.sh kill_tree contract: all assertions pass${NC}"
  exit 0
fi
printf '%b\n' "${RED}✗ dev-restart.sh kill_tree contract: assertions failed${NC}"
exit 1
