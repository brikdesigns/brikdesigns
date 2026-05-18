import { NextRequest, NextResponse } from 'next/server';
import { adminRoute } from '@/lib/admin/route-helpers';
import { listOfferings } from '@/lib/admin/offerings';
import { PORTAL_OFFERINGS_ADMIN_URL } from '@/lib/portal-url';

export async function GET(request: NextRequest) {
  const service_id = request.nextUrl.searchParams.get('service_id') ?? undefined;
  return adminRoute(async () => ({
    body: await listOfferings({ service_id }),
  }));
}

export async function POST() {
  return NextResponse.json(
    {
      error: 'Offering writes have moved to the portal.',
      portalAdminUrl: PORTAL_OFFERINGS_ADMIN_URL,
    },
    { status: 410 },
  );
}
