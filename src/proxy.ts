import { type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

// Next 16 renamed the `middleware` convention to `proxy`. The function name
// must match the file name — the file lives at `src/proxy.ts` (the new
// canonical location), so the export here is `proxy`, not `middleware`.
// See https://nextjs.org/docs/messages/middleware-to-proxy.
export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

// Only run on routes that actually need an authenticated session. The prior
// matcher ran updateSession() (→ supabase.auth.getUser()) on every marketing
// nav, the anti-pattern called out in QA - Performance Tips. /login manages
// its own session via the form's server action; /api/* either does its own
// getAuthUser() or is anonymous.
export const config = {
  matcher: ['/admin/:path*'],
};
