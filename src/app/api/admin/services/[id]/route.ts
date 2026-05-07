import {
  adminRoute,
  readJsonBody,
  SERVICES_REVALIDATE_PATHS,
} from '@/lib/admin/route-helpers';
import { deleteService, getServiceById, updateService } from '@/lib/admin/services';

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  return adminRoute(async () => ({
    body: await getServiceById(id),
  }));
}

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  const body = await readJsonBody(request);
  return adminRoute(async () => ({
    body: await updateService(id, body),
    revalidate: SERVICES_REVALIDATE_PATHS,
  }));
}

export async function DELETE(_request: Request, { params }: Params) {
  const { id } = await params;
  return adminRoute(async () => {
    await deleteService(id);
    return { status: 204, body: null, revalidate: SERVICES_REVALIDATE_PATHS };
  });
}
