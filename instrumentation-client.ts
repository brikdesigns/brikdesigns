import * as Sentry from '@sentry/nextjs';
import { SupabaseClient } from '@supabase/supabase-js';
import { supabaseIntegration } from '@supabase/sentry-js-integration';
import { isBoundaryEvent } from '@/lib/app-error-record';

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;

function beforeSendClient(event: Sentry.ErrorEvent): Sentry.ErrorEvent | null {
  const message = event.exception?.values?.[0]?.value ?? '';

  // An error that reached `src/app/error.tsx` took the whole route down — it is
  // never the background noise the drop list below exists for, whatever class
  // it is. Three boundary renders on record (#1403) are absent from Sentry
  // precisely because `ChunkLoadError` is dropped here, and a cold deployment
  // is exactly when a still-open document requests chunk hashes the new build
  // no longer serves. Exempt the boundary, keep the filters for everything else.
  if (isBoundaryEvent(event.tags)) return event;

  const frames = event.exception?.values?.[0]?.stacktrace?.frames ?? [];
  if (frames.some((f) => f.filename?.includes('chrome-extension://') || f.filename?.includes('moz-extension://'))) {
    return null;
  }

  if (message.includes('ResizeObserver')) return null;
  if (message.includes('ChunkLoadError') || message.includes('Loading chunk')) return null;
  if (message.includes('AbortError') || message.includes('The user aborted a request')) return null;

  return event;
}

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: process.env.NODE_ENV === 'production',
  environment: process.env.NODE_ENV,

  tracesSampleRate: 0.1,
  sendDefaultPii: false,
  beforeSend: beforeSendClient,

  integrations: [
    supabaseIntegration(SupabaseClient, Sentry, { tracing: true, breadcrumbs: true, errors: true }),
    Sentry.replayIntegration(),
  ],

  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 1.0,
});
