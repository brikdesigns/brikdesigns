/**
 * Transport-failure diagnostics for Supabase CMS reads (brikdesigns#1196).
 *
 * A failed `fetch` rejects with a bare `TypeError: fetch failed`. Everything
 * useful — the errno and the address that was reached — lives on `err.cause`,
 * and under happy-eyeballs across multiple A records on `cause.errors[]`.
 * Next serialises the rejection to `{message, details, hint, code}` before
 * printing it, so those fields never reach the operator; what they see is
 * `Error occurred prerendering page "/about"`, naming whichever of 33 pages
 * happened to hold the socket. #1181 was diagnosed as an off-host network
 * fault only after that message sent two sessions to inspect an innocent route.
 *
 * These helpers are dependency-free on purpose: `fetch-diagnostics.test.mjs`
 * imports this module directly, so nothing here may pull in `next/headers`
 * or `@supabase/ssr`.
 */

/** Node attaches errno details to the cause; none of these are on `Error`. */
type TransportCause = {
  code?: string;
  address?: string;
  port?: number;
  errors?: unknown[];
};

const asCause = (value: unknown): TransportCause =>
  typeof value === 'object' && value !== null ? (value as TransportCause) : {};

/**
 * `ECONNREFUSED@104.18.38.10:443`, degrading to whichever parts exist.
 * Returns null when the cause carries no transport detail at all, so callers
 * can tell "no diagnostics" apart from a legitimately empty string.
 */
function formatCause(value: unknown): string | null {
  const { code, address, port } = asCause(value);
  const where = address ? (port === undefined ? address : `${address}:${port}`) : '';
  if (!code && !where) return null;
  if (!where) return code!;
  return code ? `${code}@${where}` : where;
}

/**
 * Every transport detail on a rejection, newest-Node shape first.
 *
 * Happy-eyeballs raises an `AggregateError` whose `errors[]` holds one entry
 * per address attempted — that is the shape #1181 captured, and the per-address
 * codes are the whole signal (they disagree: one address times out while the
 * other is refused). A single-address failure has no `errors[]`, so fall back
 * to the cause itself.
 */
export function describeTransportFailure(error: unknown): string[] {
  const cause = (error as { cause?: unknown } | null)?.cause;
  const { errors } = asCause(cause);

  if (Array.isArray(errors) && errors.length > 0) {
    const described = errors.map((entry) => formatCause(entry)).filter((d): d is string => d !== null);
    if (described.length > 0) return described;
  }

  const single = formatCause(cause);
  return single === null ? [] : [single];
}

/**
 * Wrap a `fetch` so a transport failure says so, naming the codes and
 * addresses instead of leaving `fetch failed` to be blamed on a route.
 *
 * Pass-through on success and on any rejection carrying no transport detail —
 * an aborted request or a thrown non-Error must not be reshaped into a
 * connection error it is not.
 */
export function withFetchDiagnostics(impl: typeof fetch = fetch): typeof fetch {
  return async function fetchWithDiagnostics(...args) {
    try {
      return await impl(...args);
    } catch (error) {
      const details = describeTransportFailure(error);
      if (details.length === 0) throw error;

      const target = typeof args[0] === 'string' ? args[0] : String((args[0] as Request | URL)?.toString?.() ?? '');
      throw new Error(
        `Supabase request failed at the transport layer, not in the page being rendered: ` +
          `${details.join(', ')}${target ? ` (requesting ${target})` : ''}. ` +
          `If a build reported this while prerendering a route, that route is not the fault — see brikdesigns#1181.`,
        { cause: error }
      );
    }
  };
}
