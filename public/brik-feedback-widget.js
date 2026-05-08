/**
 * Brik Design Review — Feedback Widget
 *
 * Two modes (opt-in via `data-mode`):
 *
 *   1. PIN MODE (default — `data-mode="pin"` or omitted)
 *      Click-anywhere pin-drop overlay for external clients reviewing pre-launch
 *      mockups. Anonymous via review-token. Pins POST to portal.brikdesigns.com.
 *      Used by vale-partners-mockups via inject-widgets.sh.
 *
 *   2. FORM MODE (`data-mode="form"`, since brik-bds#467)
 *      Type-button + textarea panel, mirrors BDS DevFeedbackWidget.tsx visually.
 *      Authenticated via host-page session (cookies). Submissions POST to a
 *      caller-provided endpoint. Integrates with `window.BrikDevBar` if present;
 *      falls back to a standalone FAB. Target: brikdesigns staging admin QA
 *      (Phase 3 of brikdesigns/brik-llm#352).
 *
 * Configuration via data attributes on the script tag:
 *
 *   PIN MODE:
 *   <script src="feedback-widget.js"
 *     data-review-token="abc123"
 *     data-api-url="https://portal.brikdesigns.com"
 *     data-variant-key="a">
 *   </script>
 *
 *   FORM MODE (user-auth):
 *   <script src="feedback-widget.js"
 *     data-mode="form"
 *     data-auth="user"
 *     data-endpoint="/api/feedback"
 *     data-context-label="Page">
 *   </script>
 */

