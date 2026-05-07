import { notFound } from 'next/navigation';
import { EditPageShell } from '../../../_components/EditPageShell';
import { EntityForm } from '../../../_components/EntityForm';
import { blogPostFields } from '../../_components/field-configs';
import { getBlogPostById } from '@/lib/admin/blog-posts';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function EditBlogPostPage({ params }: Props) {
  const { id } = await params;
  const row = await getBlogPostById(id).catch(() => null);
  if (!row) notFound();

  return (
    <EditPageShell
      backHref="/admin/blog"
      backLabel="Blog"
      title={row.title}
      subtitle={`Slug: ${row.slug} · Status: ${row.status}`}
    >
      <EntityForm
        fields={blogPostFields()}
        initial={row}
        endpoint="/api/admin/blog-posts"
        mode="edit"
        id={row.id}
        successHref="/admin/blog"
      />
    </EditPageShell>
  );
}
