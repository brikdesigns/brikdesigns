import { revalidatePath, revalidateTag } from 'next/cache';
import { NextResponse } from 'next/server';

/**
 * ISR revalidation webhook.
 * Called by the portal admin (or Supabase webhook) when marketing content changes.
 *
 * Two invalidation channels — callers should send BOTH where applicable:
 *   - `paths`: busts the full-route render cache (revalidatePath). Required for
 *     pages whose data is fetched directly in the render pass (e.g. blog).
 *   - `tags`:  busts the Next.js data cache for `unstable_cache` entries
 *     (revalidateTag). REQUIRED for CMS reads in src/lib/supabase/queries.ts,
 *     which wrap every query in unstable_cache({ tags: ['cms-*'] }).
 *
 * revalidatePath does NOT invalidate unstable_cache entries that carry their
 * own explicit tags — those are only bustable by revalidateTag or their TTL.
 * Sending paths alone made publishes invisible until the 1h TTL lapsed.
 */
export async function POST(request: Request) {
  const secret = request.headers.get('x-revalidate-secret');
  if (secret !== process.env.REVALIDATION_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { paths, tags } = await request.json();

    const pathList = Array.isArray(paths) ? paths : [];
    const tagList = Array.isArray(tags) ? tags : [];

    if (pathList.length === 0 && tagList.length === 0) {
      return NextResponse.json(
        { error: 'at least one of `paths` or `tags` is required' },
        { status: 400 }
      );
    }

    for (const path of pathList) {
      revalidatePath(path);
    }
    // Next 16: revalidateTag requires a cache-life profile as the 2nd arg.
    // 'max' = strongest purge (Next's own recommended migration value, per the
    // single-arg deprecation message). updateTag() is not usable here — it
    // throws outside a Server Action, and this is a route handler.
    for (const tag of tagList) {
      revalidateTag(tag, 'max');
    }

    return NextResponse.json({ revalidated: true, paths: pathList, tags: tagList });
  } catch (error) {
    console.error('Revalidation error:', error);
    return NextResponse.json(
      { error: 'Revalidation failed' },
      { status: 500 }
    );
  }
}
