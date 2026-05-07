import {
  adminRoute,
  readJsonBody,
  SERVICES_REVALIDATE_PATHS,
} from '@/lib/admin/route-helpers';
import { deleteOffering, getOfferingById, updateOffering } from '@/lib/admin/offerings';

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  return adminRoute(async () => ({
    body: await getOfferingById(id),
  }));
}

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  const body = await readJsonBody(request);
  return adminRoute(async () => ({
    body: await updateOffering(id, body),
    revalidate: SERVICES_REVALIDATE_PATHS,
  }));
}

export async function DELETE(_request: Request, { params }: Params) {
  const { id } = await params;
  return adminRoute(async () => {
    await deleteOffering(id);
    return { status: 204, body: null, revalidate: SERVICES_REVALIDATE_PATHS };
  });
}
