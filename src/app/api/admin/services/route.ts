import { NextRequest, NextResponse } from 'next/server';
import { adminRoute } from '@/lib/admin/route-helpers';
import { listServices } from '@/lib/admin/services';
import { PORTAL_SERVICES_ADMIN_URL } from '@/lib/portal-url';

export async function GET(request: NextRequest) {
  const service_line_id = request.nextUrl.searchParams.get('service_line_id') ?? undefined;
  return adminRoute(async () => ({
    body: await listServices({ service_line_id }),
  }));
}

// Write methods retired (brikdesigns#178). Service catalog edits live in
// portal admin — return 410 Gone with a pointer so any agent / curl / stale
// UI gets a clear redirect rather than a silent 404 or 405.
export async function POST() {
  return NextResponse.json(
    {
      error: 'Service catalog writes have moved to the portal.',
      portalAdminUrl: PORTAL_SERVICES_ADMIN_URL,
    },
    { status: 410 },
  );
}
