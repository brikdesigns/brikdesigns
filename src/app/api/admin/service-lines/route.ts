import {
  adminRoute,
  readJsonBody,
  SERVICES_REVALIDATE_PATHS,
} from '@/lib/admin/route-helpers';
import { createServiceLine, listServiceLines } from '@/lib/admin/service-lines';

export async function GET() {
  return adminRoute(async () => ({
    body: await listServiceLines(),
  }));
}

export async function POST(request: Request) {
  const body = await readJsonBody(request);
  return adminRoute(async () => ({
    status: 201,
    body: await createServiceLine(body),
    revalidate: SERVICES_REVALIDATE_PATHS,
  }));
}
