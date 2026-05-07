import {
  adminRoute,
  readJsonBody,
  BLOG_REVALIDATE_PATHS,
} from '@/lib/admin/route-helpers';
import { createBlogPost, listBlogPosts } from '@/lib/admin/blog-posts';

export async function GET() {
  return adminRoute(async () => ({
    body: await listBlogPosts(),
  }));
}

export async function POST(request: Request) {
  const body = await readJsonBody(request);
  return adminRoute(async () => ({
    status: 201,
    body: await createBlogPost(body),
    revalidate: BLOG_REVALIDATE_PATHS,
  }));
}
