import { NextRequest } from 'next/server';
import {
  adminRoute,
  readJsonBody,
  SERVICES_REVALIDATE_PATHS,
} from '@/lib/admin/route-helpers';
import { createService, listServices } from '@/lib/admin/services';

export async function GET(request: NextRequest) {
  const service_line_id = request.nextUrl.searchParams.get('service_line_id') ?? undefined;
  return adminRoute(async () => ({
    body: await listServices({ service_line_id }),
  }));
}

export async function POST(request: Request) {
  const body = await readJsonBody(request);
  return adminRoute(async () => ({
    status: 201,
    body: await createService(body),
    revalidate: SERVICES_REVALIDATE_PATHS,
  }));
}
