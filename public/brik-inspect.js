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
    '--icon-', '--size-', '--content-width-', '--aspect-', '--blur-radius-',
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
  // Names match figma-tokens.css exactly; values inlined for zero-dependency
  // deploy. Mirror the T block in feedback-widget.js — keep them in sync.
  const T = {
    // Primitives
    colorPoppyLight:       '#e35335', // --color-poppy-light
    colorPoppyDark:        '#b0351b', // --color-poppy-dark
    colorPoppyLightest:    '#ffefeb', // --color-poppy-lightest
    colorPoppyLighter:     '#ffa693', // --color-poppy-lighter
    colorGrayscaleWhite:   '#ffffff', // --color-grayscale-white
    colorGrayscaleLightest:'#f7f7f7', // --color-grayscale-lightest
    colorGrayscaleLighter: '#e0e0e0', // --color-grayscale-lighter
    colorGrayscaleLight:   '#bdbdbd', // --color-grayscale-light
    colorGrayscaleDark:    '#828282', // --color-grayscale-dark
    colorGrayscaleDarker:  '#4f4f4f', // --color-grayscale-darker
    colorGrayscaleDarkest: '#333333', // --color-grayscale-darkest
    colorTanLightest:      '#f1f0ec', // --color-tan-lightest
    // Semantic surfaces (light theme — inspector mirrors feedback widget)
    backgroundBrandPrimary: '#e35335', // --background-brand-primary
    interactionBrandHover:  '#b0351b', // --interaction-background-brand-primary-hover
    textPrimary:   '#333333', // --text-primary
    textSecondary: '#4f4f4f', // --text-secondary
    textMuted:     '#828282', // --text-muted
    textInverse:   '#ffffff', // --text-inverse
    borderPrimary: '#e0e0e0', // --border-primary
    // Status (kept neutral to BDS — used for OK/warn states in panel)
    statusOk:   '#3aa86b',
    statusWarn: '#e3a335',
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
  let rulesIndex = null;

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
    .bi-btn--active { background: ${T.backgroundBrandPrimary}; }
    .bi-btn--active:hover { background: ${T.interactionBrandHover}; }

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
      color: ${T.colorGrayscaleLight};
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
    .bi-pill__badge--warn { background: ${T.backgroundBrandPrimary}; color: ${T.colorGrayscaleWhite}; }

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
      color: ${T.textMuted};
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
      color: ${T.textMuted};
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
      color: ${T.textMuted};
      flex: 0 0 110px;
      font-size: ${T.fontSizeSm};
    }
    .bi-row__value {
      flex: 1; min-width: 0;
      font-size: ${T.fontSizeSm};
      word-break: break-word;
      color: ${T.textPrimary};
    }
    .bi-token { color: ${T.backgroundBrandPrimary}; font-weight: ${T.fontWeightMedium}; }
    .bi-token--unknown { color: ${T.statusWarn}; }
    .bi-computed {
      color: ${T.textMuted};
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
    .bi-stat--ok   { background: rgba(58,168,107,0.12); color: #1f7a4a; }

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
      background: rgba(58,168,107,0.12); color: #1f7a4a;
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
      background: ${T.backgroundBrandPrimary};
      color: ${T.colorGrayscaleWhite};
      border-color: ${T.backgroundBrandPrimary};
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
    while (node && node !== document.documentElement) {
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
    const text = (el.textContent || '').trim();
    if (text.length > 0) return true;
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

  function sectionLabel(section) {
    // Mockup convention first: "section section--hero" → "hero".
    const typeMatch = section.className.match(/section--([a-z0-9-]+)/i);
    if (typeMatch) return typeMatch[1];

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

    const section = el.closest('section[class*="section--"], [class*="section--"]');
    if (section) {
      const typeMatch = section.className.match(/section--([a-z0-9-]+)/i);
      if (typeMatch) meta.section_type = typeMatch[1];

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

      // 1-based position among all `section--` blocks in document order.
      const all = document.querySelectorAll('section[class*="section--"]');
      const idx = Array.from(all).indexOf(section);
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

    const section =
      el.closest('[class*="section--"]') ||
      el.closest('section, article, main, [role="region"], [data-section]');
    if (section) {
      const label = sectionLabel(section);
      if (label) ctx.section = label;
    }

    // Component detection the inspector already owns (block class, e.g. "bds-button").
    const bds = findBdsRoot(el);
    if (bds) ctx.component = bds.component;

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
    // Exposed for regression tests (cascade-keyword skip — #1615). Not part of
    // the public surface; consumers use detectContext / the report event.
    window.BrikInspect.getDeclaredValue = getDeclaredValue;
  }

  // ── Stylesheet rule index ───────────────────────────────────────────────
  function buildRulesIndex() {
    if (rulesIndex) return rulesIndex;
    const rules = [];
    for (const sheet of Array.from(document.styleSheets)) {
      let sheetRules;
      try { sheetRules = sheet.cssRules; } catch (e) { continue; }
      if (!sheetRules) continue;
      walkRules(sheetRules, rules);
    }
    rulesIndex = rules;
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
    const ids = (sel.match(/#[\w-]+/g) || []).length;
    const classes = (sel.match(/\.[\w-]+|\[[^\]]+\]|:(?!:)[\w-]+(?:\([^)]*\))?/g) || []).length;
    const elements = (sel.match(/(?:^|[\s>+~])([a-z][\w-]*)/gi) || []).length;
    return ids * 10000 + classes * 100 + elements;
  }

  function getDeclaredValue(el, prop) {
    if (el.style) {
      const inline = el.style.getPropertyValue(prop);
      if (inline) return { value: inline, origin: 'inline' };
    }
    const rules = buildRulesIndex();
    let best = null;
    for (const rule of rules) {
      let matches = false;
      try { matches = el.matches(rule.selector); } catch (e) { continue; }
      if (!matches) continue;
      const val = rule.style.getPropertyValue(prop);
      if (!val) continue;
      // `revert` / `revert-layer` are cascade-control keywords, not design
      // decisions — they explicitly defer to a lower layer/origin. Consumers
      // that bridge Tailwind preflight back to BDS layers (the portal's
      // `[class*="bds-"] { all: revert-layer }`) otherwise mask every real
      // token, surfacing a wall of "revert-layer" in the panel. Skip them so
      // the underlying token rule wins. See brik-client-portal#1615.
      const trimmed = val.trim();
      if (trimmed === 'revert' || trimmed === 'revert-layer') continue;
      if (!best || rule.specificity >= best.specificity) {
        best = { value: val, origin: rule.selector, specificity: rule.specificity };
      }
    }
    return best;
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
    return {
      prop,
      declared: declared ? declared.value.trim() : null,
      origin: declared ? declared.origin : null,
      computed,
      tokens,
      unknownTokens: tokens.filter((t) => !isValidToken(t)),
      hardcoded,
      isViolation: hardcoded.length > 0 && tokens.length === 0,
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
      <br><span class="bi-pill__size">${Math.round(r.width)} × ${Math.round(r.height)}</span>
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
      for (const h of a.hardcoded) {
        val = val.replace(h, `<span class="bi-hardcoded">${escapeHtml(h)}</span>`);
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
        ${issueRows || (issues.length === 0 && contrast?.passesAA ? '<div class="bi-row"><span class="bi-row__value" style="color:#3aa86b;">No runtime accessibility issues detected.</span></div>' : '')}
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
    const report = {
      url: location.href,
      scannedAt: new Date().toISOString(),
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
      `${scanned} elements scanned\n` +
      `${bdsCount} BDS components found\n` +
      `${report.totals.totalViolations} violations across ${violations.length} elements\n\n` +
      `Full report copied to clipboard.`
    );
  }

  // ── Event handlers ──────────────────────────────────────────────────────
  function onMouseMove(e) {
    if (!active || lockedEl) return;
    const el = e.target;
    if (!el || isIgnoredEl(el)) return;
    hoveredEl = el;
    drawOutline(el, false);
    showPill(el, e.clientX, e.clientY);
  }

  function onClick(e) {
    if (!active) return;
    const el = e.target;
    if (!el || isIgnoredEl(el)) return;
    e.preventDefault();
    e.stopPropagation();
    lockedEl = el;
    hidePill();
    drawOutline(el, true);
    openPanel(el);
  }

  function onKey(e) {
    if (e.key === 'Escape') {
      if (lockedEl) closePanel();
      else if (active) toggleActive();
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
    registerWithDevBar();
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
