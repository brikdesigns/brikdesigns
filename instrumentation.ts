import * as Sentry from '@sentry/nextjs';

const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;

function beforeSendServer(event: Sentry.ErrorEvent): Sentry.ErrorEvent | null {
  const message = event.exception?.values?.[0]?.value ?? '';

  if (message.includes('ChunkLoadError') || message.includes('Loading chunk')) return null;
  if (message.includes('NEXT_NOT_FOUND') || message.includes('NEXT_REDIRECT')) return null;

  return event;
}

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    Sentry.init({
      dsn: SENTRY_DSN,
      enabled: process.env.NODE_ENV === 'production',
      environment: process.env.NODE_ENV,
      tracesSampleRate: 0.1,
      sendDefaultPii: false,
      beforeSend: beforeSendServer,
    });
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    Sentry.init({
      dsn: SENTRY_DSN,
      enabled: process.env.NODE_ENV === 'production',
      environment: process.env.NODE_ENV,
      tracesSampleRate: 0.1,
      sendDefaultPii: false,
      beforeSend: beforeSendServer,
    });
  }
}

export const onRequestError = Sentry.captureRequestError;
