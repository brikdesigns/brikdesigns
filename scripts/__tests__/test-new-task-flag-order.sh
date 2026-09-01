#!/usr/bin/env bash
# Contract gate for new-task.sh's flag parsing (#1820, this repo: #3022).
#
# The parse loop used to `break` at the first positional argument, so a flag
# written AFTER the slug was discarded without a word. The consequence here is
# worse than a missing flag: with no --issue, the gate falls through to
# derive_issue_from_slug (lib/overlap-filters.sh:24), which matches any trailing
# 2-5 digit run in the slug. So
#
#   ./scripts/new-task.sh infra-flag-1437 --issue 1512
#
# gated on 1437 and never mentioned 1512 — and check_issue_claim (new-task.sh:367)
# then CLAIMED 1437 for the branch. The gate exists because brik-llm#1485 and
# #1525 were each built twice; pointed at the wrong ticket it reports clean while
# doing nothing.
#
# This is NOT a byte-identical fleet twin (do not register it in TWINS): brikdesigns
# has no universal observable for this contract — it forks the slug derivation and
# strings from the other gated repos (#3022/#2963). Each gated repo carries its own
# copy; this is brikdesigns's.
#
# The load-bearing assertion is therefore NOT "the gate ran". It is that the
# DERIVED path did not fire when an explicit --issue was supplied. A test that
# only checked "some gate ran" would pass against the bug.
#
# No network: a throwaway repo, fake `gh` on PATH. The unset below is per
# brik-bds#1539 — a test invoked from a git hook inherits GIT_DIR, which is how
# the sibling overlap-filters test once rewrote refs in the live repo.
#
# Run: bash scripts/__tests__/test-new-task-flag-order.sh

set -u
unset GIT_DIR GIT_WORK_TREE GIT_INDEX_FILE GIT_COMMON_DIR GIT_NAMESPACE \
      GIT_OBJECT_DIRECTORY GIT_ALTERNATE_OBJECT_DIRECTORIES

SCRIPTS="$(cd "$(dirname "$0")/.." && pwd)"
[ -f "$SCRIPTS/new-task.sh" ] || { echo "new-task.sh not found under $SCRIPTS"; exit 1; }

DERIVED_MARKER='Derived --issue'

PASS=0; FAIL=0; FAILED_CASES=()
assert_eq() {
  local label="$1" want="$2" got="$3"
  if [ "$want" = "$got" ]; then PASS=$((PASS+1)); echo "  ✓ $label";
  else FAIL=$((FAIL+1)); FAILED_CASES+=("$label"); echo "  ✗ $label"; echo "      want: [$want]"; echo "      got:  [$got]"; fi
}

