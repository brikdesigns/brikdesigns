import {
  adminRoute,
  readJsonBody,
  STORIES_REVALIDATE_PATHS,
} from '@/lib/admin/route-helpers';
import {
  createCustomerStory,
  listCustomerStories,
} from '@/lib/admin/customer-stories';

export async function GET() {
  return adminRoute(async () => ({
    body: await listCustomerStories(),
  }));
}

export async function POST(request: Request) {
  const body = await readJsonBody(request);
  return adminRoute(async () => ({
    status: 201,
    body: await createCustomerStory(body),
    revalidate: STORIES_REVALIDATE_PATHS,
  }));
}
