import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { withFetchDiagnostics } from './fetch-diagnostics';

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Server Component — can't set cookies, safe to ignore
          }
        },
      },
    }
  );
}

/**
 * Cookie-free client for public CMS reads. Safe to use inside
 * `unstable_cache` callbacks — those run outside request context on cache
 * hits, so `cookies()` must not be called. All queries wrapped with
 * `unstable_cache` in queries.ts use this client; auth-gated routes
 * continue to use `createClient()`.
 *
 * This is the client every prerendered CMS read goes through, so it carries
 * the transport diagnostics (#1196): a build that fails here reports the
 * connection error rather than blaming the route that held the socket.
 */
export function createPublicClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: { getAll: () => [], setAll: () => {} },
      global: { fetch: withFetchDiagnostics() },
    }
  );
}

/**
 * Service role client for server-side admin operations (lead creation, etc.).
 * Never expose this in client-side code.
 */
export function createServiceClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        getAll() { return []; },
        setAll() {},
      },
    }
  );
}
