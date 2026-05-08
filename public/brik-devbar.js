/**
 * Brik DevBar — unified bottom-pinned dev toolbar
 *
 * Provides a shared, branded dock that other widgets register into. Any widget
 * loaded *after* devbar.js can attach itself via the global registration API;
 * widgets loaded *before* it can still register through a queued fallback.
 *
 * Visibility model:
 *   - Bar renders only if at least one widget registers.
 *   - Each widget gates its own registration (review token, data-attr, etc.).
 *   - User can collapse the bar; preference persists in localStorage.
 *
 * Widget registration API (window.BrikDevBar):
 *
 *   BrikDevBar.register({
 *     id:         'inspect',           // unique string
 *     label:      'Inspect',           // shown in expanded bar + aria-label
 *     icon:       '<svg…/>' | string,  // inline SVG or emoji, 14px target
 *     onActivate: (api) => { … },      // called when user clicks the slot
 *     onDeactivate: (api) => { … },    // optional — called when user re-clicks
 *     badge:      null,                // initial badge content (number/string)
 *     order:      0,                   // lower = further left
 *   });
 *
 *   BrikDevBar.unregister('inspect');
 *   BrikDevBar.setBadge('inspect', 3);
 *   BrikDevBar.setActive('inspect', true);  // mark slot as toggled on
 *
 * The API passes itself to onActivate handlers so widgets know where the
 * bar lives and can position popovers above it.
 *
 * If devbar.js isn't loaded, widgets should fall back to their own standalone
 * FAB — just check: `if (window.BrikDevBar) …` at init.
 *
 * Zero deps, standalone, BDS-branded to match the rest of brik-dev-tool.
 */

