import { NextResponse } from 'next/server';
import { adminRoute } from '@/lib/admin/route-helpers';
import { getServiceById } from '@/lib/admin/services';
import { PORTAL_SERVICES_ADMIN_URL, portalServiceEditUrl } from '@/lib/portal-url';

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  return adminRoute(async () => ({
    body: await getServiceById(id),
  }));
}

// PATCH + DELETE retired (brikdesigns#178). Service catalog edits live in
// portal admin. Resolve the slug when possible so the 410 body points at
// the precise portal record; fall back to the catalog landing if not.
export async function PATCH(_request: Request, { params }: Params) {
  const { id } = await params;
  const row = await getServiceById(id).catch(() => null);
  const portalAdminUrl = row ? portalServiceEditUrl(row.slug) : PORTAL_SERVICES_ADMIN_URL;
  return NextResponse.json(
    {
      error: 'Service catalog writes have moved to the portal.',
      portalAdminUrl,
    },
    { status: 410 },
  );
}

export async function DELETE(_request: Request, { params }: Params) {
  const { id } = await params;
  const row = await getServiceById(id).catch(() => null);
  const portalAdminUrl = row ? portalServiceEditUrl(row.slug) : PORTAL_SERVICES_ADMIN_URL;
  return NextResponse.json(
    {
      error: 'Service catalog writes have moved to the portal.',
      portalAdminUrl,
    },
    { status: 410 },
  );
}
