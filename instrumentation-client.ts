import * as Sentry from '@sentry/nextjs';

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;

function beforeSendClient(event: Sentry.ErrorEvent): Sentry.ErrorEvent | null {
  const message = event.exception?.values?.[0]?.value ?? '';

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

  integrations: [Sentry.replayIntegration()],

  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 1.0,
});