(function () {
  'use strict';

  // ── Config ──────────────────────────────────────────────────────────────
  const script = document.currentScript;
  const MODE = script?.getAttribute('data-mode') || 'pin';
  const AUTH = script?.getAttribute('data-auth') || 'review-token';
  const REVIEW_TOKEN = script?.getAttribute('data-review-token') || '';
  const API_URL = script?.getAttribute('data-api-url') || 'https://portal.brikdesigns.com';
  const VARIANT_KEY = script?.getAttribute('data-variant-key') || '';
  const ENDPOINT = script?.getAttribute('data-endpoint') || '';
  const CONTEXT_LABEL = script?.getAttribute('data-context-label') || 'Page';

  // ── Form mode (brik-bds#467) ────────────────────────────────────────────
  // Self-contained: own UI, own submit. Returns when done so the rest of the
  // IIFE (pin-mode setup) doesn't run.
  if (MODE === 'form') {
    initFormMode();
    return;
  }

  // ── Pin mode (existing path — review-token required) ────────────────────
  if (!REVIEW_TOKEN) {
    console.warn('[Brik Feedback] No review token configured. Widget disabled.');
    return;
  }

  // ── State ───────────────────────────────────────────────────────────────
  let feedbackMode = false;
  let pins = [];
  let pendingPin = null;
  let authorName = localStorage.getItem('brik-feedback-name') || '';
  let authorEmail = localStorage.getItem('brik-feedback-email') || '';
  let screenshotBase64 = null;

  // ── Styles ──────────────────────────────────────────────────────────────
  const ACCENT = '#4665f5'; // fallback if BDS tokens unavailable

  const css = `
    .bfb-toolbar {
      position: fixed;
      bottom: var(--space-lg, 24px);
      right: var(--space-lg, 24px);
      z-index: 99999;
      display: flex;
      gap: var(--space-sm, 8px);
      align-items: center;
    }
    .bfb-btn {
      background: var(--background-brand-primary, ${ACCENT});
      color: #fff;
      border: none;
      border-radius: var(--radius-button, 100px);
      padding: var(--space-sm, 12px) var(--space-md, 20px);
      font-family: var(--typography-font-family-label, -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif);
      font-size: var(--label-sm, 14px);
      font-weight: var(--font-weight-bold, 600);
      letter-spacing: var(--letter-spacing-wide, 0);
      line-height: 1;
      text-decoration: none;
      text-transform: uppercase;
      cursor: pointer;
      box-shadow: var(--elevation-md, 0 4px 24px rgba(0,0,0,0.3));
      transition: background var(--duration-fast, 0.15s) var(--ease-default, ease),
                  transform var(--duration-fast, 0.15s) var(--ease-default, ease);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: var(--space-xs, 6px);
      box-sizing: border-box;
      -webkit-appearance: none;
      -moz-appearance: none;
      appearance: none;
    }
    .bfb-btn svg {
      width: var(--icon-md, 16px);
      height: var(--icon-md, 16px);
      flex-shrink: 0;
    }
    .bfb-btn:hover { opacity: 0.9; transform: translateY(-1px); }
    .bfb-btn--active { background: #ef4444; }
    .bfb-btn--active:hover { background: #dc2626; }

    .bfb-pin {
      position: absolute;
      width: 28px;
      height: 28px;
      background: var(--background-brand-primary, ${ACCENT});
      border: 2px solid #fff;
      border-radius: 50%;
      transform: translate(-50%, -50%);
      z-index: 99998;
      cursor: pointer;
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 11px;
      font-weight: 700;
      color: #fff;
      font-family: -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
      transition: transform 0.15s;
    }
    .bfb-pin:hover { transform: translate(-50%, -50%) scale(1.15); }
    .bfb-pin--pending { background: #f59e0b; animation: bfb-pulse 1.5s infinite; }

    @keyframes bfb-pulse {
      0%, 100% { box-shadow: 0 0 0 0 rgba(245,158,11,0.4); }
      50% { box-shadow: 0 0 0 8px rgba(245,158,11,0); }
    }

    .bfb-form {
      position: fixed;
      z-index: 100000;
      background: #fff;
      border-radius: 12px;
      box-shadow: 0 8px 40px rgba(0,0,0,0.25);
      padding: 20px;
      width: 320px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
    }
    .bfb-form h3 {
      margin: 0 0 14px;
      font-size: 15px;
      font-weight: 600;
      color: #1b1b1b;
    }
    .bfb-form input, .bfb-form textarea {
      width: 100%;
      border: 1px solid #ddd;
      border-radius: 8px;
      padding: 10px 12px;
      font-size: 14px;
      font-family: inherit;
      margin-bottom: 10px;
      box-sizing: border-box;
      transition: border-color 0.15s;
    }
    .bfb-form input:focus, .bfb-form textarea:focus {
      outline: none;
      border-color: var(--border-brand-primary, ${ACCENT});
    }
    .bfb-form textarea { resize: vertical; min-height: 80px; }
    .bfb-form-actions {
      display: flex;
      gap: 8px;
      justify-content: flex-end;
    }
    .bfb-form-actions button {
      border: none;
      border-radius: 8px;
      padding: 8px 16px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      font-family: inherit;
    }
    .bfb-submit { background: var(--background-brand-primary, ${ACCENT}); color: #fff; }
    .bfb-submit:hover { background: #3550d4; }
    .bfb-submit:disabled { opacity: 0.5; cursor: not-allowed; }
    .bfb-cancel { background: #f3f3f3; color: #666; }
    .bfb-cancel:hover { background: #e8e8e8; }

    .bfb-context {
      background: #f0f2ff;
      border: 1px solid #dde1fc;
      border-radius: 6px;
      padding: 8px 10px;
      margin-bottom: 10px;
      font-size: 12px;
      color: #444;
      line-height: 1.4;
    }
    .bfb-context strong {
      color: var(--text-brand-primary, ${ACCENT});
      font-weight: 600;
    }
    .bfb-context-row {
      display: flex;
      gap: 4px;
    }
    .bfb-context-label {
      color: #888;
      min-width: 50px;
    }

    .bfb-toast {
      position: fixed;
      bottom: 80px;
      right: 24px;
      z-index: 100001;
      background: #1b1b1b;
      color: #fff;
      padding: 12px 20px;
      border-radius: 8px;
      font-size: 14px;
      font-family: -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
      box-shadow: 0 4px 16px rgba(0,0,0,0.2);
      animation: bfb-fadein 0.2s;
    }
    @keyframes bfb-fadein {
      from { opacity: 0; transform: translateY(8px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .bfb-screenshot-zone {
      border: 2px dashed #ddd;
      border-radius: 8px;
      padding: 10px;
      margin-bottom: 10px;
      text-align: center;
      font-size: 12px;
      color: #888;
      cursor: pointer;
      transition: border-color 0.15s, background 0.15s;
      position: relative;
    }
    .bfb-screenshot-zone:hover,
    .bfb-screenshot-zone--dragover {
      border-color: var(--border-brand-primary, ${ACCENT});
      background: #f0f2ff;
    }
    .bfb-screenshot-zone input[type="file"] {
      position: absolute;
      inset: 0;
      opacity: 0;
      cursor: pointer;
    }
    .bfb-screenshot-preview {
      position: relative;
      display: inline-block;
      margin-bottom: 10px;
    }
    .bfb-screenshot-preview img {
      max-width: 100%;
      max-height: 120px;
      border-radius: 6px;
      border: 1px solid #ddd;
      display: block;
    }
    .bfb-screenshot-remove {
      position: absolute;
      top: -6px;
      right: -6px;
      width: 20px;
      height: 20px;
      background: #ef4444;
      color: #fff;
      border: 2px solid #fff;
      border-radius: 50%;
      font-size: 12px;
      line-height: 16px;
      text-align: center;
      cursor: pointer;
      box-shadow: 0 1px 4px rgba(0,0,0,0.2);
    }
    .bfb-screenshot-remove:hover { background: #dc2626; }

    .bfb-crosshair { cursor: crosshair !important; }
    .bfb-crosshair * { cursor: crosshair !important; }

    .bfb-pin-tooltip {
      position: absolute;
      background: #1b1b1b;
      color: #fff;
      padding: 8px 12px;
      border-radius: 6px;
      font-size: 13px;
      font-family: -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
      max-width: 240px;
      z-index: 99999;
      pointer-events: none;
      box-shadow: 0 4px 12px rgba(0,0,0,0.2);
      white-space: pre-wrap;
    }
    .bfb-pin-tooltip::after {
      content: '';
      position: absolute;
      top: -6px;
      left: 14px;
      border-left: 6px solid transparent;
      border-right: 6px solid transparent;
      border-bottom: 6px solid #1b1b1b;
    }
  `;

  // ── Inject styles ───────────────────────────────────────────────────────
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  // ── Load existing feedback ──────────────────────────────────────────────
  async function loadExistingPins() {
    try {
      const res = await fetch(`${API_URL}/api/review/${REVIEW_TOKEN}`);
      if (!res.ok) return;
      const { review } = await res.json();
      if (!review?.design_feedback) return;

      const variantFeedback = review.design_feedback.filter(
        (f) => f.variant_key === VARIANT_KEY && f.pin_x != null
      );

      variantFeedback.forEach((f, i) => {
        pins.push({
          id: f.id,
          x: f.pin_x,
          y: f.pin_y,
          comment: f.comment,
          author: f.author_name,
          number: i + 1,
        });
      });

      renderPins();
    } catch (e) {
      console.warn('[Brik Feedback] Could not load existing feedback:', e);
    }
  }

  // ── Render pins on page ─────────────────────────────────────────────────
  function renderPins() {
    document.querySelectorAll('.bfb-pin:not(.bfb-pin--pending)').forEach((el) => el.remove());

    pins.forEach((pin) => {
      const el = document.createElement('div');
      el.className = 'bfb-pin';
      el.textContent = String(pin.number);
      el.style.left = pin.x + '%';
      el.style.top = pin.y + 'px';

      el.addEventListener('mouseenter', (e) => showTooltip(e, pin));
      el.addEventListener('mouseleave', hideTooltip);

      document.body.appendChild(el);
    });
  }

  // ── Tooltip ─────────────────────────────────────────────────────────────
  let tooltipEl = null;

  function showTooltip(e, pin) {
    hideTooltip();
    tooltipEl = document.createElement('div');
    tooltipEl.className = 'bfb-pin-tooltip';
    tooltipEl.textContent = `${pin.author}: ${pin.comment}`;

    const rect = e.target.getBoundingClientRect();
    tooltipEl.style.left = (rect.left + window.scrollX) + 'px';
    tooltipEl.style.top = (rect.bottom + window.scrollY + 8) + 'px';

    document.body.appendChild(tooltipEl);
  }

  function hideTooltip() {
    if (tooltipEl) {
      tooltipEl.remove();
      tooltipEl = null;
    }
  }

  // ── Toolbar ─────────────────────────────────────────────────────────────
  const toolbar = document.createElement('div');
  toolbar.className = 'bfb-toolbar';

  const feedbackBtn = document.createElement('button');
  feedbackBtn.className = 'bfb-btn';
  feedbackBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg> Leave feedback';

  feedbackBtn.addEventListener('click', () => {
    feedbackMode = !feedbackMode;
    if (feedbackMode) {
      feedbackBtn.className = 'bfb-btn bfb-btn--active';
      feedbackBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg> Cancel';
      document.documentElement.classList.add('bfb-crosshair');
      toast('Click anywhere on the page to drop a pin');
    } else {
      deactivate();
    }
  });

  const backBtn = document.createElement('a');
  backBtn.className = 'bfb-btn';
  backBtn.href = 'index.html';
  backBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></svg> All styles';

  toolbar.appendChild(backBtn);
  toolbar.appendChild(feedbackBtn);
  document.body.appendChild(toolbar);

  function deactivate() {
    feedbackMode = false;
    feedbackBtn.className = 'bfb-btn';
    feedbackBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg> Leave feedback';
    document.documentElement.classList.remove('bfb-crosshair');
    removePendingPin();
    removeForm();
  }

  // ── Section detection ──────────────────────────────────────────────────
  function detectSectionContext(target) {
    const ctx = {};

    // Find nearest <section> ancestor with section classes
    const section = target.closest('section[class*="section--"], [class*="section--"]');
    if (section) {
      // Extract section type from class: "section section--hero" → "hero"
      const typeMatch = section.className.match(/section--([a-z-]+)/);
      if (typeMatch) ctx.section_type = typeMatch[1];

      // aria-label is the human-readable name
      if (section.getAttribute('aria-label')) ctx.section_label = section.getAttribute('aria-label');

      // id for anchoring
      if (section.id) ctx.section_id = section.id;

      // Look for <!-- Source: home.md Section-XX --> comment above the section
      let prev = section.previousSibling;
      while (prev) {
        if (prev.nodeType === 8) { // Comment node
          const commentMatch = prev.textContent.trim().match(/Source:\s*(.+)/);
          if (commentMatch) {
            ctx.content_source = commentMatch[1].trim();
            break;
          }
        }
        // Stop if we hit another element
        if (prev.nodeType === 1) break;
        prev = prev.previousSibling;
      }

      // Section number from DOM order
      const allSections = document.querySelectorAll('section[class*="section--"]');
      const idx = Array.from(allSections).indexOf(section);
      if (idx >= 0) ctx.section_number = idx + 1;
    }

    // Detect layout class on nearest layout container
    const layout = target.closest('[class*="layout--"]');
    if (layout) {
      const layoutMatch = layout.className.match(/layout--([a-z0-9-]+)/);
      if (layoutMatch) ctx.layout = layoutMatch[1];
    }

    // Detect the clicked element type
    const el = target.closest('a, button, h1, h2, h3, h4, img, video, input, textarea, p, li, span');
    if (el) ctx.element_tag = el.tagName.toLowerCase();

    return ctx;
  }

  // ── Click to pin ────────────────────────────────────────────────────────
  let currentSectionContext = null;

  document.addEventListener('click', (e) => {
    if (!feedbackMode) return;
    if (e.target.closest('.bfb-toolbar, .bfb-form, .bfb-pin')) return;

    e.preventDefault();
    e.stopPropagation();

    removePendingPin();
    removeForm();

    const x = ((e.pageX) / document.documentElement.scrollWidth) * 100;
    const y = e.pageY;

    // Detect section context before creating the pin overlay
    currentSectionContext = detectSectionContext(e.target);

    pendingPin = document.createElement('div');
    pendingPin.className = 'bfb-pin bfb-pin--pending';
    pendingPin.textContent = '?';
    pendingPin.style.left = x + '%';
    pendingPin.style.top = y + 'px';
    document.body.appendChild(pendingPin);

    showForm(x, y, e.clientX, e.clientY);
  }, true);

  // ── Comment form ────────────────────────────────────────────────────────
  let formEl = null;

  function showForm(pinX, pinY, screenX, screenY) {
    removeForm();

    formEl = document.createElement('div');
    formEl.className = 'bfb-form';

    // Position form near click but keep on screen
    const formWidth = 320;
    const formHeight = 280;
    let left = screenX + 20;
    let top = screenY - 20;

    if (left + formWidth > window.innerWidth - 20) {
      left = screenX - formWidth - 20;
    }
    if (top + formHeight > window.innerHeight - 20) {
      top = window.innerHeight - formHeight - 20;
    }
    if (top < 20) top = 20;

    formEl.style.left = left + 'px';
    formEl.style.top = top + 'px';

    // Build context display
    const ctx = currentSectionContext || {};
    let contextHtml = '';
    if (ctx.section_type || ctx.section_label) {
      const parts = [];
      if (ctx.section_number) parts.push(`<span class="bfb-context-label">Section</span> <strong>${ctx.section_number}: ${(ctx.section_type || '').replace(/-/g, ' ')}</strong>`);
      else if (ctx.section_type) parts.push(`<span class="bfb-context-label">Section</span> <strong>${ctx.section_type.replace(/-/g, ' ')}</strong>`);
      if (ctx.section_label && ctx.section_label !== ctx.section_type) parts.push(`<span class="bfb-context-label">Label</span> ${esc(ctx.section_label)}`);
      if (ctx.element_tag) parts.push(`<span class="bfb-context-label">Element</span> &lt;${ctx.element_tag}&gt;`);
      if (ctx.layout) parts.push(`<span class="bfb-context-label">Layout</span> ${ctx.layout}`);
      contextHtml = `<div class="bfb-context">${parts.map(p => `<div class="bfb-context-row">${p}</div>`).join('')}</div>`;
    }

    formEl.innerHTML = `
      <h3>Leave a comment</h3>
      ${contextHtml}
      <input type="text" class="bfb-name" placeholder="Your name" value="${esc(authorName)}" autocomplete="off" data-1p-ignore />
      <input type="text" class="bfb-email" placeholder="Email (optional)" value="${esc(authorEmail)}" autocomplete="off" data-1p-ignore />
      <textarea class="bfb-comment" placeholder="What are your thoughts?" data-1p-ignore></textarea>
      <div class="bfb-screenshot-zone">
        \uD83D\uDCCE Paste, drag, or <u>upload</u> a screenshot
        <input type="file" accept="image/*" />
      </div>
      <div class="bfb-form-actions">
        <button type="button" class="bfb-cancel">Cancel</button>
        <button type="button" class="bfb-submit">Submit</button>
      </div>
    `;

    // Wire screenshot zone events
    const ssZone = formEl.querySelector('.bfb-screenshot-zone');
    const ssInput = ssZone.querySelector('input[type="file"]');
    ssInput.addEventListener('change', (e) => {
      if (e.target.files[0]) processImageFile(e.target.files[0]);
    });
    ssZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      ssZone.classList.add('bfb-screenshot-zone--dragover');
    });
    ssZone.addEventListener('dragleave', () => {
      ssZone.classList.remove('bfb-screenshot-zone--dragover');
    });
    ssZone.addEventListener('drop', (e) => {
      e.preventDefault();
      ssZone.classList.remove('bfb-screenshot-zone--dragover');
      const file = e.dataTransfer?.files[0];
      if (file) processImageFile(file);
    });

    formEl.querySelector('.bfb-cancel').addEventListener('click', () => {
      screenshotBase64 = null;
      removePendingPin();
      removeForm();
    });

    formEl.querySelector('.bfb-submit').addEventListener('click', () => {
      submitFeedback(pinX, pinY);
    });

    // Submit on Cmd/Ctrl+Enter
    formEl.querySelector('.bfb-comment').addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        submitFeedback(pinX, pinY);
      }
    });

    document.body.appendChild(formEl);

    // Focus the right field
    if (!authorName) {
      formEl.querySelector('.bfb-name').focus();
    } else {
      formEl.querySelector('.bfb-comment').focus();
    }
  }

  async function submitFeedback(pinX, pinY) {
    if (!formEl) return;

    const name = formEl.querySelector('.bfb-name').value.trim();
    const email = formEl.querySelector('.bfb-email').value.trim();
    const comment = formEl.querySelector('.bfb-comment').value.trim();

    if (!name || !comment) {
      toast('Please enter your name and a comment');
      return;
    }

    const submitBtn = formEl.querySelector('.bfb-submit');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Sending...';

    // Remember name/email for next time
    authorName = name;
    authorEmail = email;
    localStorage.setItem('brik-feedback-name', name);
    localStorage.setItem('brik-feedback-email', email);

    try {
      const res = await fetch(`${API_URL}/api/review/${REVIEW_TOKEN}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          variant_key: VARIANT_KEY,
          author_name: name,
          author_email: email || undefined,
          comment,
          pin_x: Math.round(pinX * 100) / 100,
          pin_y: Math.round(pinY),
          viewport_width: window.innerWidth,
          page_url: window.location.href,
          section_context: Object.keys(currentSectionContext || {}).length > 0 ? currentSectionContext : undefined,
          screenshot_base64: screenshotBase64 || undefined,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to submit');
      }

      // Convert pending pin to permanent
      const pinNumber = pins.length + 1;
      pins.push({ x: pinX, y: pinY, comment, author: name, number: pinNumber });

      screenshotBase64 = null;
      removePendingPin();
      removeForm();
      renderPins();
      deactivate();
      toast('Feedback sent — thank you!');
    } catch (err) {
      console.error('[Brik Feedback]', err);
      submitBtn.disabled = false;
      submitBtn.textContent = 'Submit';
      toast('Could not send feedback. Please try again.');
    }
  }

  function removePendingPin() {
    if (pendingPin) {
      pendingPin.remove();
      pendingPin = null;
    }
  }

  function removeForm() {
    if (formEl) {
      formEl.remove();
      formEl = null;
    }
  }

  // ── Toast ───────────────────────────────────────────────────────────────
  function toast(msg) {
    const el = document.createElement('div');
    el.className = 'bfb-toast';
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 3000);
  }

  // ── Helpers ─────────────────────────────────────────────────────────────
  function esc(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // ── Screenshot processing ──────────────────────────────────────────────
  const MAX_IMG_WIDTH = 1200;
  const JPEG_QUALITY = 0.75;

  function processImageFile(file) {
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = (e) => resizeAndStore(e.target.result);
    reader.readAsDataURL(file);
  }

  function resizeAndStore(dataUrl) {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      if (width > MAX_IMG_WIDTH) {
        height = Math.round(height * (MAX_IMG_WIDTH / width));
        width = MAX_IMG_WIDTH;
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      canvas.getContext('2d').drawImage(img, 0, 0, width, height);
      screenshotBase64 = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
      renderScreenshotPreview();
    };
    img.src = dataUrl;
  }

  function renderScreenshotPreview() {
    if (!formEl) return;
    // Remove any existing preview
    formEl.querySelector('.bfb-screenshot-preview')?.remove();
    formEl.querySelector('.bfb-screenshot-zone')?.remove();

    if (!screenshotBase64) {
      // Re-insert the upload zone before the actions
      const actions = formEl.querySelector('.bfb-form-actions');
      if (actions) actions.before(createScreenshotZone());
      return;
    }

    const preview = document.createElement('div');
    preview.className = 'bfb-screenshot-preview';

    const thumb = document.createElement('img');
    thumb.src = screenshotBase64;
    preview.appendChild(thumb);

    const removeBtn = document.createElement('div');
    removeBtn.className = 'bfb-screenshot-remove';
    removeBtn.textContent = '\u00d7';
    removeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      screenshotBase64 = null;
      renderScreenshotPreview();
    });
    preview.appendChild(removeBtn);

    // Insert before actions
    const actions = formEl.querySelector('.bfb-form-actions');
    if (actions) actions.before(preview);
  }

  function createScreenshotZone() {
    const zone = document.createElement('div');
    zone.className = 'bfb-screenshot-zone';
    zone.innerHTML = '\uD83D\uDCCE Paste, drag, or <u>upload</u> a screenshot';

    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';
    fileInput.addEventListener('change', (e) => {
      if (e.target.files[0]) processImageFile(e.target.files[0]);
    });
    zone.appendChild(fileInput);

    zone.addEventListener('dragover', (e) => {
      e.preventDefault();
      zone.classList.add('bfb-screenshot-zone--dragover');
    });
    zone.addEventListener('dragleave', () => {
      zone.classList.remove('bfb-screenshot-zone--dragover');
    });
    zone.addEventListener('drop', (e) => {
      e.preventDefault();
      zone.classList.remove('bfb-screenshot-zone--dragover');
      const file = e.dataTransfer?.files[0];
      if (file) processImageFile(file);
    });

    return zone;
  }

  // Global paste handler — only active when feedback form is open
  document.addEventListener('paste', (e) => {
    if (!formEl) return;
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        processImageFile(item.getAsFile());
        return;
      }
    }
  });

  // ── Init ────────────────────────────────────────────────────────────────
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadExistingPins);
  } else {
    loadExistingPins();
  }

  // ── Form mode implementation (brik-bds#467) ─────────────────────────────
  // Self-contained: separate CSS scope (.bff-*), separate DOM, separate auth.
  // Mirrors components/ui/DevFeedbackWidget/DevFeedbackWidget.tsx visually
  // (Poppy/Poppins/inlined hex — dev overlay must render even when host CSS
  // hasn't loaded). Hoisted so it can be invoked at the top of the IIFE.
  function initFormMode() {
    // Validate config based on auth model.
    if (AUTH === 'user' && !ENDPOINT) {
      console.warn('[Brik Feedback] data-mode="form" data-auth="user" requires data-endpoint. Widget disabled.');
      return;
    }
    if (AUTH !== 'user') {
      // form + review-token deferred — no Phase 3 consumer asks for it.
      console.warn('[Brik Feedback] data-mode="form" currently supports data-auth="user" only. Widget disabled.');
      return;
    }

    const FORM_TYPES = [
      { label: 'Bug', value: 'bug' },
      { label: 'UI', value: 'ui' },
      { label: 'Suggestion', value: 'suggestion' },
      { label: 'Question', value: 'question' },
    ];

    // Inlined brand tokens — dev overlay stability (matches React widget).
    const T = {
      poppy: '#e35335',
      poppyDark: '#b0351b',
      white: '#ffffff',
      grayLighter: '#e0e0e0',
      grayLight: '#bdbdbd',
      grayDark: '#828282',
      grayDarkest: '#333333',
      fontFamily: "'Poppins', system-ui, sans-serif",
    };

    // Poppins font (idempotent — sibling widgets inject it too).
    if (!document.querySelector('link[href*="Poppins"]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap';
      document.head.appendChild(link);
    }

    const formCss = `
      .bff-fab {
        position: fixed;
        bottom: 16px;
        left: 72px;
        z-index: 9998;
        width: 40px;
        height: 40px;
        border-radius: 50%;
        background-color: ${T.poppy};
        color: ${T.white};
        border: none;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 18px;
        font-family: ${T.fontFamily};
        box-shadow: 0 4px 20px rgba(0,0,0,0.22);
        transition: background-color 0.15s ease, transform 0.15s ease;
      }
      .bff-fab:hover { background-color: ${T.poppyDark}; transform: translateY(-1px); }
      .bff-fab.bff-fab--hidden { display: none; }
      .bff-panel {
        position: fixed;
        z-index: 9998;
        width: 320px;
        background-color: ${T.white};
        border-radius: 12px;
        border: 1px solid ${T.grayLighter};
        box-shadow: 0 12px 48px rgba(0,0,0,0.18);
        padding: 16px;
        display: flex;
        flex-direction: column;
        gap: 8px;
        font-family: ${T.fontFamily};
        color: ${T.grayDarkest};
      }
      .bff-header {
        font-size: 11px;
        font-weight: 700;
        color: ${T.grayDark};
        text-transform: uppercase;
        letter-spacing: 0.08em;
      }
      .bff-types {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 8px;
      }
      .bff-type {
        padding: 8px 12px;
        border-radius: 999px;
        border: 1px solid ${T.grayLighter};
        background-color: transparent;
        color: ${T.grayDarkest};
        font-family: ${T.fontFamily};
        font-size: 13px;
        font-weight: 600;
        letter-spacing: 0.02em;
        cursor: pointer;
        line-height: 1;
        transition: background-color 0.12s ease, border-color 0.12s ease, color 0.12s ease;
      }
      .bff-type[aria-checked="true"] {
        background-color: ${T.poppy};
        border-color: ${T.poppy};
        color: ${T.white};
      }
      .bff-textarea {
        width: 100%;
        min-height: 80px;
        padding: 10px 12px;
        border-radius: 8px;
        border: 1px solid ${T.grayLighter};
        background-color: ${T.white};
        color: ${T.grayDarkest};
        font-size: 13px;
        font-family: ${T.fontFamily};
        resize: vertical;
        outline: none;
        box-sizing: border-box;
      }
      .bff-context {
        font-size: 10px;
        color: ${T.grayDark};
        font-family: ${T.fontFamily};
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .bff-submit {
        padding: 10px 16px;
        border-radius: 999px;
        border: none;
        background-color: ${T.poppy};
        color: ${T.white};
        cursor: pointer;
        font-size: 13px;
        font-family: ${T.fontFamily};
        font-weight: 600;
        letter-spacing: 0.02em;
        transition: background-color 0.12s ease;
      }
      .bff-submit:disabled {
        background-color: ${T.grayLighter};
        color: ${T.grayDark};
        cursor: not-allowed;
      }
      .bff-success {
        text-align: center;
        color: ${T.poppy};
        font-size: 13px;
        font-family: ${T.fontFamily};
        font-weight: 600;
        padding: 20px 0;
      }
    `;
    const styleEl = document.createElement('style');
    styleEl.textContent = formCss;
    document.head.appendChild(styleEl);

    // ── State ───────────────────────────────────────────────────────────
    let open = false;
    let type = 'bug';
    let description = '';
    let submitting = false;
    let submitted = false;
    let devBarPresent = false;
    let panelEl = null;

    // ── FAB (shown while DevBar is absent) ──────────────────────────────
    const fab = document.createElement('button');
    fab.type = 'button';
    fab.className = 'bff-fab';
    fab.setAttribute('aria-label', 'Open feedback');
    fab.innerHTML = '💬';
    fab.addEventListener('click', () => setOpen(!open));
    document.body.appendChild(fab);

    // ── DevBar slot registration (matches React widget pattern) ─────────
    const slotDef = {
      id: 'feedback',
      label: 'Feedback',
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
      order: 10,
      onActivate: () => setOpen(true),
      onDeactivate: () => setOpen(false),
    };
    const tryRegister = () => {
      if (window.BrikDevBar) {
        window.BrikDevBar.register(slotDef);
        devBarPresent = true;
        fab.classList.add('bff-fab--hidden');
        return true;
      }
      return false;
    };
    if (!tryRegister()) {
      window.BrikDevBarQueue = window.BrikDevBarQueue || [];
      window.BrikDevBarQueue.push(slotDef);
      const iv = setInterval(() => {
        if (tryRegister()) clearInterval(iv);
      }, 100);
      setTimeout(() => clearInterval(iv), 2000);
    }

    // ── Panel ───────────────────────────────────────────────────────────
    function setOpen(next) {
      open = next;
      if (open) renderPanel();
      else removePanel();
      window.BrikDevBar?.setActive('feedback', open);
    }

    function renderPanel() {
      if (panelEl) return;
      const ctx = window.location.pathname || '';
      panelEl = document.createElement('div');
      panelEl.className = 'bff-panel';
      panelEl.setAttribute('role', 'dialog');
      panelEl.setAttribute('aria-label', 'Submit feedback');
      // Anchor to FAB position when DevBar absent; centered above DevBar otherwise.
      if (devBarPresent) {
        panelEl.style.bottom = '72px';
        panelEl.style.left = '50%';
        panelEl.style.transform = 'translateX(-50%)';
      } else {
        panelEl.style.bottom = '64px';
        panelEl.style.left = '72px';
      }
      panelEl.innerHTML = renderPanelInner(ctx);
      document.body.appendChild(panelEl);
      wirePanelEvents(ctx);
      const ta = panelEl.querySelector('.bff-textarea');
      ta?.focus();
    }

    function renderPanelInner(ctx) {
      if (submitted) {
        return `
          <div class="bff-header">Submit Feedback</div>
          <div class="bff-success">Submitted — thank you!</div>
        `;
      }
      const types = FORM_TYPES.map((ft) => {
        const checked = type === ft.value ? 'true' : 'false';
        return `<button type="button" role="radio" aria-checked="${checked}" class="bff-type" data-type="${ft.value}">${ft.label}</button>`;
      }).join('');
      const submitDisabled = submitting || !description.trim() ? 'disabled' : '';
      const submitLabel = submitting ? 'Submitting…' : 'Submit Feedback';
      return `
        <div class="bff-header">Submit Feedback</div>
        <form class="bff-form">
          <div class="bff-types" role="radiogroup" aria-label="Feedback type">${types}</div>
          <textarea class="bff-textarea" placeholder="Describe what you found..."></textarea>
          <div class="bff-context">${escapeHtml(CONTEXT_LABEL)}: ${escapeHtml(ctx)}</div>
          <button type="submit" class="bff-submit" ${submitDisabled}>${submitLabel}</button>
        </form>
      `;
    }

    function wirePanelEvents(ctx) {
      const form = panelEl.querySelector('.bff-form');
      if (!form) return; // success view, no form to wire
      const ta = panelEl.querySelector('.bff-textarea');
      ta.value = description;
      ta.addEventListener('input', () => {
        description = ta.value;
        const submit = panelEl.querySelector('.bff-submit');
        if (submit) submit.toggleAttribute('disabled', submitting || !description.trim());
      });
      panelEl.querySelectorAll('.bff-type').forEach((btn) => {
        btn.addEventListener('click', () => {
          type = btn.getAttribute('data-type') || 'bug';
          panelEl.querySelectorAll('.bff-type').forEach((b) => {
            b.setAttribute('aria-checked', b === btn ? 'true' : 'false');
          });
        });
      });
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        submitForm(ctx);
      });
    }

    function removePanel() {
      panelEl?.remove();
      panelEl = null;
    }

    async function submitForm(ctx) {
      if (!description.trim() || submitting) return;
      submitting = true;
      const submit = panelEl?.querySelector('.bff-submit');
      if (submit) {
        submit.textContent = 'Submitting…';
        submit.setAttribute('disabled', '');
      }
      try {
        const res = await fetch(ENDPOINT, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            page_url: window.location.pathname,
            feedback_type: type,
            description: description.trim(),
            context: ctx,
          }),
        });
        if (res.ok) {
          submitted = true;
          if (panelEl) panelEl.innerHTML = renderPanelInner(ctx);
          setTimeout(() => {
            submitted = false;
            description = '';
            type = 'bug';
            setOpen(false);
          }, 1500);
          return;
        }
        const data = await res.json().catch(() => ({}));
        console.error('[Brik Feedback] submission failed:', data);
        window.alert('Feedback failed — see console for details.');
      } catch (err) {
        console.error('[Brik Feedback] submission error:', err);
        window.alert('Feedback failed — see console for details.');
      } finally {
        submitting = false;
        if (submit) {
          submit.textContent = 'Submit Feedback';
          submit.toggleAttribute('disabled', !description.trim());
        }
      }
    }

    function escapeHtml(s) {
      return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    }

    // ── Click-outside + Esc ─────────────────────────────────────────────
    document.addEventListener('mousedown', (e) => {
      if (!open) return;
      const target = e.target;
      if (panelEl?.contains(target)) return;
      if (fab.contains(target)) return;
      if (target.closest?.('.bdb-bar')) return; // DevBar slot toggles via its own handler
      setOpen(false);
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && open) setOpen(false);
    });
  }
})();
