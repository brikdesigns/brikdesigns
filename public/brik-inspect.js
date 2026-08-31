/**
 * Brik Design Inspect — Token & Component Inspector
 *
 * Lightweight, zero-dependency overlay that audits mockup and product pages
 * against Brik Design System (BDS) rules. Built to give agents (and humans)
 * a fast way to identify token usage, BDS component classes, and hardcoded
 * values that should be tokenized.
 *
 * Sister to feedback-widget.js — uses the same BDS token block and Poppins
 * font for visual consistency.
 *
 * Enable via:
 *   1. Query param:        ?inspect=1  (loads toolbar AND activates hover)
 *   2. Script data-attr:   data-auto-enable="1"  (loads toolbar; hover stays off
 *                                                 until the user clicks Inspect
 *                                                 in the DevBar or the toolbar
 *                                                 fallback button)
 *
 * Inspect state is intentionally session-only: each page load starts inactive
 * unless the URL explicitly requests it. The widget formerly auto-activated
 * from `localStorage.brik-inspect-enabled` left over from a prior session,
 * which surprised users — the DevBar pill could show "inactive" while the
 * inspector was actually running because the DevBar shell hadn't yet hydrated
 * at the time the localStorage check ran (race condition). The persistence
 * was removed to keep the UI honest: pill state and runtime state are now
 * always in sync.
 *
 * Inject alongside feedback-widget.js (same deploy pipeline):
 *   <script src="inspect-widget.js" data-auto-enable="1"></script>
 *
 * Output:
 *   - Hover  → floating pill (selector + size + BDS/violation badges)
 *   - Click  → locked panel (full property breakdown, copy report)
 *   - Scan   → page-wide JSON violation report copied to clipboard
 *
 * Keyboard:  Cmd/Ctrl + Shift + I  toggles inspect mode.  ESC closes.
 *
 * Violation-set contract (brik-bds#2170): the inspector's violation set is
 * DEFINED to equal the token linter's error set (scripts/lint-tokens.js
 * --errors-only), so a green CI implies a clean inspector scan. Two mechanisms
 * hold that equality:
 *   1. bds-lint-ignore parity — the linter suppresses any source line carrying
 *      the marker, but the marker is a CSS comment stripped from the runtime
 *      CSSOM the inspector reads. The BDS manifest's `lint_ignores` array
 *      (built by scripts/build-inspector-manifest.mjs) carries the extracted
 *      { selector, property } exception set; auditProp drops any violation
 *      whose declaring rule is in it (see setLintIgnores / isLintIgnored).
 *   2. Stale-build guard — a dev server mid-build (broken HMR: index.json 500,
 *      empty story iframe) applies none of the stylesheets, so reads return
 *      browser defaults the inspector would mis-flag. A violation is only
 *      emitted once the document's stylesheets have resolved (auditReady /
 *      stylesheetsResolved).
 */

