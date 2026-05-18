import { NextResponse } from 'next/server';
import { adminRoute } from '@/lib/admin/route-helpers';
import { getOfferingById } from '@/lib/admin/offerings';
import { PORTAL_OFFERINGS_ADMIN_URL } from '@/lib/portal-url';

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  return adminRoute(async () => ({
    body: await getOfferingById(id),
  }));
}

export async function PATCH() {
  return NextResponse.json(
    {
      error: 'Offering writes have moved to the portal.',
      portalAdminUrl: PORTAL_OFFERINGS_ADMIN_URL,
    },
    { status: 410 },
  );
}

export async function DELETE() {
  return NextResponse.json(
    {
      error: 'Offering writes have moved to the portal.',
      portalAdminUrl: PORTAL_OFFERINGS_ADMIN_URL,
    },
    { status: 410 },
  );
}
