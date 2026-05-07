import {
  adminRoute,
  readJsonBody,
  BLOG_REVALIDATE_PATHS,
} from '@/lib/admin/route-helpers';
import {
  deleteBlogPost,
  getBlogPostById,
  updateBlogPost,
} from '@/lib/admin/blog-posts';

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  return adminRoute(async () => ({
    body: await getBlogPostById(id),
  }));
}

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  const body = await readJsonBody(request);
  return adminRoute(async () => ({
    body: await updateBlogPost(id, body),
    revalidate: BLOG_REVALIDATE_PATHS,
  }));
}

export async function DELETE(_request: Request, { params }: Params) {
  const { id } = await params;
  return adminRoute(async () => {
    await deleteBlogPost(id);
    return { status: 204, body: null, revalidate: BLOG_REVALIDATE_PATHS };
  });
}