(function () {
  'use strict';

  // ── Config ──────────────────────────────────────────────────────────────
  const script = document.currentScript;
  const AUTO_ENABLE = script?.getAttribute('data-auto-enable') === '1';
  const URL_ENABLED = /[?&]inspect=1\b/.test(location.search);
  const SHOULD_ENABLE = AUTO_ENABLE || URL_ENABLED;

  if (!SHOULD_ENABLE) return;

  // Clear any stale persistence from sessions before this widget stopped
  // auto-activating from localStorage. Users who toggled inspect on in the
  // past would otherwise still have `brik-inspect-enabled=1` lingering; this
  // ensures their next session starts clean. Swallow access errors — older
  // Safari throws on localStorage in private mode, and a missing key means
  // there was nothing to clean up anyway.
  try {
    localStorage.removeItem('brik-inspect-enabled');
  } catch (_err) {
    /* private-mode storage unavailable — best-effort cleanup, safe to skip */
  }

  // Token prefixes considered valid BDS tokens. Anything not starting with
  // one of these is treated as an unknown custom var (still surfaced, but
  // flagged so agents can decide whether to canonicalize it).
  // Keep in sync with the families defined in @brikdesigns/bds dist/tokens.css.
  const VALID_TOKEN_PREFIXES = [
    '--color-', '--text-', '--background-', '--surface-', '--border-',
    '--padding-', '--space-', '--spacing-', '--gap-', '--margin-',
    '--font-family-', '--font-casing-', '--typography-', '--font-size-', '--font-weight-',
    '--body-', '--heading-', '--display-', '--label-', '--subtitle-',
    '--font-line-height-', '--letter-spacing-',
    '--border-radius-', '--radius-',
    '--shadow-', '--box-shadow-', '--elevation-',
    // Motion: --duration-/--ease-/--delay-/--iteration- are semantic tokens;
    // --easing- is the Style-Dictionary primitive export. See tokens.css.
    '--transition-', '--motion-', '--duration-', '--easing-', '--ease-',
    '--delay-', '--iteration-', '--stagger-',
    '--icon-', '--size-', '--content-width-', '--gutter-', '--measure-', '--aspect-', '--blur-radius-',
    '--layout-', '--page-', '--state-', '--tooltip-', '--bds-',
    '--breakpoint-', '--z-', '--interaction-',
  ];

  // Properties we audit. Order matters for panel display.
  const AUDIT_PROPS = [
    'color', 'background-color', 'background', 'background-image',
    'border', 'border-color', 'border-width', 'border-radius',
    'padding', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
    'margin', 'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
    'gap', 'row-gap', 'column-gap',
    'font-family', 'font-size', 'font-weight', 'line-height', 'letter-spacing',
    'box-shadow', 'opacity', 'transition',
  ];

  // Patterns that indicate a hardcoded value (when not wrapped in var()).
  const HEX_RE = /#[0-9a-fA-F]{3,8}\b/;
  const RGB_RE = /\brgba?\s*\(/;
  const HSL_RE = /\bhsla?\s*\(/;
  const RAW_PX_RE = /\b\d*\.?\d+px\b/;

  // Classes to ignore when inspecting (widget chrome).
  // bdb- = Brik DevBar shell — must be excluded so clicking DevBar slots
  // while inspect is active doesn't capture the click.
  const IGNORE_CLASS_PREFIXES = ['bfb-', 'bi-', 'bps-', 'bdb-'];

  // Padding/margin longhands collapse under their shorthand if shorthand exists.
  const LONGHAND_GROUPS = {
    padding: ['padding-top', 'padding-right', 'padding-bottom', 'padding-left'],
    margin: ['margin-top', 'margin-right', 'margin-bottom', 'margin-left'],
  };

  // ── BDS Tokens (Brik Design System — standalone inline values) ─────────
  // Values inlined for zero-dependency deploy: the css block below is built at
  // module init, synchronously, long before the optional manifest fetch lands.
  // Mirror the T block in feedback-widget.js — keep them in sync.
  //
  // Entries annotated with a `--color-*` token are GENERATED: run
  // `npm run gen:widget-tokens` to re-sync them, and `:check` gates them in CI
  // (scripts/gen-widget-tokens.mjs). Everything else here is hand-maintained.
  const T = {
    // Primitives
    // poppy-500 is 3.78:1 against white — it clears the 3:1 non-text threshold
    // for outlines and borders, and fails AA for anything carrying a label.
    // Fills and text that carry a label use poppy-700 (6.23:1), hovering to
    // poppy-800 (10.24:1). Same split #1576 made in feedback-widget.js.
    colorPoppyLight:       '#e35335', // --color-poppy-500
    colorPoppyDark:        '#b0351b', // --color-poppy-700
    colorPoppyDarker:      '#7d1d09', // --color-poppy-800
    colorPoppyLightest:    '#ffefeb', // --color-poppy-100
    colorPoppyLighter:     '#ffa693', // --color-poppy-300
    colorGrayscaleWhite:   '#ffffff', // --color-grayscale-white
    colorGrayscaleLightest:'#f2f2f2', // --color-grayscale-100
    colorGrayscaleLighter: '#e0e0e0', // --color-grayscale-300
    // Muted text ON the near-black pill/panel chrome. Not grayscale-500: that
    // is the muted stop for LIGHT surfaces, and on grayscale-950 it measures
    // 4.48:1 — under AA for the 10.26px pill meta. 400 is 7.94:1, and is the
    // stop #1737 minted for the hand-pinned #bdbdbd this chrome used to carry.
    colorGrayscaleMuted:   '#b0b0b0', // --color-grayscale-400
    colorGrayscaleDark:    '#5a5a5a', // --color-grayscale-700
    colorGrayscaleDarker:  '#333333', // --color-grayscale-800
    colorGrayscaleDarkest: '#1b1b1b', // --color-grayscale-950
    colorTanLightest:      '#f1f0ec', // --color-tan-100
    // Semantic surfaces (light theme — inspector mirrors feedback widget)
    backgroundBrandPrimary: '#e35335', // --background-brand-primary
    textPrimary:   '#333333', // --text-primary
    textSecondary: '#4f4f4f', // --text-secondary
    // --text-muted (#828282) is 3.84:1 on white — sanctioned at AA-LARGE only
    // (tokens/contrast-pairings.json). Every label in this panel is 10–12px, so
    // nothing here qualifies; they use --text-secondary (7.44:1) instead. The
    // entry stays because the panel may yet need a large-text muted role.
    textMuted:     '#828282', // --text-muted
    textInverse:   '#ffffff', // --text-inverse
    borderPrimary: '#e0e0e0', // --border-primary
    // Status. Each carries white text or sits on white, so each is picked to
    // clear AA 4.5:1 rather than to match the 6-step status hues.
    colorGreenLightest:    '#f8fff3', // --color-green-100
    statusOk:   '#437f4e', // --color-green-900
    statusWarn: '#795e1f', // --color-yellow-900
    // Standalone by necessity: BDS has no red ramp, and --color-system-red
    // (#eb5757) is 3.30:1 on this panel's white. #d83a3a is 4.58:1.
    statusErr:  '#d83a3a',
    // Typography
    fontFamily:         "'Poppins', system-ui, sans-serif",
    fontFamilyMono:     "'JetBrains Mono', ui-monospace, SF Mono, Menlo, Consolas, monospace",
    fontSizeXs:         '10.26px', // --font-size-25
    fontSizeSm:         '11.54px', // --font-size-50
    fontSizeBody:       '14px',    // --font-size-75
    fontSizeMd:         '16px',    // --font-size-100
    fontWeightMedium:   '500',
    fontWeightSemiBold: '600',
    fontWeightBold:     '700',
    lineHeightTight:    '1.3',
    lineHeightNormal:   '150%',
    // Space
    space100: '4px',  // --space-100
    space200: '8px',  // --space-200
    space300: '12px', // --space-300
    space400: '16px', // --space-400
    space500: '20px', // --space-500
    space600: '24px', // --space-600
    // Border radius
    radius100: '4px',   // --border-radius-100
    radius200: '8px',   // --border-radius-200
    radius300: '12px',  // --border-radius-300
    radiusPill:'999px', // --border-radius-pill
  };

  // ── State ───────────────────────────────────────────────────────────────
  let active = false;
  let hoveredEl = null;
  let lockedEl = null;
  // Ancestor ascent (#2196): a composedPath()-derived selection stack so a
  // wrapper the pointer can never resolve to — e.g. `.bds-frame--ratio-square`
  // around an `<img>` — is still reachable. ArrowUp climbs toward the root,
  // ArrowDown descends back toward the pointer leaf. `ascentPath` is leaf→root
  // (index 0 = pointer target); `ascentDepth` indexes into it.
  let ascentPath = [];
  let ascentDepth = 0;
  let rulesIndex = null;
  // Number of document.styleSheets present when rulesIndex was last built —
  // rebuild when it changes so an index cached before the story's stylesheets
  // loaded (broken/mid-build HMR) doesn't persist stale. See #2170.
  let rulesIndexSheetCount = -1;

  // ── Lint-ignore parity (#2170) ──────────────────────────────────────────
  // The token linter (scripts/lint-tokens.js) suppresses any SOURCE line
  // carrying a `bds-lint-ignore` marker. That marker is a CSS comment and never
  // survives into the runtime CSSOM this inspector reads, so without a bridge
  // the inspector re-flags all ~178 sanctioned exceptions the linter passes and
  // its count can never reach zero on a clean tree. The BDS manifest carries the
  // extracted exception set as `lint_ignores: [{ selector, property }]`
  // (scripts/build-inspector-manifest.mjs extractLintIgnores); we index it by
  // normalized-selector + property and drop any violation whose declaring rule
  // is listed, so the inspector's violation set equals the linter's error set.
  //   null  → manifest not yet loaded (never suppress on unknown)
  //   Set   → the loaded exception keys
  let lintIgnoreIndex = null;

  // MUST stay byte-identical to `normalizeSelector` in
  // scripts/build-inspector-manifest.mjs — the manifest stores selectors
  // normalized by that copy and we compare runtime origin selectors against
  // them here. Strip spaces around child/sibling combinators, collapse the
  // rest, so `.a > .b` (source) and `.a>.b` (CSSOM) compare equal.
  function normalizeSelector(sel) {
    return sel.replace(/\s*([>+~])\s*/g, '$1').replace(/\s+/g, ' ').trim();
  }

  // Build the exception index from a manifest `lint_ignores` array. Exposed on
  // window.BrikInspect for host/test injection (no manifest fetch in a test DOM).
  function setLintIgnores(list) {
    const set = new Set();
    if (Array.isArray(list)) {
      for (const e of list) {
        if (!e || !e.selector || !e.property) continue;
        set.add(`${normalizeSelector(e.selector)} ${e.property}`);
      }
    }
    lintIgnoreIndex = set;
  }

  // True when `prop` on the rule identified by `originSelector` carries a
  // `bds-lint-ignore` in source. Unknown baseline (manifest not loaded) → false:
  // we only ever SUPPRESS a violation on a known exception, never invent one.
  function isLintIgnored(originSelector, prop) {
    if (!lintIgnoreIndex || !originSelector) return false;
    return lintIgnoreIndex.has(`${normalizeSelector(originSelector)} ${prop}`);
  }

  // ── Stale/incomplete-build guard (#2170) ────────────────────────────────
  // A dev server mid-build (broken HMR: index.json 500, empty story iframe, or
  // a reload in flight) has not applied the component/token stylesheets, so
  // declared/computed reads return browser defaults the inspector would mis-flag
  // as raw-value violations (the phantom `font-size: 16px` on a correctly-
  // tokenized notification title). A violation is only emitted once the
  // document's stylesheets have resolved — the `load` event, i.e.
  // `document.readyState === 'complete'`, fires only after every stylesheet has
  // loaded and parsed, and drops back to 'loading'/'interactive' while an HMR
  // reload is in flight. We deliberately do NOT probe individual <link>.sheet:
  // a cross-origin or slow-but-benign link reads null and would suppress every
  // real violation on an otherwise-ready page.
  function stylesheetsResolved() {
    return document.readyState === 'complete';
  }
  // A trustworthy violation verdict needs BOTH: (1) stylesheets resolved — else
  // the read is a mid-build phantom (above); and (2) the lint-ignore baseline
  // loaded — else the inspector cannot honor the linter's exceptions and would
  // re-flag all ~178 of them. `lintIgnoreIndex === null` means the manifest
  // fetch has not resolved yet (or 404'd on an older consumer); we withhold the
  // verdict rather than emit those known-false positives (#2170).
  function auditReady() {
    return stylesheetsResolved() && lintIgnoreIndex !== null;
  }

  // ── BDS inspector manifest ──────────────────────────────────────────────
  // Optional runtime manifest exported by BDS at build time. Lets the inspect
  // widget show component status, Storybook URLs, and token values. The
  // manifest URL can be overridden via data-manifest-url on the script tag;
  // defaults to /bds-manifest.json (same-origin).
  const MANIFEST_URL =
    script?.getAttribute('data-manifest-url') || '/bds-manifest.json';
  let manifest = null; // { bds_version, components: {}, tokens: {} }
  async function loadManifest() {
    try {
      // 'no-cache' revalidates with the server on each load (ETag/Last-
      // Modified) so a freshly-synced manifest is picked up immediately
      // after a BDS deploy, without re-downloading when unchanged.
      const res = await fetch(MANIFEST_URL, { cache: 'no-cache' });
      if (!res.ok) return;
      manifest = await res.json();
      // Load the lint-ignore exception baseline (#2170). Older manifests lack
      // the field — leave the index null (never suppress) rather than empty.
      if (manifest && Array.isArray(manifest.lint_ignores)) {
        setLintIgnores(manifest.lint_ignores);
      }
      // Expose for debugging + cross-widget reuse (e.g. the Events slot could
      // enrich its display with token/component context in a future iteration).
      if (typeof window !== 'undefined') window.__brikInspectManifest = manifest;
    } catch {
      // Missing manifest is fine — the widget degrades to its older behavior.
    }
  }

  // Live Storybook story index. Used to verify manifest-emitted story IDs
  // actually resolve before we render an "Open in Storybook" link. The
  // BDS manifest builder now derives bucket-aware slugs from each
  // component's meta.title (e.g. `containers-card--overview`,
  // `components-badge--overview`) per brik-bds#724. A consumer running
  // against a stale `bds-manifest.json` (BDS bump pending) may still
  // emit URLs that don't match the live story tree, so we keep the
  // client-side validation as a safety net — broken URLs hide the
  // "Open in Storybook" link instead of producing a 404 click.
  //   storybookIndex === null  → not yet loaded (or CORS/404 failure)
  //   storybookIndex instanceof Set → known-valid story IDs
  let storybookIndex = null;
  async function loadStorybookIndex() {
    try {
      const base = getStorybookBase().replace(/\/+$/, '');
      const res = await fetch(`${base}/index.json`, { cache: 'no-cache', mode: 'cors' });
      if (!res.ok) return;
      const data = await res.json();
      storybookIndex = new Set(Object.keys(data.entries || {}));
      // If the user already has a panel open when the index resolves,
      // re-render so the now-validated button appears without reopen.
      if (lockedEl && panelEl && panelEl.style.display !== 'none') {
        openPanel(lockedEl);
      }
    } catch {
      // CORS failure, offline, or missing index — button falls back to
      // hidden. Local-dev Storybooks expose /index.json by default.
    }
  }

  // ── Font load (match feedback widget) ──────────────────────────────────
  if (!document.querySelector('link[href*="Poppins"]')) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap';
    document.head.appendChild(link);
  }

  // ── Styles ──────────────────────────────────────────────────────────────
  const css = `
    .bi-toolbar {
      position: fixed; top: ${T.space600}; left: ${T.space600};
      z-index: 2147483646;
      display: inline-flex; gap: ${T.space200}; align-items: center;
      font-family: ${T.fontFamily};
    }
    .bi-btn {
      background: ${T.colorGrayscaleDarkest};
      color: ${T.colorGrayscaleWhite};
      border: none;
      border-radius: ${T.radiusPill};
      padding: ${T.space300} ${T.space500};
      font-family: ${T.fontFamily};
      font-size: ${T.fontSizeBody};
      font-weight: ${T.fontWeightSemiBold};
      letter-spacing: 0.02em;
      cursor: pointer;
      box-shadow: 0 4px 20px rgba(0,0,0,0.22);
      transition: background 0.15s ease, transform 0.15s ease;
      display: inline-flex; align-items: center; gap: ${T.space200};
      line-height: 1; height: 40px; white-space: nowrap;
      box-sizing: border-box; -webkit-appearance: none; appearance: none;
    }
    .bi-btn:hover { background: ${T.colorGrayscaleDarker}; transform: translateY(-1px); }
    .bi-btn--active { background: ${T.colorPoppyDark}; }
    .bi-btn--active:hover { background: ${T.colorPoppyDarker}; }

    .bi-outline {
      position: fixed; pointer-events: none; z-index: 2147483640;
      border: 2px solid ${T.backgroundBrandPrimary};
      border-radius: ${T.radius100};
      box-shadow: 0 0 0 1px rgba(227,83,53,0.35), 0 0 0 9999px rgba(51,51,51,0.06);
      transition: top 0.08s ease-out, left 0.08s ease-out, width 0.08s ease-out, height 0.08s ease-out;
    }
    .bi-outline--locked {
      border-color: ${T.colorPoppyDark};
      box-shadow: 0 0 0 1px rgba(176,53,27,0.45);
    }

    .bi-pill {
      position: fixed; z-index: 2147483645; pointer-events: none;
      background: ${T.colorGrayscaleDarkest};
      color: ${T.colorGrayscaleWhite};
      padding: ${T.space200} ${T.space300};
      border-radius: ${T.radius200};
      font-family: ${T.fontFamilyMono};
      font-size: ${T.fontSizeXs};
      line-height: 1.4;
      box-shadow: 0 4px 20px rgba(0,0,0,0.22);
      max-width: 320px;
    }
    .bi-pill__tag { color: ${T.colorPoppyLighter}; }
    .bi-pill__class { color: ${T.colorTanLightest}; }
    .bi-pill__size {
      color: ${T.colorGrayscaleMuted};
      font-size: ${T.fontSizeXs};
    }
    .bi-pill__badge {
      display: inline-block; margin-left: ${T.space200};
      padding: 2px 6px; border-radius: ${T.radius100};
      font-size: 10px; font-weight: ${T.fontWeightBold};
      font-family: ${T.fontFamily};
      letter-spacing: 0.04em; text-transform: uppercase;
    }
    .bi-pill__badge--bds  { background: ${T.statusOk}; color: ${T.colorGrayscaleWhite}; }
    .bi-pill__badge--warn { background: ${T.colorPoppyDark}; color: ${T.colorGrayscaleWhite}; }

    .bi-panel {
      position: fixed; top: 76px; left: ${T.space600};
      width: 380px; max-height: calc(100vh - 96px); overflow-y: auto;
      z-index: 2147483644;
      background: ${T.colorGrayscaleWhite};
      color: ${T.textPrimary};
      border: 1px solid ${T.borderPrimary};
      border-radius: ${T.radius300};
      box-shadow: 0 12px 48px rgba(0,0,0,0.18);
      font-family: ${T.fontFamily};
      font-size: ${T.fontSizeBody};
      line-height: ${T.lineHeightNormal};
    }
    .bi-panel__header {
      padding: ${T.space300} ${T.space400};
      border-bottom: 1px solid ${T.borderPrimary};
      display: flex; align-items: center; justify-content: space-between;
      position: sticky; top: 0; background: ${T.colorGrayscaleWhite};
      border-radius: ${T.radius300} ${T.radius300} 0 0;
      gap: ${T.space200};
    }
    .bi-panel__title {
      font-family: ${T.fontFamilyMono};
      font-size: ${T.fontSizeBody};
      font-weight: ${T.fontWeightSemiBold};
      color: ${T.textPrimary};
      word-break: break-all;
    }
    .bi-panel__close {
      background: transparent; border: none;
      color: ${T.textSecondary};
      font-size: 20px; cursor: pointer; padding: 0 ${T.space100};
      line-height: 1; flex-shrink: 0;
    }
    .bi-panel__close:hover { color: ${T.textPrimary}; }

    .bi-panel__section {
      padding: ${T.space300} ${T.space400};
      border-bottom: 1px solid ${T.borderPrimary};
    }
    .bi-panel__section:last-child { border-bottom: none; }
    .bi-panel__section-title {
      font-family: ${T.fontFamily};
      font-size: ${T.fontSizeXs};
      font-weight: ${T.fontWeightBold};
      color: ${T.textSecondary};
      text-transform: uppercase;
      letter-spacing: 0.08em;
      margin-bottom: ${T.space200};
    }

    .bi-row {
      display: flex; gap: ${T.space200}; align-items: flex-start;
      padding: 3px 0;
      font-family: ${T.fontFamilyMono};
    }
    .bi-row__label {
      color: ${T.textSecondary};
      flex: 0 0 110px;
      font-size: ${T.fontSizeSm};
    }
    .bi-row__value {
      flex: 1; min-width: 0;
      font-size: ${T.fontSizeSm};
      word-break: break-word;
      color: ${T.textPrimary};
    }
    .bi-token { color: ${T.colorPoppyDark}; font-weight: ${T.fontWeightMedium}; }
    .bi-token--unknown { color: ${T.statusWarn}; }
    .bi-computed {
      color: ${T.textSecondary};
      font-size: ${T.fontSizeXs};
      margin-left: ${T.space200};
    }
    .bi-hardcoded { color: ${T.statusErr}; font-weight: ${T.fontWeightSemiBold}; }
    .bi-hardcoded::before { content: '⚠ '; color: ${T.statusErr}; }
    .bi-swatch {
      display: inline-block; width: 10px; height: 10px;
      border-radius: ${T.radius100};
      border: 1px solid ${T.borderPrimary};
      margin-right: ${T.space100}; vertical-align: middle;
    }

    .bi-summary {
      display: flex; gap: ${T.space200}; flex-wrap: wrap;
      margin-bottom: ${T.space200};
    }
    .bi-stat {
      background: ${T.colorTanLightest}; color: ${T.textPrimary};
      padding: ${T.space100} ${T.space200};
      border-radius: ${T.radius100};
      font-family: ${T.fontFamily};
      font-size: ${T.fontSizeSm};
      font-weight: ${T.fontWeightSemiBold};
      display: inline-flex; align-items: center; gap: ${T.space100};
    }
    .bi-stat--warn { background: ${T.colorPoppyLightest}; color: ${T.colorPoppyDark}; }
    .bi-stat--ok   { background: ${T.colorGreenLightest}; color: ${T.statusOk}; }

    .bi-class-chip {
      display: inline-block;
      padding: 2px 6px; margin: 2px ${T.space100} 2px 0;
      background: ${T.colorTanLightest};
      border-radius: ${T.radius100};
      font-family: ${T.fontFamilyMono};
      font-size: ${T.fontSizeXs};
      color: ${T.textSecondary};
    }
    .bi-class-chip--bds {
      background: ${T.colorGreenLightest}; color: ${T.statusOk};
    }

    .bi-actions {
      display: flex; gap: ${T.space200}; flex-wrap: wrap;
      padding: ${T.space300} ${T.space400};
    }
    .bi-action-btn {
      background: ${T.colorGrayscaleWhite};
      color: ${T.textPrimary};
      border: 1px solid ${T.borderPrimary};
      border-radius: ${T.radiusPill};
      padding: ${T.space200} ${T.space300};
      font-family: ${T.fontFamily};
      font-size: ${T.fontSizeSm};
      font-weight: ${T.fontWeightSemiBold};
      cursor: pointer;
      flex: 1;
      transition: background 0.12s ease, color 0.12s ease;
    }
    .bi-action-btn:hover {
      background: ${T.colorPoppyDark};
      color: ${T.colorGrayscaleWhite};
      border-color: ${T.colorPoppyDark};
    }
  `;

  // ── Utilities ───────────────────────────────────────────────────────────
  function injectStyles() {
    const style = document.createElement('style');
    style.textContent = css;
    style.setAttribute('data-brik-inspect', '');
    document.head.appendChild(style);
  }

  function isIgnoredEl(el) {
    if (!el) return true;
    // Walk up ancestors so a click on a child (e.g. svg inside .bdb-slot)
    // is still recognised as widget chrome and skipped.
    let node = el;
    while (node && node !== document.body && node.nodeType === 1) {
      if (node.classList) {
        for (const cls of node.classList) {
          for (const prefix of IGNORE_CLASS_PREFIXES) {
            if (cls.startsWith(prefix)) return true;
          }
        }
      }
      node = node.parentElement;
    }
    return false;
  }

  function describeEl(el) {
    const tag = el.tagName.toLowerCase();
    const classes = Array.from(el.classList || []);
    const id = el.id ? `#${el.id}` : '';
    const classStr = classes.length ? '.' + classes.join('.') : '';
    return { tag, id, classes, selector: `${tag}${id}${classStr}` };
  }

  function findBdsRoot(el) {
    let node = el;
    while (node && node !== document.body) {
      const classes = Array.from(node.classList || []);
      const bdsClass = classes.find((c) => c.startsWith('bds-') && !c.includes('__') && !c.includes('--'));
      if (bdsClass) {
        const meta = manifest?.components?.[bdsClass] || null;
        return { root: node, component: bdsClass, meta };
      }
      node = node.parentElement;
    }
    return null;
  }

  // Look up a token's manifest entry by name (e.g. "--color-poppy-light").
  function findTokenMeta(tokenName) {
    return manifest?.tokens?.[tokenName] || null;
  }

  // ── A11y runtime checks ─────────────────────────────────────────────────
  //
  // Lightweight per-element accessibility audit. Not a replacement for a
  // proper axe-core run in CI — this is fast, in-browser, and good enough
  // to catch obvious violations in the QA loop.
  //
  // What it checks:
  //   - Contrast ratio of the element's color vs its effective background
  //     (WCAG AA thresholds: 4.5 for normal text, 3.0 for ≥18pt or ≥14pt bold).
  //   - Interactive elements (button, a, [role=button], inputs) missing an
  //     accessible name (no text, no aria-label, no aria-labelledby, no title).
  //   - Images without alt attribute.
  //   - Form inputs without an associated label.
  //
  // Returns { contrast, nameCheck, issues: [] }. issues is the array rendered
  // in the panel's Accessibility section.

  function parseColorToRgb(str) {
    if (!str) return null;
    const match = str.match(/rgba?\(([^)]+)\)/i);
    if (!match) return null;
    const parts = match[1].split(',').map((s) => parseFloat(s.trim()));
    if (parts.length < 3) return null;
    return { r: parts[0], g: parts[1], b: parts[2], a: parts[3] ?? 1 };
  }

  function relativeLuminance(rgb) {
    const toLinear = (c) => {
      const s = c / 255;
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * toLinear(rgb.r) + 0.7152 * toLinear(rgb.g) + 0.0722 * toLinear(rgb.b);
  }

  function contrastRatio(fg, bg) {
    const l1 = relativeLuminance(fg);
    const l2 = relativeLuminance(bg);
    const lighter = Math.max(l1, l2);
    const darker = Math.min(l1, l2);
    return (lighter + 0.05) / (darker + 0.05);
  }

  // Walk up ancestors to find the first opaque (alpha === 1) background.
  // Most hovered elements have transparent bg; we need the blended backdrop.
  function effectiveBackground(el) {
    let node = el;
    // Walk through <html> as well (parentElement is null above it). An
    // html-background theme (`html{background:#111}; body{background:transparent}`)
    // paints the page background on documentElement; the old
    // `!== documentElement` guard stopped short of it and measured contrast
    // against the white fallback (#2197 F).
    while (node) {
      const cs = getComputedStyle(node);
      const bg = parseColorToRgb(cs.backgroundColor);
      if (bg && bg.a === 1) return bg;
      node = node.parentElement;
    }
    // Default to white if we never hit an opaque ancestor.
    return { r: 255, g: 255, b: 255, a: 1 };
  }

  function auditContrast(el) {
    const cs = getComputedStyle(el);
    const fg = parseColorToRgb(cs.color);
    if (!fg) return null;
    const bg = effectiveBackground(el);
    const ratio = contrastRatio(fg, bg);
    const sizePx = parseFloat(cs.fontSize) || 16;
    const weight = parseInt(cs.fontWeight, 10) || 400;
    // WCAG "large text" = ≥18pt (24px) OR ≥14pt bold (18.66px @ weight ≥700).
    const isLarge = sizePx >= 24 || (sizePx >= 18.66 && weight >= 700);
    const threshold = isLarge ? 3.0 : 4.5;
    return {
      ratio,
      rounded: Math.round(ratio * 100) / 100,
      threshold,
      passesAA: ratio >= threshold,
      passesAAA: ratio >= (isLarge ? 4.5 : 7),
      isLarge,
      fg: `rgb(${fg.r}, ${fg.g}, ${fg.b})`,
      bg: `rgb(${bg.r}, ${bg.g}, ${bg.b})`,
    };
  }

  function isInteractive(el) {
    const tag = el.tagName.toLowerCase();
    if (['button', 'a', 'select', 'textarea'].includes(tag)) return true;
    if (tag === 'input' && el.type !== 'hidden') return true;
    const role = el.getAttribute('role');
    if (role && ['button', 'link', 'menuitem', 'tab', 'checkbox', 'radio', 'switch', 'combobox', 'textbox'].includes(role)) return true;
    if (el.hasAttribute('tabindex') && el.getAttribute('tabindex') !== '-1') return true;
    return false;
  }

  function hasAccessibleName(el) {
    if (el.getAttribute('aria-label')?.trim()) return true;
    if (el.getAttribute('aria-labelledby')?.trim()) return true;
    if (el.getAttribute('title')?.trim()) return true;
    // textContent names a button / link / heading, but NOT a form control — a
    // <select>'s <option>s and a <textarea>'s value are its content, not its
    // accessible name. Without this guard an unlabelled <select><option>…</select>
    // (non-empty textContent) always reported as named (#2197 E).
    const tag = el.tagName;
    const isFormControl = tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA';
    if (!isFormControl) {
      const text = (el.textContent || '').trim();
      if (text.length > 0) return true;
    }
    // Images use alt
    if (el.tagName === 'IMG' && el.getAttribute('alt')?.trim()) return true;
    // Inputs can be labeled by a <label for> or wrapping <label>
    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT') {
      if (el.id && document.querySelector(`label[for="${CSS.escape(el.id)}"]`)) return true;
      if (el.closest('label')) return true;
      if (el.getAttribute('placeholder')?.trim()) return true; // weak but counted
    }
    return false;
  }

  function auditA11y(el) {
    const issues = [];
    const contrast = auditContrast(el);
    if (contrast && !contrast.passesAA) {
      issues.push({
        severity: 'error',
        code: 'contrast-aa',
        message: `Contrast ${contrast.rounded}:1 fails WCAG AA (needs ≥${contrast.threshold}:1)`,
      });
    }

    const interactive = isInteractive(el);
    if (interactive && !hasAccessibleName(el)) {
      issues.push({
        severity: 'error',
        code: 'name-missing',
        message: `Interactive ${el.tagName.toLowerCase()} has no accessible name (aria-label, text, or title)`,
      });
    }

    if (el.tagName === 'IMG' && !el.hasAttribute('alt')) {
      issues.push({
        severity: 'error',
        code: 'img-alt-missing',
        message: 'img element missing alt attribute (use empty alt="" for decorative)',
      });
    }

    // Soft checks
    const role = el.getAttribute('role');
    if (role === 'button' && el.tagName !== 'BUTTON') {
      issues.push({
        severity: 'info',
        code: 'role-button-on-non-button',
        message: `role="button" on <${el.tagName.toLowerCase()}> — prefer native <button> for keyboard + focus defaults`,
      });
    }

    if (el.getAttribute('tabindex') && parseInt(el.getAttribute('tabindex'), 10) > 0) {
      issues.push({
        severity: 'warn',
        code: 'positive-tabindex',
        message: `tabindex="${el.getAttribute('tabindex')}" — positive values rarely needed; disrupts tab order`,
      });
    }

    return { contrast, interactive, issues };
  }

  function findBemRoot(el) {
    let node = el;
    while (node && node !== document.body) {
      const classes = Array.from(node.classList || []);
      const block = classes.find((c) =>
        !c.startsWith('bds-') &&
        !c.includes('__') && !c.includes('--') &&
        !IGNORE_CLASS_PREFIXES.some((p) => c.startsWith(p))
      );
      if (block) return { root: node, component: block };
      node = node.parentElement;
    }
    return null;
  }

  // ── Element-context detection (ADR-007) ─────────────────────────────────
  //
  // The inspector is the single element-selection + context detector; feedback
  // surfaces consume what it emits rather than maintaining parallel pickers.
  // Resolves { page, section, component, element_tag } for a selected element.
  // Ported from the former DevFeedbackWidget/detectContext.ts (brik-bds#880);
  // component reuses findBdsRoot above so there is one component detector.
  //
  // Two environments are covered in one pass:
  //   - Astro client mockups use the BDS `section--{type}` class convention.
  //   - Product apps resolve section from semantic landmarks (`<section>`,
  //     `<main>`, `[role=region]`, `[data-section]`) + aria-label / nearest
  //     heading / id fallback.
  // Every field is best-effort and may be absent — consumers treat the result
  // as optional context, never required.

  function detectPage() {
    // The URL pathname is the canonical page identity and is preferred — product
    // apps (portal, renew-pms) share one templated <title> across every route, so
    // document.title is non-discriminating there (every page reported the same
    // name; brik-llm#979). The slug ("admin", "settings/services") is what a
    // triager needs. document.title is kept only as a fallback for the root path,
    // where the slug is empty.
    if (typeof location !== 'undefined' && location.pathname) {
      const slug = location.pathname.replace(/^\/+|\/+$/g, '');
      if (slug) return slug;
    }
    const title = document.title?.trim();
    if (title) return title;
    return undefined;
  }

  function firstText(...candidates) {
    for (const c of candidates) {
      const t = c?.trim();
      if (t) return t;
    }
    return undefined;
  }

  // The page's primary heading — the first <h1> (preferring one inside <main>).
  // Used to stop the section detector from reporting the page title as a
  // "section" (brik-bds#886).
  function isPageHeading(heading) {
    const pageH1 = document.querySelector('main h1') || document.querySelector('h1');
    return !!pageH1 && heading === pageH1;
  }

  // ── Section / component identity helpers (brik-client-portal#1757) ────────
  //
  // The section detector formerly matched the substring "section--" anywhere in
  // an element's class list. BDS renders BEM spacing modifiers such as
  // `bds-data-section--spacing-lg`, which contain that substring but are NOT the
  // Astro mockup `section section--{type}` convention. The old match reported
  // every DataSection's spacing modifier ("spacing-lg") as its section identity,
  // burying the real one (its title) and making feedback tickets un-triageable.
  // These helpers anchor the mockup convention to a standalone class token and
  // add a product-app path: a BDS section's identity is its rendered title.

  // Standalone Astro mockup section-type token: "section--hero" → "hero".
  // Excludes BDS BEM modifiers like "bds-data-section--spacing-lg" (a single
  // token that does not START with "section--").
  function mockupSectionType(el) {
    for (const cls of el.classList || []) {
      const m = cls.match(/^section--([a-z0-9-]+)$/i);
      if (m) return m[1];
    }
    return null;
  }

  // Nearest ancestor carrying a standalone mockup section-- token.
  function closestMockupSection(el) {
    let node = el;
    while (node && node !== document.body && node.nodeType === 1) {
      if (mockupSectionType(node)) return node;
      node = node.parentElement;
    }
    return null;
  }

  // Nearest BDS "section" container (bds-data-section, bds-sheet-section) and its
  // rendered title — the section identity a triager needs in a product app
  // ("Integrations", "Brand Guide"). Block class = a bds-*section token with no
  // BEM `__element` / `--modifier` suffix.
  function closestBdsSection(el) {
    let node = el;
    while (node && node !== document.body && node.nodeType === 1) {
      const block = Array.from(node.classList || []).find((c) => /^bds-[a-z-]*section$/.test(c));
      if (block) {
        const titleEl = node.querySelector(`.${block}__title`);
        const title = titleEl && titleEl.textContent ? titleEl.textContent.trim() : '';
        return { root: node, block, title: title || undefined };
      }
      node = node.parentElement;
    }
    return null;
  }

  // Stable structural path to the selected element — the address a triager or
  // agent jumps to when a label repeats (two same-named bds-fields, a repeated
  // component). Walks from the element up to the nearest <main> landmark (or
  // <body>), emitting one `:nth-of-type` segment per level: nth-of-type is
  // 1-based among same-tag siblings, so it survives sibling-count shifts that
  // break nth-child. Prefers a bds-* block class over the bare tag so the path
  // reads structurally (".bds-field:nth-of-type(2)"). brik-client-portal#1760.
  function domPath(el) {
    const segments = [];
    let node = el;
    while (node && node.nodeType === 1) {
      const tag = node.tagName.toLowerCase();
      let nth = 1;
      let sib = node.previousElementSibling;
      while (sib) {
        if (sib.tagName === node.tagName) nth += 1;
        sib = sib.previousElementSibling;
      }
      const block = Array.from(node.classList || []).find(
        (c) => c.startsWith('bds-') && !c.includes('__') && !c.includes('--'),
      );
      segments.unshift(`${block ? `.${block}` : tag}:nth-of-type(${nth})`);
      if (node === document.body || tag === 'main') break;
      node = node.parentElement;
    }
    return segments.join(' > ') || undefined;
  }

  // A leaf component's own label, so a ticket names *which* instance. bds-field
  // renders its label in `.bds-field__label`; the generic `{block}__label`
  // lookup returns undefined when a component has none. Component is a rich_text
  // Notion property, so appending this free text is safe.
  function componentInstanceLabel(root, component) {
    const labelEl = root.querySelector(`.${component}__label`);
    const label = labelEl && labelEl.textContent ? labelEl.textContent.trim() : '';
    return label || undefined;
  }

  function sectionLabel(section) {
    // Mockup convention first: "section section--hero" → "hero". Anchored to a
    // standalone token so BDS BEM modifiers ("bds-data-section--spacing-lg")
    // don't false-match (brik-client-portal#1757).
    const typeMatch = mockupSectionType(section);
    if (typeMatch) return typeMatch;

    // Explicit, author-provided labels, most-explicit first. These deliberately
    // name a region, so they're trusted even on <main>.
    const ariaLabel = section.getAttribute('aria-label');
    const dataSection = section.getAttribute('data-section');
    const labelledBy = section.getAttribute('aria-labelledby');
    const labelledByText = labelledBy ? document.getElementById(labelledBy)?.textContent : undefined;
    const explicit = firstText(ariaLabel, dataSection, labelledByText);
    if (explicit) return explicit;

    // <main> is the page-level landmark, not a section. Product-app pages
    // typically have a single <main> whose first heading is the page H1 and
    // whose id is a skip-link target ("main-content"); deriving a section name
    // from either is misleading (brik-bds#886). Without an explicit label
    // above, <main> names no section — let the caller omit it.
    if (section.tagName === 'MAIN') return undefined;

    // Non-landmark regions: nearest heading, then id. Never the page H1 — a
    // <section> whose only heading is the document title is effectively
    // page-level and would mislead a triager.
    const heading = section.querySelector('h1, h2, h3, h4');
    if (heading && !isPageHeading(heading)) {
      const text = heading.textContent?.trim();
      if (text) return text;
    }
    return firstText(section.id || undefined);
  }

  // Structured section metadata for the Astro mockup environment. Mockups
  // annotate sections with `section--{type}` / `layout--{name}` classes and a
  // preceding `<!-- Source: home.md Section-XX -->` comment; the pin-drop
  // feedback widget records these in Supabase design_feedback.section_context.
  // Surfacing them here (all undefined in product apps, which have none of these
  // conventions) lets the pin-drop widget consume this one detector instead of a
  // parallel detectSectionContext() copy — brik-client-portal#1132 / ADR-007.
  function detectSectionMeta(el) {
    const meta = {};

    const section = closestMockupSection(el);
    if (section) {
      const typeMatch = mockupSectionType(section);
      if (typeMatch) meta.section_type = typeMatch;

      const ariaLabel = section.getAttribute('aria-label');
      if (ariaLabel) meta.section_label = ariaLabel;

      if (section.id) meta.section_id = section.id;

      // Walk back over text nodes to the nearest preceding comment / element.
      let prev = section.previousSibling;
      while (prev) {
        if (prev.nodeType === 8) {
          const m = prev.textContent.trim().match(/Source:\s*(.+)/);
          if (m) { meta.content_source = m[1].trim(); break; }
        }
        if (prev.nodeType === 1) break;
        prev = prev.previousSibling;
      }

      // 1-based position among all mockup section-- blocks in document order.
      const all = Array.from(document.querySelectorAll('[class*="section--"]')).filter(mockupSectionType);
      const idx = all.indexOf(section);
      if (idx >= 0) meta.section_number = idx + 1;
    }

    const layout = el.closest('[class*="layout--"]');
    if (layout) {
      const m = layout.className.match(/layout--([a-z0-9-]+)/i);
      if (m) meta.layout = m[1];
    }

    return meta;
  }

  function detectReportContext(el) {
    const ctx = {};

    const page = detectPage();
    if (page) ctx.page = page;

    // Section identity, most-specific first (brik-client-portal#1757):
    //  1. Astro mockup `section--{type}` (standalone token).
    //  2. BDS section container's title — the identity a triager needs in a
    //     product app ("Integrations"). The old [class*="section--"] match
    //     caught the BDS spacing modifier here and reported "spacing-lg".
    //  3. Semantic landmark → nearest heading / explicit label.
    const mockupSection = closestMockupSection(el);
    if (mockupSection) {
      const label = sectionLabel(mockupSection);
      if (label) ctx.section = label;
    } else {
      const bdsSection = closestBdsSection(el);
      if (bdsSection && bdsSection.title) {
        ctx.section = bdsSection.title;
      } else {
        const landmark = el.closest('section, article, main, [role="region"], [data-section]');
        if (landmark) {
          const label = sectionLabel(landmark);
          if (label) ctx.section = label;
        }
      }
    }

    // Element identity, promoted to their own fields so a repeated-label field
    // is still uniquely addressable (brik-client-portal#1760):
    //  - component_title: the nearest BDS section title, as its own field
    //    rather than only folded into `section` above.
    //  - dom_path: a stable structural path to the selected element.
    const bdsSectionForTitle = closestBdsSection(el);
    if (bdsSectionForTitle && bdsSectionForTitle.title) {
      ctx.component_title = bdsSectionForTitle.title;
    }
    const path = domPath(el);
    if (path) ctx.dom_path = path;

    // Component: the BDS block class (e.g. "bds-field"), enriched with the
    // instance label when the component has one so a ticket names *which* one
    // ("bds-field · Live site"). brik-client-portal#1757.
    const bds = findBdsRoot(el);
    if (bds) {
      const label = componentInstanceLabel(bds.root, bds.component);
      ctx.component = label ? `${bds.component} · ${label}` : bds.component;
    }

    const meaningful = el.closest(
      'a, button, h1, h2, h3, h4, img, video, input, textarea, select, p, li, span',
    );
    if (meaningful) ctx.element_tag = meaningful.tagName.toLowerCase();

    // Mockup-environment structured fields (superset; undefined elsewhere).
    Object.assign(ctx, detectSectionMeta(el));

    return ctx;
  }

  // Emit the selected element's context so a host page (e.g. the product app's
  // feedback form) can pre-fill a submission. Returns the detail for callers
  // that want to act locally too.
  function emitReport(el) {
    const detail = detectReportContext(el);
    window.dispatchEvent(new CustomEvent('brik:inspect:report', { detail }));
    return detail;
  }

  // Expose the shared detector for surfaces that resolve element context without
  // entering inspect mode or listening for brik:inspect:report — the mockup
  // pin-drop feedback widget calls this synchronously on click. ADR-007 makes
  // this the single detector; consumers must not reimplement it (#1132).
  if (typeof window !== 'undefined') {
    window.BrikInspect = window.BrikInspect || {};
    window.BrikInspect.detectContext = detectReportContext;
    // Exposed for regression tests (cascade-keyword skip — #1615; declared-value
    // specificity / var()-shorthand / !important — #2195). Not part of the
    // public surface; consumers use detectContext / the report event.
    window.BrikInspect.getDeclaredValue = getDeclaredValue;
    window.BrikInspect.calcSpecificity = calcSpecificity;
    // Exposed for the audit false-negative regression tests (#2197): the
    // accessible-name and effective-background checks.
    window.BrikInspect.hasAccessibleName = hasAccessibleName;
    window.BrikInspect.effectiveBackground = effectiveBackground;
    // Exposed for the lint-ignore parity + stale-build regression tests (#2170)
    // and for a host to inject the exception set without a manifest fetch.
    window.BrikInspect.auditProp = auditProp;
    window.BrikInspect.setLintIgnores = setLintIgnores;
    window.BrikInspect.isLintIgnored = isLintIgnored;
    window.BrikInspect.stylesheetsResolved = stylesheetsResolved;
    // Missing-type gate (#2119) — computed-value check for a text-holding
    // leaf slot that never declared font-family/font-size and fell through to
    // the UA default. See the function's own doc comment for the design.
    window.BrikInspect.auditMissingType = auditMissingType;
    // Drive inspect on/off from a host that owns the DevBar slot (host-managed
    // mode — see registerWithDevBar). Idempotent: no-op when already in the
    // requested state. Lets the BDS Storybook InspectWidget bind the slot's
    // activate/deactivate to inspect mode without reaching into internals.
    window.BrikInspect.setActive = (next) => { if (!!next !== active) toggleActive(); };
    window.BrikInspect.isActive = () => active;
    // Ancestor ascent (#2196): the pure path builder for a unit test, plus a
    // read-only snapshot of the live selection for the interactive regression
    // test (which drives real mousemove / keydown / click events).
    window.BrikInspect.buildAscentPath = buildAscentPath;
    window.BrikInspect.getSelection = () => ({
      el: lockedEl || hoveredEl || null,
      depth: ascentDepth,
      pathLength: ascentPath.length,
    });
  }

  // ── Stylesheet rule index ───────────────────────────────────────────────
  function buildRulesIndex() {
    // Rebuild when the stylesheet count changes so a cache built before the
    // story's stylesheets loaded (mid-build HMR) can't persist stale (#2170).
    const count = document.styleSheets.length;
    if (rulesIndex && rulesIndexSheetCount === count) return rulesIndex;
    const rules = [];
    for (const sheet of Array.from(document.styleSheets)) {
      let sheetRules;
      try { sheetRules = sheet.cssRules; } catch (e) { continue; }
      if (!sheetRules) continue;
      walkRules(sheetRules, rules);
    }
    rulesIndex = rules;
    rulesIndexSheetCount = count;
    return rules;
  }

  function walkRules(cssRules, out) {
    for (const rule of Array.from(cssRules)) {
      if (rule.type === CSSRule.STYLE_RULE) {
        const selectors = rule.selectorText.split(',').map((s) => s.trim());
        for (const sel of selectors) {
          out.push({ selector: sel, style: rule.style, specificity: calcSpecificity(sel) });
        }
      } else if (rule.cssRules) {
        walkRules(rule.cssRules, out);
      }
    }
  }

  function calcSpecificity(sel) {
    let s = sel;
    let ids = 0;
    let classes = 0;
    let elements = 0;

    // `:where()` contributes nothing — strip it and its argument entirely.
    s = s.replace(/:where\([^)]*\)/gi, ' ');
    // `:is()` / `:matches()` / `:not()` contribute the specificity of their
    // most specific argument (selectors-4). Fold that in, then remove the
    // functional part so its parentheses aren't recounted below.
    s = s.replace(/:(?:is|matches|not)\(([^)]*)\)/gi, (_m, args) => {
      let win = [0, 0, 0];
      let winScore = -1;
      for (const arg of args.split(',')) {
        const p = specificityParts(arg);
        const score = p[0] * 10000 + p[1] * 100 + p[2];
        if (score > winScore) { winScore = score; win = p; }
      }
      ids += win[0]; classes += win[1]; elements += win[2];
      return ' ';
    });

    const base = specificityParts(s);
    return (ids + base[0]) * 10000 + (classes + base[1]) * 100 + (elements + base[2]);
  }

  // [ids, classes, elements] for a selector with the functional pseudo-classes
  // already stripped by calcSpecificity. Pseudo-elements (`::before`, and the
  // legacy single-colon `:before` / `:after` / `:first-line` / `:first-letter`)
  // count as ELEMENTS, not classes — the old `:(?!:)` lookahead only excluded
  // the first of the two colons, so `::before` scored as a class (100).
  function specificityParts(sel) {
    let s = sel;
    const pseudoElRe = /::[\w-]+|:(?:before|after|first-line|first-letter)\b/gi;
    const pseudoEls = (s.match(pseudoElRe) || []).length;
    s = s.replace(pseudoElRe, ' ');
    const ids = (s.match(/#[\w-]+/g) || []).length;
    const classes = (s.match(/\.[\w-]+|\[[^\]]+\]|:[\w-]+(?:\([^)]*\))?/g) || []).length;
    const elements = (s.match(/(?:^|[\s>+~])[a-z][\w-]*/gi) || []).length + pseudoEls;
    return [ids, classes, elements];
  }

  // Longhands the panel inspects (AUDIT_PROPS) that a `var()`-bearing shorthand
  // leaves empty: `border: 3px solid var(--x)` is stored as a pending-
  // substitution value, so the `border-color` / `border-width` longhands
  // serialize to "" and only the shorthand carries the token. Read it back off
  // the shorthand instead of reporting the reset's `currentcolor`. (#2195)
  const SHORTHAND_FALLBACK = {
    'border-color': 'border',
    'border-width': 'border',
    'background-color': 'background',
  };

  // Read `prop` off a CSSStyleDeclaration, falling back to its var()-bearing
  // shorthand when the longhand is empty. Returns { value, important } or null.
  function readDeclared(style, prop) {
    let value = style.getPropertyValue(prop);
    let priorityProp = prop;
    if (!value && SHORTHAND_FALLBACK[prop]) {
      priorityProp = SHORTHAND_FALLBACK[prop];
      value = style.getPropertyValue(priorityProp);
    }
    if (!value) return null;
    return { value, important: style.getPropertyPriority(priorityProp) === 'important' };
  }

  // Does candidate `a` outrank `b` under the cascade order applied here:
  // `!important` first, then higher specificity, then later source order.
  function winsCascade(a, b) {
    if (a.important !== b.important) return a.important;
    if (a.specificity !== b.specificity) return a.specificity > b.specificity;
    return a.order >= b.order; // equal specificity → later source order wins
  }

  function getDeclaredValue(el, prop) {
    const candidates = [];

    // Inline styles participate at the highest specificity, but an `!important`
    // rule still beats a non-important inline value — so inline is a candidate,
    // not an unconditional early return.
    if (el.style) {
      const inline = readDeclared(el.style, prop);
      if (inline) {
        candidates.push({ value: inline.value, origin: 'inline', specificity: Infinity, important: inline.important, order: -1 });
      }
    }

    const rules = buildRulesIndex();
    rules.forEach((rule, order) => {
      let matches = false;
      try { matches = el.matches(rule.selector); } catch (e) { return; }
      if (!matches) return;
      const declared = readDeclared(rule.style, prop);
      if (!declared) return;
      // `revert` / `revert-layer` are cascade-control keywords, not design
      // decisions — they explicitly defer to a lower layer/origin. Consumers
      // that bridge Tailwind preflight back to BDS layers (the portal's
      // `[class*="bds-"] { all: revert-layer }`) otherwise mask every real
      // token, surfacing a wall of "revert-layer" in the panel. Skip them so
      // the underlying token rule wins. See brik-client-portal#1615.
      const trimmed = declared.value.trim();
      if (trimmed === 'revert' || trimmed === 'revert-layer') return;
      candidates.push({ value: declared.value, origin: rule.selector, specificity: rule.specificity, important: declared.important, order });
    });

    if (!candidates.length) return null;
    // A blind `>=` ignored `!important` and, on a mis-scored specificity tie,
    // handed the win to source order — masking the higher-specificity rule.
    return candidates.reduce((best, c) => (winsCascade(c, best) ? c : best));
  }

  function extractTokens(raw) {
    const tokens = [];
    const re = /var\(\s*(--[\w-]+)/g;
    let m;
    while ((m = re.exec(raw)) !== null) tokens.push(m[1]);
    return tokens;
  }

  function isValidToken(name) {
    return VALID_TOKEN_PREFIXES.some((p) => name.startsWith(p));
  }

  function findHardcodedFragments(raw) {
    const stripped = raw.replace(/var\([^)]*\)/g, '');
    const hits = [];
    const hex = stripped.match(new RegExp(HEX_RE.source, 'g'));
    if (hex) hits.push(...hex);
    if (RGB_RE.test(stripped)) {
      const rgb = stripped.match(/\brgba?\s*\([^)]+\)/g);
      if (rgb) hits.push(...rgb);
    }
    if (HSL_RE.test(stripped)) {
      const hsl = stripped.match(/\bhsla?\s*\([^)]+\)/g);
      if (hsl) hits.push(...hsl);
    }
    const px = stripped.match(new RegExp(RAW_PX_RE.source, 'g'));
    if (px) hits.push(...px.filter((v) => v !== '0px' && v !== '1px'));
    return hits;
  }

  function auditProp(el, prop) {
    const declared = getDeclaredValue(el, prop);
    const computed = getComputedStyle(el).getPropertyValue(prop).trim();
    if (!declared && !computed) return null;
    const raw = declared ? declared.value : '';
    const tokens = extractTokens(raw);
    const hardcoded = raw ? findHardcodedFragments(raw) : [];
    // Source carries a bds-lint-ignore on this declaration → the linter passes
    // it, so the inspector must too (#2170). Origin 'inline' is never a
    // source-CSS rule and so is never in the exception set.
    const lintIgnored =
      declared && declared.origin && declared.origin !== 'inline'
        ? isLintIgnored(declared.origin, prop)
        : false;
    return {
      prop,
      declared: declared ? declared.value.trim() : null,
      origin: declared ? declared.origin : null,
      computed,
      tokens,
      unknownTokens: tokens.filter((t) => !isValidToken(t)),
      hardcoded,
      lintIgnored,
      // Equal-to-the-linter's-error-set (#2170): a raw value is a violation only
      // when it is NOT a sanctioned bds-lint-ignore exception AND the build is
      // ready (stylesheets resolved — otherwise the read is a mid-build phantom).
      // A hardcoded fragment is a violation even when a token is co-present in
      // the same shorthand — `2px solid var(--x)` must still flag the raw `2px`.
      // The old `tokens.length === 0` suppressed it (#2197 G). Linter parity
      // holds: findHardcodedFragments strips var() and already excludes 0px/1px,
      // so a lone token (hardcoded.length === 0) still never flags.
      isViolation:
        hardcoded.length > 0 && !lintIgnored && auditReady(),
    };
  }

  function auditEl(el) {
    const results = [];
    for (const prop of AUDIT_PROPS) {
      const r = auditProp(el, prop);
      if (r && (r.declared || r.tokens.length || r.hardcoded.length)) {
        results.push(r);
      }
    }
    return collapseLonghands(results);
  }

  // Hide longhand rows when shorthand carries the value (or both are 0).
  function collapseLonghands(audits) {
    const byProp = new Map(audits.map((a) => [a.prop, a]));
    const drop = new Set();
    for (const [shorthand, longhands] of Object.entries(LONGHAND_GROUPS)) {
      const sh = byProp.get(shorthand);
      // Drop noise: longhand rows that are 0px with no token, when shorthand exists.
      for (const lh of longhands) {
        const row = byProp.get(lh);
        if (!row) continue;
        const isNoise = row.declared === '0px' && row.tokens.length === 0 && row.hardcoded.length === 0;
        if (isNoise && sh) drop.add(lh);
      }
      // Also drop the shorthand row if it's just "0px" but a longhand has the real value.
      if (sh && sh.declared === '0px' && sh.tokens.length === 0) {
        const longhandHasValue = longhands.some((lh) => {
          const row = byProp.get(lh);
          return row && (row.tokens.length > 0 || row.hardcoded.length > 0);
        });
        if (longhandHasValue) drop.add(shorthand);
      }
    }
    return audits.filter((a) => !drop.has(a.prop));
  }

  // ── Missing-type gate (#2119) ────────────────────────────────────────────
  //
  // A text-holding leaf slot (`__content`/`__body`/`__description`/`__caption`,
  // and equally any other leaf) that declares only `color` or only a margin/
  // padding never trips `scripts/lint-tokens.js` or `auditProp` above — both
  // flag a raw value that IS present in source, and this bug is the opposite
  // shape: a declaration that is ABSENT. The root case (Collapsible, #2118)
  // revealed content that inherited the browser's UA serif because no
  // ancestor ever set a token font-family. The only way to catch an absence
  // is to read the COMPUTED value after the whole cascade has run, so this
  // gate is deliberately runtime, not source-static.
  //
  // Design:
  //  - "text-holding leaf" = an element with at least one direct child TEXT
  //    node carrying non-whitespace content (isTextLeaf). A pure-layout
  //    wrapper that only holds ELEMENT children (its own text-bearing
  //    children own their own tokens) is not a leaf and is skipped — this is
  //    what quietly clears ActivityTimeline `__content`, FileCard `__body`,
  //    Features `__content`, Cta `__message`, and the four "arbitrary caller
  //    content" wrappers (SheetSection/DataSection/MediaBand `__content`,
  //    Sheet `__body`) found by the #2119 audit without a single exception:
  //    none of them hold a direct text node, so none is ever asked to carry
  //    a font declaration in the first place.
  //  - The "token value" a computed style must match is resolved AT RUNTIME
  //    from `:root`'s own computed style, not hardcoded — so a per-theme
  //    override (a client theme swapping the body/heading/label face) is
  //    honored automatically instead of the gate silently going stale.
  //  - font-family is the ONLY signal that decides `isViolation`. It is the
  //    robust one: the UA fallback (serif) reads nothing like any BDS token
  //    family, so there is no ambiguity. font-size is NOT reliable the same
  //    way — `--body-md` resolves to the same 16px the UA default also
  //    happens to use for body text, so a raw computed-size compare cannot
  //    tell "tokenized at --body-md" from "never tokenized, sitting on the UA
  //    16px default" without false-flagging every legitimately-tokenized
  //    16px leaf. font-size is exposed on the result for a human/agent to
  //    eyeball, but never flips `isViolation` on its own. This is a
  //    deliberate, documented tradeoff, not an oversight.
  //  - Gated behind the SAME two primitives #2170 introduced rather than a
  //    third parallel baseline: `auditReady()` (withholds until the build is
  //    fully resolved and the lint-ignore baseline has loaded) and
  //    `isLintIgnored(selector, 'font-family')` (drops a known, tracked
  //    exception — e.g. CollapsibleCard's `__content`, deliberately left
  //    unfixed for its own cleanup issue per #2119's own scope split; see
  //    the `setLintIgnores` call sites that register it).

  // Only the three BODY/HEADING/LABEL font-family tokens per #2119's scope
  // (display/subtitle families exist in tokens/figma-tokens.css too, but the
  // ticket named exactly these three — today all five resolve to the same
  // literal "Poppins", so this is not a gap in practice; broadening it is a
  // one-line follow-up if a theme ever diverges display/subtitle from body).
  const TYPE_FAMILY_VARS = [
    '--font-family-body', '--font-family-heading', '--font-family-label',
  ];

  // Every body/heading/label/subtitle/display SIZE token in
  // tokens/figma-tokens.css. Diagnostic only (see the design note above) —
  // never gates `isViolation`.
  const TYPE_SIZE_VARS = [
    '--body-tiny', '--body-xs', '--body-sm', '--body-md', '--body-lg', '--body-xl', '--body-huge',
    '--heading-tiny', '--heading-sm', '--heading-md', '--heading-lg', '--heading-xl', '--heading-xxl', '--heading-huge',
    '--label-tiny', '--label-xs', '--label-sm', '--label-md', '--label-lg', '--label-xl',
    '--subtitle-sm', '--subtitle-md', '--subtitle-lg',
    '--display-sm', '--display-md', '--display-lg', '--display-xl',
  ];

  // Read a custom property's CASCADE-RESOLVED value off `:root` (chained
  // `var()` references — e.g. `--body-md: var(--font-size-100)` — resolve
  // through, so this returns the real px/family value, not the raw alias).
  function rootTokenValue(varName) {
    return getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
  }

  function resolveTokenFamilies() {
    return TYPE_FAMILY_VARS.map(rootTokenValue).filter(Boolean);
  }

  function resolveTokenSizes() {
    const set = new Set();
    for (const v of TYPE_SIZE_VARS) {
      const val = rootTokenValue(v);
      if (val) set.add(val);
    }
    return set;
  }

  // True when the element's own font-family (a full stack, e.g.
  // `Poppins, system-ui, sans-serif`) contains at least one of the resolved
  // token families. Substring/case-insensitive: computed serialization may or
  // may not quote a face name, and may carry the whole fallback stack.
  function familyMatchesToken(computedFamily, tokenFamilies) {
    if (!computedFamily) return false;
    const lower = computedFamily.toLowerCase();
    return tokenFamilies.some((f) => f && lower.includes(f.toLowerCase()));
  }

  // A text-holding leaf: at least one direct child TEXT node with
  // non-whitespace content. A wrapper holding only ELEMENT children (its own
  // text-bearing descendants own their own tokens) is NOT a leaf — skip it
  // rather than mis-flag a pure layout/composition slot.
  function isTextLeaf(el) {
    if (!el || el.nodeType !== 1) return false;
    for (const child of el.childNodes) {
      if (child.nodeType === 3 && child.textContent && child.textContent.trim() !== '') {
        return true;
      }
    }
    return false;
  }

  // Fallback attribution when there is no CSSOM declaration to point at at
  // all — the exact "missing declaration" case this gate exists for.
  // `getDeclaredValue` only matches rules whose selector matches `el`
  // directly, so the common break (nothing, anywhere, ever set font-family)
  // yields no origin. The element's own class list is how these leaf slots
  // are named in source CSS (`.bds-collapsible-card__content { … }`), so it
  // is the natural exception-baseline key for a missing rule.
  function ownClassSelector(el) {
    const classes = Array.from(el.classList || []);
    return classes.length ? '.' + classes.join('.') : null;
  }

  function auditMissingType(el) {
    if (!isTextLeaf(el)) return null;

    const cs = getComputedStyle(el);
    const computed = cs.getPropertyValue('font-family').trim();
    const tokenFamilies = resolveTokenFamilies();
    const matchesToken = familyMatchesToken(computed, tokenFamilies);

    // Prefer the real declaring rule when one directly matches `el`; fall
    // back to the element's own class selector only for the true "nothing
    // ever declared this" case (see ownClassSelector above).
    const declared = getDeclaredValue(el, 'font-family');
    const winningSelector = declared ? declared.origin : ownClassSelector(el);
    const lintIgnored =
      winningSelector && winningSelector !== 'inline'
        ? isLintIgnored(winningSelector, 'font-family')
        : false;

    return {
      prop: 'font-family',
      computed,
      // Diagnostic only — see the design note above for why font-size never
      // gates isViolation.
      sizeComputed: cs.getPropertyValue('font-size').trim(),
      tokenSizes: resolveTokenSizes(),
      isViolation: !matchesToken && !lintIgnored && auditReady(),
    };
  }

  // ── UI: toolbar + outline + pill + panel ────────────────────────────────
  let toolbarEl, toggleBtn, outlineEl, pillEl, panelEl;

  function buildToolbar() {
    toolbarEl = document.createElement('div');
    toolbarEl.className = 'bi-toolbar';

    toggleBtn = document.createElement('button');
    toggleBtn.className = 'bi-btn';
    toggleBtn.type = 'button';
    toggleBtn.innerHTML = `${iconCrosshair()} Inspect`;
    toggleBtn.addEventListener('click', toggleActive);
    toolbarEl.appendChild(toggleBtn);

    // Scan capability moved into the locked-panel actions (Copy report /
    // Scan page). Standalone toolbar only needs the Inspect toggle.

    document.body.appendChild(toolbarEl);
  }

  // DevBar integration: if the DevBar shell is present (or loading soon),
  // register a single Inspect slot. The page-wide Scan capability lives
  // inside the locked Inspect panel (see scanAndCopyReport action button)
  // rather than as its own top-level slot.
  function registerWithDevBar() {
    const def = [
      {
        id: 'inspect',
        label: 'Inspect',
        icon: iconCrosshair(),
        order: 20,
        onActivate: () => { if (!active) toggleActive(); },
        onDeactivate: () => { if (active) toggleActive(); },
      },
    ];
    if (window.BrikDevBar) {
      for (const d of def) window.BrikDevBar.register(d);
      return true;
    }
    // Queue for devbar.js if it loads after us.
    window.BrikDevBarQueue = window.BrikDevBarQueue || [];
    for (const d of def) window.BrikDevBarQueue.push(d);
    // If a BrikDevBar never materializes, we fall back to the standalone toolbar.
    return false;
  }

  function iconCrosshair() {
    return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><line x1="12" y1="3" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="21"/><line x1="3" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="21" y2="12"/></svg>';
  }

  function iconScan() {
    return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/><line x1="3" y1="12" x2="21" y2="12"/></svg>';
  }

  function toggleActive() {
    active = !active;
    // Standalone toolbar (only exists if DevBar wasn't present at init)
    if (toggleBtn) {
      toggleBtn.classList.toggle('bi-btn--active', active);
      toggleBtn.innerHTML = active ? `${iconCrosshair()} Inspecting…` : `${iconCrosshair()} Inspect`;
    }
    // Sync DevBar slot active state so the pill visually matches.
    if (window.BrikDevBar?.isRegistered?.('inspect')) {
      window.BrikDevBar.setActive('inspect', active);
    }
    if (!active) {
      clearOutline();
      hidePill();
      closePanel();
      hoveredEl = null;
      lockedEl = null;
    }
  }

  function ensureOutline() {
    if (outlineEl) return outlineEl;
    outlineEl = document.createElement('div');
    outlineEl.className = 'bi-outline';
    document.body.appendChild(outlineEl);
    return outlineEl;
  }

  function drawOutline(el, locked) {
    if (!el) return clearOutline();
    const o = ensureOutline();
    const r = el.getBoundingClientRect();
    o.style.top = `${r.top}px`;
    o.style.left = `${r.left}px`;
    o.style.width = `${r.width}px`;
    o.style.height = `${r.height}px`;
    o.classList.toggle('bi-outline--locked', !!locked);
    o.style.display = 'block';
  }

  function clearOutline() {
    if (outlineEl) outlineEl.style.display = 'none';
  }

  function showPill(el, x, y) {
    if (!pillEl) {
      pillEl = document.createElement('div');
      pillEl.className = 'bi-pill';
      document.body.appendChild(pillEl);
    }
    const desc = describeEl(el);
    const bds = findBdsRoot(el);
    const r = el.getBoundingClientRect();
    const violations = auditEl(el).filter((a) => a.isViolation).length;
    pillEl.innerHTML = `
      <span class="bi-pill__tag">${desc.tag}</span><span class="bi-pill__class">${desc.classes.length ? '.' + desc.classes.join('.') : ''}</span>
      ${bds ? '<span class="bi-pill__badge bi-pill__badge--bds">BDS</span>' : ''}
      ${violations ? `<span class="bi-pill__badge bi-pill__badge--warn">${violations}</span>` : ''}
      <br><span class="bi-pill__size">${Math.round(r.width)} × ${Math.round(r.height)}${ascentDepth > 0 ? ` · ↑${ascentDepth}` : ''}</span>
    `;
    const pad = 14;
    let px = x + pad, py = y + pad;
    const pw = 340, ph = 60;
    if (px + pw > window.innerWidth) px = x - pw - pad;
    if (py + ph > window.innerHeight) py = y - ph - pad;
    pillEl.style.left = `${px}px`;
    pillEl.style.top = `${py}px`;
    pillEl.style.display = 'block';
  }

  function hidePill() {
    if (pillEl) pillEl.style.display = 'none';
  }

  function openPanel(el) {
    const desc = describeEl(el);
    const bds = findBdsRoot(el);
    const bem = !bds ? findBemRoot(el) : null;
    const r = el.getBoundingClientRect();
    const audits = auditEl(el);
    const violations = audits.filter((a) => a.isViolation);
    const tokenUses = audits.filter((a) => a.tokens.length > 0);
    const unknownTokens = audits.flatMap((a) => a.unknownTokens);

    if (!panelEl) {
      panelEl = document.createElement('div');
      panelEl.className = 'bi-panel';
      document.body.appendChild(panelEl);
    }

    const componentBlock = bds?.meta ? renderComponentBlock(bds.meta) : '';
    const a11y = auditA11y(el);
    const a11yErrors = a11y.issues.filter((i) => i.severity === 'error').length;

    panelEl.innerHTML = `
      <div class="bi-panel__header">
        <div class="bi-panel__title">${escapeHtml(desc.selector)}</div>
        <button class="bi-panel__close" type="button" aria-label="Close">×</button>
      </div>
      <div class="bi-panel__section">
        <div class="bi-summary">
          ${ascentPath.length > 1 ? `<span class="bi-stat" title="Selection depth — ArrowUp ascends to parent, ArrowDown descends to leaf">↕ depth ${ascentDepth + 1}/${ascentPath.length}</span>` : ''}
          <span class="bi-stat">${Math.round(r.width)} × ${Math.round(r.height)}</span>
          ${bds ? `<span class="bi-stat bi-stat--ok">${bds.meta ? escapeHtml(bds.meta.name) : 'BDS · ' + escapeHtml(bds.component)}${bds.meta?.status && bds.meta.status !== 'stable' ? ' · ' + escapeHtml(bds.meta.status) : ''}</span>` : ''}
          ${bem ? `<span class="bi-stat">BEM · ${escapeHtml(bem.component)}</span>` : ''}
          <span class="bi-stat ${tokenUses.length ? 'bi-stat--ok' : ''}">${tokenUses.length} tokens</span>
          <span class="bi-stat ${violations.length ? 'bi-stat--warn' : 'bi-stat--ok'}">${violations.length} violations</span>
          <span class="bi-stat ${a11yErrors ? 'bi-stat--warn' : 'bi-stat--ok'}" title="Accessibility issues">${a11yErrors} a11y</span>
        </div>
        <div>${desc.classes.map((c) => `<span class="bi-class-chip ${c.startsWith('bds-') ? 'bi-class-chip--bds' : ''}">${escapeHtml(c)}</span>`).join('')}</div>
      </div>
      ${componentBlock}
      ${renderA11yBlock(a11y)}
      ${unknownTokens.length ? `
      <div class="bi-panel__section">
        <div class="bi-panel__section-title">Unknown tokens</div>
        ${unknownTokens.map((t) => `<div class="bi-row"><span class="bi-token bi-token--unknown">${escapeHtml(t)}</span></div>`).join('')}
      </div>` : ''}
      <div class="bi-panel__section">
        <div class="bi-panel__section-title">Properties</div>
        ${audits.map(renderAuditRow).join('')}
      </div>
      <div class="bi-actions">
        <button class="bi-action-btn" type="button" data-action="report-feedback" title="Report feedback on this element">Feedback</button>
        <button class="bi-action-btn" type="button" data-action="copy-selector">Copy selector</button>
        <button class="bi-action-btn" type="button" data-action="copy-report">Copy report</button>
        <button class="bi-action-btn" type="button" data-action="scan-page">Scan page</button>
      </div>
    `;

    panelEl.querySelector('.bi-panel__close').addEventListener('click', closePanel);
    panelEl.querySelector('[data-action="copy-selector"]').addEventListener('click', () => {
      navigator.clipboard.writeText(desc.selector);
    });
    panelEl.querySelector('[data-action="copy-report"]').addEventListener('click', () => {
      const report = {
        selector: desc.selector,
        bdsComponent: bds?.component || null,
        bemComponent: bem?.component || null,
        size: { w: r.width, h: r.height },
        audits,
      };
      navigator.clipboard.writeText(JSON.stringify(report, null, 2));
    });
    panelEl.querySelector('[data-action="scan-page"]').addEventListener('click', () => {
      scanAndCopyReport();
    });
    // Emit element context for any feedback surface listening for
    // `brik:inspect:report` (e.g. the product app's DevFeedbackWidget), then
    // hand off: exit inspect mode so the inspector stops intercepting page
    // clicks (its capture-phase onClick preventDefaults every non-chrome click)
    // and the user can interact with the feedback form that just opened. If no
    // host is wired (standalone mockup pages), the event is simply unobserved.
    const reportBtn = panelEl.querySelector('[data-action="report-feedback"]');
    reportBtn.addEventListener('click', () => {
      emitReport(el);
      if (active) toggleActive();
    });
    panelEl.style.display = 'block';
  }

  function renderAuditRow(a) {
    const parts = [];
    if (a.declared) {
      let val = escapeHtml(a.declared);
      val = val.replace(/var\(\s*(--[\w-]+)/g, (m, token) => {
        const tokenMeta = findTokenMeta(token);
        const cls = isValidToken(token) ? 'bi-token' : 'bi-token bi-token--unknown';
        const titleAttr = tokenMeta
          ? ` title="${escapeHtml(tokenMeta.value)}${tokenMeta.description ? ' \u2014 ' + escapeHtml(tokenMeta.description) : ''}"`
          : '';
        return `var(<span class="${cls}"${titleAttr}>${token}</span>`;
      });
      // A bds-lint-ignore'd raw value is a sanctioned exception, not a
      // violation (#2170) — show it plainly rather than in violation red.
      if (!a.lintIgnored) {
        for (const h of a.hardcoded) {
          val = val.replace(h, `<span class="bi-hardcoded">${escapeHtml(h)}</span>`);
        }
      }
      parts.push(val);
    }
    const swatch = isColorProp(a.prop) && a.computed ? `<span class="bi-swatch" style="background:${a.computed}"></span>` : '';
    const computedStr = a.computed && a.computed !== a.declared ? `<span class="bi-computed">→ ${escapeHtml(a.computed)}</span>` : '';
    return `
      <div class="bi-row">
        <span class="bi-row__label">${a.prop}</span>
        <span class="bi-row__value">${swatch}${parts.join('') || `<span class="bi-computed">${escapeHtml(a.computed)}</span>`}${computedStr}</span>
      </div>
    `;
  }

  function renderComponentBlock(meta) {
    if (!meta) return '';
    const statusClass =
      meta.status === 'deprecated' ? 'bi-stat--warn'
        : meta.status === 'experimental' ? '' // neutral
        : 'bi-stat--ok';
    const intro = meta.introduced_in ? ` · v${escapeHtml(meta.introduced_in)}` : '';
    const deprecated = meta.deprecated_in
      ? ` · deprecated v${escapeHtml(meta.deprecated_in)}${meta.replaced_by ? ', use ' + escapeHtml(meta.replaced_by) : ''}`
      : '';
    // Only emit the Storybook link when we can verify the story ID resolves
    // on the live Storybook. Manifest paths can go stale (components move
    // between categories, stories get renamed) and a 404 link is worse than
    // no link. If the index hasn't loaded yet, suppress the button rather
    // than render a maybe-broken one.
    const storybookHref = resolveStorybookHref(meta.storybook_url);
    const a11yNotes = (meta.a11y?.notes ?? [])
      .map((n) => `<div class="bi-row"><span class="bi-row__value" style="flex:1;color:#4f4f4f;">\u267F ${escapeHtml(n)}</span></div>`)
      .join('');
    return `
      <div class="bi-panel__section">
        <div class="bi-panel__section-title">Component</div>
        <div class="bi-summary">
          <span class="bi-stat ${statusClass}">${escapeHtml(meta.status)}${intro}${deprecated}</span>
          ${storybookHref ? `<a class="bi-stat" href="${escapeHtml(storybookHref)}" target="_blank" rel="noopener" style="text-decoration:none;">Open in Storybook \u2197</a>` : ''}
        </div>
        ${meta.description ? `<div class="bi-row"><span class="bi-row__value" style="flex:1;">${escapeHtml(meta.description)}</span></div>` : ''}
        ${a11yNotes}
      </div>
    `;
  }

  function renderA11yBlock(a11y) {
    const { contrast, issues } = a11y;
    if (!contrast && issues.length === 0) return '';

    const contrastBadge = contrast
      ? `<span class="bi-stat ${contrast.passesAA ? 'bi-stat--ok' : 'bi-stat--warn'}" title="${contrast.fg} on ${contrast.bg}">WCAG AA contrast ${contrast.rounded}:1${contrast.isLarge ? ' (lg)' : ''} \u2014 needs ${contrast.threshold}:1</span>`
      : '';
    const aaaBadge = contrast?.passesAAA
      ? `<span class="bi-stat bi-stat--ok">AAA \u2713</span>`
      : '';

    const issueRows = issues.map((i) => {
      const color = i.severity === 'error' ? '#d83a3a' : i.severity === 'warn' ? '#e3a335' : '#828282';
      return `
        <div class="bi-row">
          <span class="bi-row__label" style="color:${color};flex:0 0 60px;">${escapeHtml(i.severity)}</span>
          <span class="bi-row__value">${escapeHtml(i.message)} <span class="bi-computed">[${escapeHtml(i.code)}]</span></span>
        </div>
      `;
    }).join('');

    return `
      <div class="bi-panel__section">
        <div class="bi-panel__section-title">Accessibility</div>
        ${(contrastBadge || aaaBadge) ? `<div class="bi-summary" style="margin-bottom:8px;">${contrastBadge}${aaaBadge}</div>` : ''}
        ${issueRows || (issues.length === 0 && contrast?.passesAA ? '<div class="bi-row"><span class="bi-row__value" style="color:${T.statusOk};">No runtime accessibility issues detected.</span></div>' : '')}
      </div>
    `;
  }

  // Storybook base URL — defaults to BDS's published Chromatic build
  // (primary visual review tool). Override via data-storybook-base to point
  // at localhost:6006 for local dev, storybook.brikdesigns.com for the
  // Netlify mirror, or a branch-specific Chromatic build URL.
  function getStorybookBase() {
    return script?.getAttribute('data-storybook-base')
      || 'https://69b8918cac3056b39424d5d3-jtcwcnhshz.chromatic.com';
  }

  // Build a Storybook deep link, or return '' if the target story ID isn't
  // in the live index. Accepts either a relative path (`/?path=/story/<id>`)
  // or an absolute URL. When we can't verify (index not loaded), we return
  // '' to hide the button rather than link to a 404.
  function resolveStorybookHref(storybookUrl) {
    if (!storybookUrl) return '';
    if (/^https?:\/\//i.test(storybookUrl)) return storybookUrl;
    const match = storybookUrl.match(/\/story\/([^&?#]+)/);
    const storyId = match ? match[1] : null;
    if (!storyId) return '';
    if (storybookIndex && !storybookIndex.has(storyId)) return '';
    if (!storybookIndex) return ''; // unverified — hide until index loads
    const base = getStorybookBase().replace(/\/+$/, '');
    return `${base}${storybookUrl}`;
  }

  function isColorProp(prop) {
    return prop === 'color' || prop.includes('background') || prop.includes('border-color');
  }

  function closePanel() {
    if (panelEl) panelEl.style.display = 'none';
    lockedEl = null;
    drawOutline(hoveredEl, false);
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  // ── Page-wide scan ──────────────────────────────────────────────────────
  function scanAndCopyReport() {
    const all = document.querySelectorAll('body *');
    const violations = [];
    let scanned = 0;
    let bdsCount = 0;
    for (const el of all) {
      if (isIgnoredEl(el)) continue;
      scanned++;
      const bds = findBdsRoot(el);
      if (bds && bds.root === el) bdsCount++;
      const audits = auditEl(el);
      const elViolations = audits.filter((a) => a.isViolation);
      if (elViolations.length > 0) {
        violations.push({
          selector: describeEl(el).selector,
          bdsComponent: bds?.component || null,
          violations: elViolations.map((v) => ({
            prop: v.prop, declared: v.declared,
            hardcoded: v.hardcoded, computed: v.computed,
          })),
        });
      }
    }
    // Readiness guard (#2170): auditProp withholds violations until the
    // stylesheets resolve AND the lint-ignore baseline loads, so a scan run
    // before either reports zero. Say which, rather than let "0 violations"
    // read as a clean pass.
    const sheetsReady = stylesheetsResolved();
    const baselineReady = lintIgnoreIndex !== null;
    const ready = sheetsReady && baselineReady;
    const notReadyReason = !sheetsReady
      ? 'stylesheets unresolved (build not ready)'
      : 'lint-ignore baseline not loaded (manifest pending)';
    const report = {
      url: location.href,
      scannedAt: new Date().toISOString(),
      buildReady: ready,
      totals: {
        scanned,
        bdsComponents: bdsCount,
        elementsWithViolations: violations.length,
        totalViolations: violations.reduce((n, v) => n + v.violations.length, 0),
      },
      violations,
    };
    navigator.clipboard.writeText(JSON.stringify(report, null, 2));
    alert(
      `Brik Inspect — Page scan\n\n` +
      (ready ? '' : `⚠ Not ready — ${notReadyReason}; violations withheld.\n\n`) +
      `${scanned} elements scanned\n` +
      `${bdsCount} BDS components found\n` +
      `${report.totals.totalViolations} violations across ${violations.length} elements\n\n` +
      `Full report copied to clipboard.`
    );
  }

  // ── Ancestor ascent (#2196) ─────────────────────────────────────────────
  // Build the inspectable ancestor chain for a pointer event, leaf→root. Uses
  // composedPath() (crosses shadow boundaries; the only path that survives an
  // event retargeted off a shadow host), Element nodes only, dropping inspector
  // chrome and stopping at <body>. Falls back to a parentElement walk when no
  // event path is available (keydown-driven re-selection has no fresh event).
  function buildAscentPath(target, event) {
    const raw = event && typeof event.composedPath === 'function' ? event.composedPath() : null;
    const chain = [];
    if (raw && raw.length) {
      for (const node of raw) {
        if (!node || node.nodeType !== 1) continue; // drop document / window
        if (isIgnoredEl(node)) continue;
        chain.push(node);
        if (node === document.body) break;
      }
    } else {
      let node = target;
      while (node && node.nodeType === 1) {
        if (!isIgnoredEl(node)) chain.push(node);
        if (node === document.body) break;
        node = node.parentElement;
      }
    }
    return chain;
  }

  // The element at the current ascent depth, clamped to the path.
  function currentAscentEl() {
    if (!ascentPath.length) return null;
    return ascentPath[Math.min(ascentDepth, ascentPath.length - 1)] || null;
  }

  // ── Event handlers ──────────────────────────────────────────────────────
  function onMouseMove(e) {
    if (!active || lockedEl) return;
    const el = e.target;
    if (!el || isIgnoredEl(el)) return;
    // New pointer target rebuilds the chain and drops back to the leaf; the
    // arrow keys then walk it in place without the pointer moving.
    ascentPath = buildAscentPath(el, e);
    ascentDepth = 0;
    hoveredEl = currentAscentEl() || el;
    drawOutline(hoveredEl, false);
    showPill(hoveredEl, e.clientX, e.clientY);
  }

  function onClick(e) {
    if (!active) return;
    const el = e.target;
    if (!el || isIgnoredEl(el)) return;
    e.preventDefault();
    e.stopPropagation();
    // Preserve any ancestor the user ascended to while hovering (the click's
    // leaf target still sits at depth 0 of the live chain); only rebuild when
    // the click landed outside the current chain.
    if (!ascentPath.length || ascentPath.indexOf(el) === -1) {
      ascentPath = buildAscentPath(el, e);
      ascentDepth = 0;
    }
    lockedEl = currentAscentEl() || el;
    hidePill();
    drawOutline(lockedEl, true);
    openPanel(lockedEl);
  }

  function onKey(e) {
    if (e.key === 'Escape') {
      if (lockedEl) closePanel();
      else if (active) toggleActive();
    }
    // Ancestor ascent (#2196): ArrowUp climbs composedPath toward the root,
    // ArrowDown descends back toward the pointer leaf — mirrors devtools
    // DOM-tree navigation (operator-decided 2026-08-30). Re-targets whichever
    // selection is live: the locked panel, else the hover outline.
    if ((e.key === 'ArrowUp' || e.key === 'ArrowDown') && active && ascentPath.length) {
      if (!lockedEl && !hoveredEl) return;
      e.preventDefault();
      const max = ascentPath.length - 1;
      ascentDepth = e.key === 'ArrowUp'
        ? Math.min(ascentDepth + 1, max)
        : Math.max(ascentDepth - 1, 0);
      const el = currentAscentEl();
      if (!el) return;
      if (lockedEl) {
        lockedEl = el;
        drawOutline(el, true);
        openPanel(el);
      } else {
        hoveredEl = el;
        drawOutline(el, false);
        // No pointer coords on a keydown — anchor the pill to the element.
        const r = el.getBoundingClientRect();
        showPill(el, r.left, r.top);
      }
    }
    if ((e.key === 'i' || e.key === 'I') && (e.metaKey || e.ctrlKey) && e.shiftKey) {
      e.preventDefault();
      toggleActive();
    }
  }

  function onScrollOrResize() {
    if (lockedEl) drawOutline(lockedEl, true);
    else if (hoveredEl && active) drawOutline(hoveredEl, false);
  }

  // ── Init ────────────────────────────────────────────────────────────────
  function init() {
    injectStyles();
    // A host (e.g. the BDS Storybook InspectWidget) may own the DevBar slot so
    // its mount/unmount can add and remove Inspect in step with a UI toggle.
    // When it signals host-managed mode, skip self-registration and let the
    // host register the slot + drive activation via window.BrikInspect.setActive.
    if (!window.__BRIK_INSPECT_DEVBAR_HOST_MANAGED__) registerWithDevBar();
    // Fetch the BDS inspector manifest + live Storybook index in parallel.
    // Both are best-effort: missing manifest → class-name-only behavior;
    // missing index → Storybook deep-link button is suppressed until
    // (or unless) the index resolves.
    loadManifest();
    loadStorybookIndex();
    // Fall back to standalone toolbar after a tick if the DevBar never
    // renders (e.g. devbar.js wasn't injected on this page).
    setTimeout(() => {
      if (!window.BrikDevBar) buildToolbar();
    }, 80);
    document.addEventListener('mousemove', onMouseMove, true);
    document.addEventListener('click', onClick, true);
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onScrollOrResize, true);
    window.addEventListener('resize', onScrollOrResize);
    // Activate on load only when the URL explicitly requested it (`?inspect=1`).
    // Otherwise hover stays off until the user toggles via DevBar or shortcut.
    if (URL_ENABLED) toggleActive();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
