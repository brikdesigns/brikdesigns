import { EditPageShell } from '../../_components/EditPageShell';
import { EntityForm } from '../../_components/EntityForm';
import { blogPostFields } from '../_components/field-configs';

export default function NewBlogPostPage() {
  return (
    <EditPageShell
      backHref="/admin/blog"
      backLabel="Blog"
      title="New blog post"
      subtitle="Authoring is plain Markdown / MDX in the Content field. Drafts default to status='draft'."
    >
      <EntityForm
        fields={blogPostFields()}
        initial={{ status: 'draft', author: 'Brik Designs', featured: false }}
        endpoint="/api/admin/blog-posts"
        mode="create"
        successHref="/admin/blog"
      />
    </EditPageShell>
  );
}
