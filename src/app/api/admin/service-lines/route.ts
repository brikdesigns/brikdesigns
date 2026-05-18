import { NextResponse } from 'next/server';
import { adminRoute } from '@/lib/admin/route-helpers';
import { listServiceLines } from '@/lib/admin/service-lines';
import { PORTAL_SERVICE_LINES_ADMIN_URL } from '@/lib/portal-url';

export async function GET() {
  return adminRoute(async () => ({
    body: await listServiceLines(),
  }));
}

export async function POST() {
  return NextResponse.json(
    {
      error: 'Service line writes have moved to the portal.',
      portalAdminUrl: PORTAL_SERVICE_LINES_ADMIN_URL,
    },
    { status: 410 },
  );
}
