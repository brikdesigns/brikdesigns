/**
 * The app-error boundary's record format and its Sentry-drop exemption (#1403).
 *
 * Both halves live here rather than inline in `src/app/error.tsx` /
 * `instrumentation-client.ts` for the reason #1361 gave: a rule with no offline
 * self-test is a rule that only CI can contradict, and only on a run that
 * happens to reproduce. Neither function touches React, Sentry or the DOM, so
 * `app-error-record.test.ts` can exercise them with no browser and no network.
 */

/** The shape React hands an App Router `error.tsx`. */
export type BoundaryError = { name?: string; message?: string; digest?: string };

/** The Sentry tag `src/app/error.tsx` sets and `beforeSendClient` exempts. */
export const BOUNDARY_TAG = 'app-error';

/**
 * The durable record — one machine-greppable line, identical in the DOM and the
 * console.
 *
 * Order is fixed and each field is `key=value`, so a CI screenshot, a console
 * dump and a Sentry breadcrumb all read the same way and a grep for `route=` or
 * `digest=` works against any of the three. `digest` is the load-bearing field
 * for a server error: React redacts the message in production builds, so the
 * digest is the only key that joins the browser-side record to the server log
 * Sentry captured via `onRequestError` (`instrumentation.ts:48`).
 */
export function formatRecord(
  error: BoundaryError,
  route: string,
  eventId: string | undefined,
  at: string,
): string {
  return [
    BOUNDARY_TAG,
    `name=${error.name || 'Error'}`,
    `message=${error.message || '(none)'}`,
    `route=${route || '(unknown)'}`,
    `digest=${error.digest ?? '(none)'}`,
    `sentry=${eventId ?? '(not sent)'}`,
    `at=${at}`,
  ].join(' · ');
}

/**
 * Whether an event came from the app-error boundary, and so must bypass
 * `beforeSendClient`'s drop list.
 *
 * The drop list is right about background noise and wrong about a boundary
 * render. `ChunkLoadError` is the clearest case: it is routine when a lazy
 * chunk races a navigation, and it is *the* expected class on a cold
 * deployment, where a still-open document requests chunk hashes the new build
 * no longer serves. Three boundary renders are on record for this app and none
 * of them reached Sentry — the filter at `instrumentation-client.ts` is why.
 * An error that took the whole route down is never noise.
 */
export function isBoundaryEvent(tags: Record<string, unknown> | undefined): boolean {
  return tags?.boundary === BOUNDARY_TAG;
}
