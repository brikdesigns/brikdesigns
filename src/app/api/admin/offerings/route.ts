import { NextRequest } from 'next/server';
import {
  adminRoute,
  readJsonBody,
  SERVICES_REVALIDATE_PATHS,
} from '@/lib/admin/route-helpers';
import { createOffering, listOfferings } from '@/lib/admin/offerings';

export async function GET(request: NextRequest) {
  const service_id = request.nextUrl.searchParams.get('service_id') ?? undefined;
  return adminRoute(async () => ({
    body: await listOfferings({ service_id }),
  }));
}

export async function POST(request: Request) {
  const body = await readJsonBody(request);
  return adminRoute(async () => ({
    status: 201,
    body: await createOffering(body),
    revalidate: SERVICES_REVALIDATE_PATHS,
  }));
}
