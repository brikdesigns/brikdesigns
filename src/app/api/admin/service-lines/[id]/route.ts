import { NextResponse } from 'next/server';
import { adminRoute } from '@/lib/admin/route-helpers';
import { getServiceLineById } from '@/lib/admin/service-lines';
import { PORTAL_SERVICE_LINES_ADMIN_URL } from '@/lib/portal-url';

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  return adminRoute(async () => ({
    body: await getServiceLineById(id),
  }));
}

export async function PATCH() {
  return NextResponse.json(
    {
      error: 'Service line writes have moved to the portal.',
      portalAdminUrl: PORTAL_SERVICE_LINES_ADMIN_URL,
    },
    { status: 410 },
  );
}

export async function DELETE() {
  return NextResponse.json(
    {
      error: 'Service line writes have moved to the portal.',
      portalAdminUrl: PORTAL_SERVICE_LINES_ADMIN_URL,
    },
    { status: 410 },
  );
}
