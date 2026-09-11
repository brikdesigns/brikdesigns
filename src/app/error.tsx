'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import * as Sentry from '@sentry/nextjs';
import { Button } from '@brikdesigns/bds';
import { color, font, space, gap, border, width } from '@/lib/tokens';
import { heading, text } from '@/lib/styles';
import {
  BOUNDARY_TAG,
  formatRecord,
  type BoundaryError as RecordedError,
} from '@/lib/app-error-record';

/**
 * App Router error boundary — the instrumentation half of #1403.
 *
 * Until this file existed there was no `error.tsx` anywhere under `src/app/`,
 * so a throw fell through to Next's built-in boundary
 * (`next/dist/client/components/builtin/app-error.js`, the "This page couldn't
 * load" copy). That boundary renders nothing identifying: three occurrences on
 * record — home [light/desktop], industry-dental [dark/tablet], fma
 * [dark/mobile] — produced a screenshot each and no error name, message,
 * digest or route anywhere.
 *
 * Sentry WAS already wired for both runtimes (`instrumentation.ts:48`,
 * `instrumentation-client.ts:22`) and none of the three is in it. The reason is
 * `beforeSendClient`: it drops `ChunkLoadError` / `Loading chunk`, which is the
 * error class a COLD DEPLOYMENT produces when a still-open document asks for
 * chunk hashes the new build no longer serves. That filter is correct for
 * background noise and wrong for a boundary render, so this component tags its
 * capture `boundary: 'app-error'` and `beforeSendClient` now exempts that tag.
 *
 * ── Why this renders no <main> ────────────────────────────────────────────
 *
 * `tests/a11y/lib/goto-rendered.ts:51-53` records the measured failure mode: a
 * 500 that renders `<main>` inside a layout slips the `<main>` guard every
 * a11y spec carries, and `card-treatment.spec.ts` passed 16/16 against one. If
 * this boundary rendered `<main>`, every such spec would start measuring the
 * error page as though it were the route — turning a loud infra failure into
 * quiet, real-looking debt. The landmark is deliberately absent; `role="alert"`
 * plus `data-app-error` are what a spec keys on instead.
 */

type BoundaryError = Error & RecordedError;

export default function AppError({
  error,
  reset,
}: {
  error: BoundaryError;
  reset: () => void;
}) {
  const pathname = usePathname();

  // Derived in render, not in an effect: the rendered record has to be in the
  // first painted frame or a CI screenshot can race it, and it is a pure
  // function of props. Neither the Sentry event id nor a wall-clock stamp is
  // rendered — both would make this non-deterministic, and neither is needed to
  // find the event: Sentry is queryable by the `route` tag below, and for a
  // server error `digest` is the join key to what `onRequestError` captured.
  const record = formatRecord(error, pathname ?? '', undefined, '(see console)');

  useEffect(() => {
    // `boundary` is the tag `beforeSendClient` exempts from its drop list — a
    // boundary render is never background noise, whatever class it is.
    const eventId = Sentry.captureException(error, {
      tags: { boundary: BOUNDARY_TAG, route: pathname ?? '(unknown)' },
      extra: { digest: error.digest },
    });
    // The console copy carries the two fields the DOM copy leaves out, and is
    // what a Playwright `page.on('console')` listener sees.
    console.error(formatRecord(error, pathname ?? '', eventId, new Date().toISOString()));
  }, [error, pathname]);

  return (
    <div
      role="alert"
      data-app-error="1"
      style={{
        maxWidth: width.narrow,
        margin: '0 auto',
        padding: space.xl,
        display: 'flex',
        flexDirection: 'column',
        gap: gap.md,
        textAlign: 'center',
      }}
    >
      <h1 style={heading.page}>This page didn&apos;t load</h1>
      <p style={text.muted}>
        Something went wrong on our side. Try again — it usually clears on a
        reload.
      </p>
      <div>
        <Button variant="primary" size="lg" onClick={reset}>
          Try again
        </Button>
      </div>

      {/* The durable record (#1403 AC 1). Rendered, not just logged, so the
          visual-regression gate's own screenshot identifies the error instead
          of only proving one happened. */}
      <code
        data-app-error-record
        style={{
          display: 'block',
          marginTop: gap.md,
          padding: space.sm,
          borderRadius: border.radius.sm,
          border: `${border.width.sm} solid ${color.border.muted}`,
          background: color.background.secondary,
          fontFamily: font.family.mono,
          fontSize: font.size.body.tiny,
          lineHeight: font.lineHeight.normal,
          color: color.text.muted,
          textAlign: 'left',
          overflowWrap: 'anywhere',
        }}
      >
        {record}
      </code>
    </div>
  );
}
