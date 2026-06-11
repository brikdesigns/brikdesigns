'use client';

import dynamic from 'next/dynamic';
import { useEffect } from 'react';

/**
 * Brik DevTools — staging-only QA overlay.
 *
 * Phase 3 of brikdesigns/brik-llm#352 (issue brikdesigns/brikdesigns#54).
 * Mounts the unified vanilla devbar widgets (canonical in BDS, served from
 * /public on this app) for reviewers on the password-gated staging deploy.
 * Feedback submission is no longer session-gated (this marketing site has no
 * login); the Netlify edge password is the access boundary — see
 * src/app/api/feedback/route.ts and brik-llm#352.
 *
 *   NEXT_PUBLIC_ENABLE_DEV_TOOLS=true → DevBar shell + inspect (auto-loaded
 *                                       by BrikDevBar) + feedback widget in
 *                                       form-mode + user-auth.
 *
 * The env var is inlined at build time, so when it isn't `'true'` the entire
 * branch and the dynamic import below are dead code and tree-shake out of the
 * production bundle. brikdesigns Netlify config sets this only on the staging
 * deploy context (NEXT_PUBLIC_ENV='staging' is the existing signal; this gate
 * lets us flip dev-tools independently of branch context if ever needed).
 */

const SHOW_DEV_TOOLS = process.env.NEXT_PUBLIC_ENABLE_DEV_TOOLS === 'true';

// Lazy: only loaded when SHOW_DEV_TOOLS is true. ssr:false avoids touching
// window during SSR; the BDS shell hydrates client-side anyway.
const BrikDevBar = dynamic(
  () => import('@brikdesigns/bds').then((m) => ({ default: m.BrikDevBar })),
  { ssr: false },
);

// Capability token gating /api/feedback (brikdesigns#444). Inlined at build;
// set only on the staging Netlify context, so the endpoint carried to the
// widget is token-bearing on staging and bare elsewhere (the bare endpoint
// 404s — the route is staging-only). The widget POSTs data-endpoint verbatim,
// so the token rides as a query param without any widget/BDS change.
const FEEDBACK_INTAKE_TOKEN = process.env.NEXT_PUBLIC_FEEDBACK_INTAKE_TOKEN;
const FEEDBACK_ENDPOINT = FEEDBACK_INTAKE_TOKEN
  ? `/api/feedback?k=${encodeURIComponent(FEEDBACK_INTAKE_TOKEN)}`
  : '/api/feedback';

/** Inject /brik-feedback-widget.js once with form-mode + user-auth attrs. */
function FeedbackWidgetLoader() {
  useEffect(() => {
    const MARKER = 'data-brik-feedback-loader';
    if (document.querySelector(`script[${MARKER}]`)) return;
    const s = document.createElement('script');
    s.src = '/brik-feedback-widget.js';
    s.async = false;
    s.setAttribute(MARKER, '');
    s.setAttribute('data-mode', 'form');
    s.setAttribute('data-auth', 'user');
    s.setAttribute('data-endpoint', FEEDBACK_ENDPOINT);
    s.setAttribute('data-context-label', 'Page');
    document.head.appendChild(s);
  }, []);
  return null;
}

export function DevTools() {
  if (!SHOW_DEV_TOOLS) return null;

  return (
    <>
      <BrikDevBar />
      <FeedbackWidgetLoader />
    </>
  );
}