TMPROOT="$(mktemp -d "${TMPDIR:-/tmp}/brik-new-task-flags-XXXXXXXX")"
trap 'rm -rf "$TMPROOT"' EXIT
case "$TMPROOT" in
  /*/brik-new-task-flags-*) : ;;
  *) echo "refusing to run: TMPROOT looks wrong ($TMPROOT)"; exit 1 ;;
esac

# ── Stubs: no network. `gh api` failing makes the overlap + claim checks degrade
#    quietly, which is fine — this is about WHICH ticket reached them.
mkdir -p "$TMPROOT/bin"
cat > "$TMPROOT/bin/gh" <<'FAKE'
#!/usr/bin/env bash
case "${1:-}" in
  api) exit 1 ;;
  *)   : ;;
esac
exit 0
FAKE
printf '#!/usr/bin/env bash\nexit 0\n' > "$TMPROOT/bin/npm"
printf '#!/usr/bin/env bash\nexit 0\n' > "$TMPROOT/bin/op"
chmod +x "$TMPROOT/bin"/*

# ── Fixture: a primary repo on `main` with an origin it can fetch ──
build_repo() {
  local root="$1" script="$2"
  local remote="$root/remote.git" primary="$root/brikdesigns"
  rm -rf "$root"; mkdir -p "$root"
  git init -q --bare "$remote"
  # ensure_git_remote_auth (where present) probes `git ls-remote --exit-code
  # origin HEAD`; a fresh bare repo has no HEAD target.
  git -C "$remote" symbolic-ref HEAD refs/heads/main
  git init -q -b main "$primary"
  (
    cd "$primary" || exit 1
    git config user.email t@example.com; git config user.name Test
    git config commit.gpgsign false
    mkdir -p scripts/lib
    cp "$script" scripts/new-task.sh
    cp "$SCRIPTS"/lib/*.sh scripts/lib/ 2>/dev/null || true
    chmod +x scripts/new-task.sh
    echo '{}' > package.json
    git add -A; git commit -qm init
    git remote add origin "$remote"
    git push -q origin main
    git fetch -q origin
  )
  echo "$primary"
}

# Did the slug-derivation fallback fire? That is the tell for a dropped --issue.
derived() {
  local primary="$1"; shift
  local out
  out="$( cd "$primary" && PATH="$TMPROOT/bin:$PATH" \
            ./scripts/new-task.sh "$@" 2>&1 </dev/null || true )"
  case "$out" in
    *"$DERIVED_MARKER"*) echo yes ;;
    *)                   echo no ;;
  esac
}

# The slug carries 1437; the flag says 999. Only one of them can win.
echo "── an explicit --issue beats the number embedded in the slug ──"
PRIMARY="$(build_repo "$TMPROOT/leading" "$SCRIPTS/new-task.sh")"
assert_eq "leading  --issue N {slug-1437}" "no" "$(derived "$PRIMARY" --issue 999 infra-flag-1437)"

PRIMARY="$(build_repo "$TMPROOT/trailing" "$SCRIPTS/new-task.sh")"
assert_eq "trailing {slug-1437} --issue N" "no" "$(derived "$PRIMARY" infra-flag-1437 --issue 999)"

echo "── derivation still fires when no --issue is given at all ──"
PRIMARY="$(build_repo "$TMPROOT/absent" "$SCRIPTS/new-task.sh")"
assert_eq "no flag: slug number is used" "yes" "$(derived "$PRIMARY" infra-flag-1437)"

echo "── --no-issue and --base are honoured in trailing position ──"
PRIMARY="$(build_repo "$TMPROOT/noissue" "$SCRIPTS/new-task.sh")"
NOISSUE_OUT="$( cd "$PRIMARY" && PATH="$TMPROOT/bin:$PATH" \
    ./scripts/new-task.sh infra-plain-slug --no-issue 2>&1 </dev/null || true )"
# Matches the banner rather than the whole branch, so the assertion stays about
# flag CONSUMPTION, not about what the --no-issue path does afterward.
case "$NOISSUE_OUT" in
  *'--no-issue: ticket-overlap gate deliberately skipped'*) NOISSUE_RESULT=honoured ;;
  *'Refusing to create a worktree with no ticket'*)         NOISSUE_RESULT=dropped ;;
  *)                                                        NOISSUE_RESULT=unknown ;;
esac
assert_eq "trailing --no-issue is consumed" "honoured" "$NOISSUE_RESULT"

# A flag written after the slug must be consumed as a flag, not mistaken for a
# second positional slug.
consumed_as_flag() {
  local primary="$1"; shift
  local out
  out="$( cd "$primary" && PATH="$TMPROOT/bin:$PATH" \
            ./scripts/new-task.sh "$@" 2>&1 </dev/null || true )"
  case "$out" in
    *'Unknown flag'*|*'must follow'*) echo rejected ;;
    *)                                echo accepted ;;
  esac
}
PRIMARY="$(build_repo "$TMPROOT/base" "$SCRIPTS/new-task.sh")"
assert_eq "trailing --base is consumed, not read as a slug" "accepted" \
  "$(consumed_as_flag "$PRIMARY" infra-plain-slug --no-issue --base main)"

echo "── an unknown flag still errors, in either position ──"
PRIMARY="$(build_repo "$TMPROOT/unknown" "$SCRIPTS/new-task.sh")"
unknown_flag_rejected() {
  local out
  out="$( cd "$PRIMARY" && PATH="$TMPROOT/bin:$PATH" \
            ./scripts/new-task.sh "$@" 2>&1 </dev/null || true )"
  case "$out" in *'Unknown flag'*) echo yes ;; *) echo no ;; esac
}
assert_eq "leading  --bogus" "yes" "$(unknown_flag_rejected --bogus infra-plain-slug)"
assert_eq "trailing --bogus" "yes" "$(unknown_flag_rejected infra-plain-slug --bogus)"

echo "── negative control: the pre-fix script must gate on the WRONG ticket ──"
PREFIX_SCRIPT="$TMPROOT/new-task-prefix.sh"
awk '
  /^ *POSITIONAL\+=\("\$1"\)$/ { print "      break"; skip_shift = 1; next }
  skip_shift && /^ *shift$/    { skip_shift = 0; next }
  /^set -- \$\{POSITIONAL\[@\]\+/ { next }
  { print }
' "$SCRIPTS/new-task.sh" > "$PREFIX_SCRIPT"
if grep -q 'POSITIONAL\[@\]' "$PREFIX_SCRIPT" || ! grep -qE '^ *break$' "$PREFIX_SCRIPT"; then
  echo "  ✗ could not rebuild the pre-fix script — the parse loop moved;"
  echo "    update this test's awk before trusting the cases above."
  FAIL=$((FAIL+1)); FAILED_CASES+=("negative control could not be built")
else
  PRIMARY="$(build_repo "$TMPROOT/broken" "$PREFIX_SCRIPT")"
  assert_eq "pre-fix: trailing --issue loses to the slug number" "yes" \
    "$(derived "$PRIMARY" infra-flag-1437 --issue 999)"
fi

echo ""
echo "  $PASS passed, $FAIL failed"
if [ "$FAIL" -gt 0 ]; then
  printf '  failed: %s\n' "${FAILED_CASES[@]}"
  exit 1
fi
