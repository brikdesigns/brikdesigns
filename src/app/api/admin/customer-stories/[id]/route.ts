import {
  adminRoute,
  readJsonBody,
  STORIES_REVALIDATE_PATHS,
} from '@/lib/admin/route-helpers';
import {
  deleteCustomerStory,
  getCustomerStoryById,
  updateCustomerStory,
} from '@/lib/admin/customer-stories';

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  return adminRoute(async () => ({
    body: await getCustomerStoryById(id),
  }));
}

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  const body = await readJsonBody(request);
  return adminRoute(async () => ({
    body: await updateCustomerStory(id, body),
    revalidate: STORIES_REVALIDATE_PATHS,
  }));
}

export async function DELETE(_request: Request, { params }: Params) {
  const { id } = await params;
  return adminRoute(async () => {
    await deleteCustomerStory(id);
    return { status: 204, body: null, revalidate: STORIES_REVALIDATE_PATHS };
  });
}
