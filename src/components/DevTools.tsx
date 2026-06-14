'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';

/**
 * Brik DevTools — staging-only QA overlay.
 *
 * Phase 3 of brikdesigns/brik-llm#352 (issue brikdesigns/brikdesigns#54).
 * Mounts the unified BDS dev widgets for reviewers on the staging deploy:
 * the DevBar shell + inspect (auto-loaded vanilla widgets from /public) plus
 * the shared React `DevFeedbackWidget` from BDS. Feedback submission is gated
 * by a capability token, not a session — this marketing site has no login;
 * see src/app/api/feedback/route.ts and brik-llm#352.
 *
 *   NEXT_PUBLIC_ENABLE_DEV_TOOLS=true → DevBar shell + inspect (auto-loaded
 *                                       by BrikDevBar) + the BDS feedback
 *                                       widget, bridged to the inspector.
 *
 * The env var is inlined at build time, so when it isn't `'true'` the entire
 * branch and the dynamic imports below are dead code and tree-shake out of the
 * production bundle. brikdesigns Netlify config sets this only on the staging
 * deploy context (NEXT_PUBLIC_ENV='staging' is the existing signal; this gate
 * lets us flip dev-tools independently of branch context if ever needed).
 *
 * Migrated 2026-06-14 (brikdesigns#479) from the vanilla brik-feedback-widget.js
 * injection to the shared React `DevFeedbackWidget` (requires @brikdesigns/bds
 * >= 0.97.1). This wires the inspector → feedback bridge (ADR-007, brik-bds#880):
 * the inspector owns element selection and emits `brik:inspect:report`; we
 * capture its context and open the form pre-filled so a submission surfaces the
 * inspected component in the Notion Backlog. Mirrors the portal/renew-pms hosts.
 */

const SHOW_DEV_TOOLS = process.env.NEXT_PUBLIC_ENABLE_DEV_TOOLS === 'true';

// Lazy: only loaded when SHOW_DEV_TOOLS is true. ssr:false avoids touching
// window during SSR; the BDS shell hydrates client-side anyway.
const BrikDevBar = dynamic(
  () => import('@brikdesigns/bds').then((m) => ({ default: m.BrikDevBar })),
  { ssr: false },
);

const BdsDevFeedbackWidget = dynamic(
  () =>
    import('@brikdesigns/bds').then((m) => ({ default: m.DevFeedbackWidget })),
  { ssr: false },
);

// Capability token gating /api/feedback (brikdesigns#444). Inlined at build;
// set only on the staging Netlify context, so the endpoint carried to the
// widget is token-bearing on staging and bare elsewhere (the bare endpoint
// 404s — the route is staging-only). The widget POSTs the endpoint verbatim,
// so the token rides as a query param without any widget/BDS change.
const FEEDBACK_INTAKE_TOKEN = process.env.NEXT_PUBLIC_FEEDBACK_INTAKE_TOKEN;
const FEEDBACK_ENDPOINT = FEEDBACK_INTAKE_TOKEN
  ? `/api/feedback?k=${encodeURIComponent(FEEDBACK_INTAKE_TOKEN)}`
  : '/api/feedback';

// Element context emitted by the inspector's "Feedback" action (ADR-007).
interface InspectReport {
  page?: string;
  section?: string;
  component?: string;
  element_tag?: string;
}

/**
 * Bridges the inspector → feedback form and mounts the BDS widget.
 *
 * Deferred until the DevBar shell is present so the widget's internal
 * devBarPresent check catches it synchronously on first render and the
 * fallback FAB never flashes during hydration (matches portal).
 */
function FeedbackBridge() {
  const [barReady, setBarReady] = useState(false);
  const [captured, setCaptured] = useState<InspectReport | null>(null);

  // Poll for the DevBar shell (brik-devbar.js attaches window.BrikDevBar).
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const iv = setInterval(() => {
      if (window.BrikDevBar) {
        setBarReady(true);
        clearInterval(iv);
      }
    }, 100);
    return () => clearInterval(iv);
  }, []);

  // Bridge the inspector → feedback form (ADR-007). The inspector owns element
  // selection and emits brik:inspect:report; we capture its context into props
  // and open the form. The widget's open state is driven by its DevBar slot
  // (setActive is visual-only and does not fire onActivate), so we open by
  // clicking the slot button — the only public open trigger devbar.js exposes.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onReport = (e: Event) => {
      const detail = (e as CustomEvent<InspectReport>).detail ?? {};
      setCaptured(detail);
      const slot = document.querySelector<HTMLElement>(
        '.bdb-slot[data-slot-id="feedback"]',
      );
      if (slot && slot.getAttribute('data-active') !== 'true') slot.click();
    };
    window.addEventListener('brik:inspect:report', onReport);
    return () => window.removeEventListener('brik:inspect:report', onReport);
  }, []);

  if (!barReady) return null;

  return (
    <BdsDevFeedbackWidget
      endpoint={FEEDBACK_ENDPOINT}
      contextLabel="Page"
      page={captured?.page}
      section={captured?.section}
      component={captured?.component}
    />
  );
}

export function DevTools() {
  if (!SHOW_DEV_TOOLS) return null;

  return (
    <>
      <BrikDevBar />
      <FeedbackBridge />
    </>
  );
}
