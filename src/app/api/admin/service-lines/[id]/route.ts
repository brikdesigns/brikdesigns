import {
  adminRoute,
  readJsonBody,
  SERVICES_REVALIDATE_PATHS,
} from '@/lib/admin/route-helpers';
import {
  deleteServiceLine,
  getServiceLineById,
  updateServiceLine,
} from '@/lib/admin/service-lines';

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  return adminRoute(async () => ({
    body: await getServiceLineById(id),
  }));
}

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  const body = await readJsonBody(request);
  return adminRoute(async () => ({
    body: await updateServiceLine(id, body),
    revalidate: SERVICES_REVALIDATE_PATHS,
  }));
}

export async function DELETE(_request: Request, { params }: Params) {
  const { id } = await params;
  return adminRoute(async () => {
    await deleteServiceLine(id);
    return { status: 204, body: null, revalidate: SERVICES_REVALIDATE_PATHS };
  });
}