(function () {
  'use strict';

  // Re-entry guard (in case script is injected twice).
  if (window.BrikDevBar && window.BrikDevBar.__initialized) return;

  // ── BDS Tokens (mirror feedback-widget.js / inspect-widget.js) ──────────
  const T = {
    colorPoppyLight:       '#e35335',
    colorPoppyDark:        '#b0351b',
    colorPoppyLightest:    '#ffefeb',
    colorGrayscaleWhite:   '#ffffff',
    colorGrayscaleLighter: '#e0e0e0',
    colorGrayscaleLight:   '#bdbdbd',
    colorGrayscaleDark:    '#828282',
    colorGrayscaleDarker:  '#4f4f4f',
    colorGrayscaleDarkest: '#333333',
    colorTanLightest:      '#f1f0ec',
    backgroundBrandPrimary:'#e35335',
    interactionBrandHover: '#b0351b',
    textPrimary:   '#333333',
    textMuted:     '#828282',
    textInverse:   '#ffffff',
    borderPrimary: '#e0e0e0',
    fontFamily:    "'Poppins', system-ui, sans-serif",
    fontSizeSm:    '11.54px',
    fontSizeBody:  '14px',
    fontWeightSemiBold: '600',
    fontWeightBold:     '700',
    space100: '4px',
    space200: '8px',
    space300: '12px',
    space400: '16px',
    radius100:  '4px',
    radius200:  '8px',
    radius300:  '12px',
    radius400:  '16px',
    radiusPill: '999px',
  };

  // ── State ───────────────────────────────────────────────────────────────
  const slots = new Map();              // id → slot definition
  const elRefs = { bar: null, list: null, logo: null };
  let initialized = false;

  // ── Font load (shared with sibling widgets) ────────────────────────────
  if (!document.querySelector('link[href*="Poppins"]')) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap';
    document.head.appendChild(link);
  }

  // ── Styles ──────────────────────────────────────────────────────────────
  const css = `
    .bdb-bar {
      position: fixed;
      bottom: ${T.space400};
      left: 50%;
      transform: translateX(-50%);
      z-index: 2147483647;
      display: inline-flex;
      align-items: center;
      gap: ${T.space200};
      padding: ${T.space200} ${T.space300};
      background: ${T.backgroundBrandPrimary};
      color: ${T.colorGrayscaleWhite};
      border: none;
      border-radius: ${T.radius400};
      box-shadow: 0 8px 28px rgba(0,0,0,0.22);
      font-family: ${T.fontFamily};
      font-size: ${T.fontSizeBody};
    }

    .bdb-logo {
      display: inline-flex; align-items: center; gap: ${T.space200};
      color: ${T.colorGrayscaleWhite};
      font-weight: ${T.fontWeightBold};
      font-size: ${T.fontSizeBody};
      letter-spacing: -0.01em;
      padding: 0 ${T.space100};
      user-select: none;
      pointer-events: none;
    }
    .bdb-logo__mark {
      width: 22px; height: 22px;
      display: inline-flex; align-items: center; justify-content: center;
      flex-shrink: 0;
    }
    .bdb-logo__mark svg { width: 22px; height: 22px; display: block; }

    .bdb-divider {
      width: 1px; height: 18px;
      background: rgba(255,255,255,0.28);
      margin: 0 ${T.space100};
    }

    .bdb-list {
      display: inline-flex;
      align-items: center;
      gap: ${T.space100};
    }

    .bdb-slot {
      position: relative;
      display: inline-flex; align-items: center; justify-content: center;
      gap: ${T.space100};
      padding: 0;
      width: 40px; height: 40px;
      background: transparent;
      color: ${T.colorGrayscaleWhite};
      border: none;
      border-radius: ${T.radius200};
      font-family: ${T.fontFamily};
      font-size: ${T.fontSizeSm};
      font-weight: ${T.fontWeightSemiBold};
      letter-spacing: 0.02em;
      cursor: pointer;
      transition: background 0.12s ease, color 0.12s ease;
      line-height: 1;
      white-space: nowrap;
    }
    .bdb-slot__label { display: none; }
    .bdb-slot:hover { background: rgba(255,255,255,0.15); }
    .bdb-slot[data-active="true"] {
      background: ${T.colorGrayscaleWhite};
      color: ${T.backgroundBrandPrimary};
    }
    .bdb-slot[data-active="true"]:hover { background: ${T.colorTanLightest}; }
    .bdb-slot__icon {
      display: inline-flex; align-items: center; justify-content: center;
      width: 14px; height: 14px;
    }
    .bdb-slot__icon svg { width: 16px; height: 16px; }
    .bdb-slot__badge {
      position: absolute; top: -2px; right: -4px;
      display: inline-flex; align-items: center; justify-content: center;
      min-width: 14px; height: 14px;
      padding: 0 3px;
      border-radius: ${T.radiusPill};
      background: ${T.colorGrayscaleDarkest};
      color: ${T.colorGrayscaleWhite};
      font-family: ${T.fontFamily};
      font-size: 9px;
      font-weight: ${T.fontWeightBold};
      line-height: 1;
      border: 1px solid ${T.colorGrayscaleWhite};
    }
    .bdb-slot[data-active="true"] .bdb-slot__badge {
      background: ${T.colorGrayscaleWhite};
      color: ${T.backgroundBrandPrimary};
    }

  `;

  function injectStyles() {
    if (document.querySelector('style[data-brik-devbar]')) return;
    const style = document.createElement('style');
    style.setAttribute('data-brik-devbar', '');
    style.textContent = css;
    document.head.appendChild(style);
  }

  // ── Brand logomark (Brik) ──────────────────────────────────────────────
  // Inline SVG of the Brik logomark on its own Poppy rounded-square bg,
  // baked-in to match the surrounding bar color. IDs are prefixed so they
  // don't collide with anything on the host page.
  const LOGO_SVG = `
<svg width="22" height="22" viewBox="0 0 104 104" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
<g clip-path="url(#bdb-logo-clip)">
<rect width="104" height="104" rx="12" fill="#E35335"/>
<path fill-rule="evenodd" clip-rule="evenodd" d="M104 0H0V104H104V0ZM70.044 35.7735C66.768 33.4995 63.0977 32.3625 59.033 32.3625C55.4537 32.3625 52.3597 33.2071 49.751 34.8964C47.1423 36.5207 45.201 38.7947 43.927 41.7183V18.3071C43.927 16.812 42.7953 15.6 41.3992 15.6H28.5278C27.1317 15.6 26 16.812 26 18.3071V85.0107C26 86.5058 27.1317 87.7178 28.5278 87.7178H41.3992C42.7953 87.7178 43.927 86.5058 43.927 85.0107V79.0442C45.201 81.9679 47.1423 84.2743 49.751 85.9636C52.3597 87.5879 55.4537 88.4 59.033 88.4C63.0977 88.4 66.768 87.2955 70.044 85.0865C73.32 82.8125 75.8983 79.5639 77.779 75.3408C79.6597 71.0527 80.6 66.05 80.6 60.3325C80.6 54.6151 79.6597 49.6448 77.779 45.4217C75.8983 41.1986 73.32 37.9825 70.044 35.7735ZM46.475 52.1462C48.2343 50.1321 50.4487 49.125 53.118 49.125C55.9087 49.125 58.1533 50.1321 59.852 52.1462C61.6113 54.0953 62.491 56.8241 62.491 60.3325C62.491 63.9059 61.6113 66.6997 59.852 68.7138C58.1533 70.6629 55.9087 71.6375 53.118 71.6375C50.4487 71.6375 48.2343 70.6304 46.475 68.6163C44.7157 66.6022 43.836 63.841 43.836 60.3325C43.836 56.8891 44.7157 54.1603 46.475 52.1462Z" fill="white"/>
</g>
<defs>
<clipPath id="bdb-logo-clip"><rect width="104" height="104" rx="12" fill="white"/></clipPath>
</defs>
</svg>`;

  // ── DOM ─────────────────────────────────────────────────────────────────
  function buildBar() {
    if (elRefs.bar) return;

    const bar = document.createElement('div');
    bar.className = 'bdb-bar';
    bar.setAttribute('role', 'toolbar');
    bar.setAttribute('aria-label', 'Brik DevBar');

    const logo = document.createElement('div');
    logo.className = 'bdb-logo';
    logo.innerHTML = `<span class="bdb-logo__mark">${LOGO_SVG}</span><span>brik</span>`;
    bar.appendChild(logo);

    const divider = document.createElement('span');
    divider.className = 'bdb-divider';
    bar.appendChild(divider);

    const list = document.createElement('div');
    list.className = 'bdb-list';
    list.setAttribute('role', 'group');
    bar.appendChild(list);

    document.body.appendChild(bar);

    elRefs.bar = bar;
    elRefs.list = list;
    elRefs.logo = logo;
  }

  // ── Slot rendering ──────────────────────────────────────────────────────
  function renderSlot(def) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'bdb-slot';
    btn.setAttribute('data-slot-id', def.id);
    btn.setAttribute('data-active', 'false');
    btn.setAttribute('aria-label', def.label);
    btn.setAttribute('title', def.label);
    btn.innerHTML = `
      <span class="bdb-slot__icon">${def.icon || ''}</span>
      <span class="bdb-slot__label">${escapeHtml(def.label)}</span>
      ${def.badge != null ? `<span class="bdb-slot__badge">${escapeHtml(String(def.badge))}</span>` : ''}
    `;

    btn.addEventListener('click', () => {
      const wasActive = btn.getAttribute('data-active') === 'true';
      if (wasActive) {
        setActive(def.id, false);
        if (typeof def.onDeactivate === 'function') def.onDeactivate(api);
      } else {
        setActive(def.id, true);
        if (typeof def.onActivate === 'function') def.onActivate(api);
      }
    });

    return btn;
  }

  function resort() {
    if (!elRefs.list) return;
    const ordered = Array.from(slots.values()).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    elRefs.list.innerHTML = '';
    for (const def of ordered) {
      const el = renderSlot(def);
      elRefs.list.appendChild(el);
    }
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  // ── Public API ──────────────────────────────────────────────────────────
  function register(def) {
    if (!def || !def.id || !def.label) {
      console.warn('[BrikDevBar] register() requires { id, label }');
      return;
    }
    slots.set(def.id, { order: 0, badge: null, ...def });
    if (!initialized) {
      injectStyles();
      buildBar();
      initialized = true;
    }
    resort();
    return api;
  }

  function unregister(id) {
    if (!slots.has(id)) return;
    slots.delete(id);
    resort();
    if (slots.size === 0 && elRefs.bar) {
      elRefs.bar.remove();
      elRefs.bar = null;
      elRefs.list = null;
      elRefs.logo = null;
      initialized = false;
    }
  }

  function setBadge(id, value) {
    const slot = slots.get(id);
    if (!slot) return;
    slot.badge = value;
    const btn = elRefs.list?.querySelector(`[data-slot-id="${id}"]`);
    if (!btn) return;
    let badgeEl = btn.querySelector('.bdb-slot__badge');
    if (value == null) {
      if (badgeEl) badgeEl.remove();
      return;
    }
    if (!badgeEl) {
      badgeEl = document.createElement('span');
      badgeEl.className = 'bdb-slot__badge';
      btn.appendChild(badgeEl);
    }
    badgeEl.textContent = String(value);
  }

  function setActive(id, active) {
    const btn = elRefs.list?.querySelector(`[data-slot-id="${id}"]`);
    if (btn) btn.setAttribute('data-active', String(!!active));
    // Also clear any other active slots if this one was activated — single-select behavior.
    if (active && elRefs.list) {
      for (const other of elRefs.list.querySelectorAll('.bdb-slot[data-active="true"]')) {
        if (other.getAttribute('data-slot-id') !== id) other.setAttribute('data-active', 'false');
      }
    }
  }

  function isRegistered(id) {
    return slots.has(id);
  }

  const api = {
    __initialized: true,
    register,
    unregister,
    setBadge,
    setActive,
    isRegistered,
    // Position helpers for widgets rendering popovers anchored above the bar.
    getBarRect: () => (elRefs.bar ? elRefs.bar.getBoundingClientRect() : null),
    getSlotRect: (id) => {
      const btn = elRefs.list?.querySelector(`[data-slot-id="${id}"]`);
      return btn ? btn.getBoundingClientRect() : null;
    },
  };

  // ── Flush any queued registrations posted before this script loaded ─────
  // Widgets may do:  (window.BrikDevBarQueue = window.BrikDevBarQueue || []).push(def)
  // so they can register even if devbar.js loads later.
  window.BrikDevBar = api;
  if (Array.isArray(window.BrikDevBarQueue)) {
    for (const def of window.BrikDevBarQueue) register(def);
    window.BrikDevBarQueue = [];
  }
})();
