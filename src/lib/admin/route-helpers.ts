import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { getAuthUser, isBrikAdmin } from '@/lib/auth';
import { AdminInputError } from './_validation';

export class HttpError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
    this.name = 'HttpError';
  }
}

/**
 * Guards an admin route handler:
 *   - returns 401/403 if the caller isn't a Brik super_admin
 *   - catches AdminInputError → 400 with field message
 *   - catches HttpError → its declared status
 *   - catches PostgrestError-shaped errors → 400 with the DB message
 *   - everything else → 500
 *
 * On success, calls `revalidatePath` for the marketing surfaces that should
 * reflect the change, then returns the JSON payload.
 */
export async function adminRoute<T>(
  handler: () => Promise<{ status?: number; body: T; revalidate?: string[] }>,
): Promise<NextResponse> {
  const authUser = await getAuthUser();
  if (!authUser) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (!isBrikAdmin(authUser)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
    const { status = 200, body, revalidate } = await handler();
    revalidate?.forEach((path) => revalidatePath(path));
    return NextResponse.json(body, { status });
  } catch (err) {
    if (err instanceof AdminInputError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    if (err instanceof HttpError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    if (typeof err === 'object' && err !== null && 'message' in err && 'code' in err) {
      const dbErr = err as { message: string; code: string };
      return NextResponse.json({ error: dbErr.message, code: dbErr.code }, { status: 400 });
    }
    console.error('[adminRoute] unhandled error', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function readJsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new AdminInputError('Body must be valid JSON');
  }
}

/**
 * Marketing paths that depend on services/offerings/service_lines.
 * Every successful mutation revalidates this set so edits show up without
 * waiting on the 3600s ISR window.
 */
export const SERVICES_REVALIDATE_PATHS = ['/services', '/'];
