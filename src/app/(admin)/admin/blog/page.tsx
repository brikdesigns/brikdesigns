import Link from 'next/link';
import { LinkButton } from '@brikdesigns/bds';
import { Badge } from '@brikdesigns/bds';
import { EntityTable, type EntityTableColumn } from '../_components/EntityTable';
import { listBlogPosts } from '@/lib/admin/blog-posts';

function StatusBadge({ status }: { status: string }) {
  if (status === 'published') return <Badge status="positive">Published</Badge>;
  if (status === 'archived') return <Badge status="warning">Archived</Badge>;
  return <Badge status="info">Draft</Badge>;
}

export default async function AdminBlogPage() {
  const rows = await listBlogPosts();
  const columns: EntityTableColumn<(typeof rows)[number]>[] = [
    { header: 'Title', cell: (r) => r.title },
    { header: 'Slug', cell: (r) => r.slug },
    {
      header: 'Published',
      cell: (r) =>
        r.published_at
          ? new Date(r.published_at).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })
          : '—',
      width: '140px',
    },
    {
      header: 'Featured',
      cell: (r) => (r.featured ? 'Yes' : '—'),
      width: '100px',
    },
    {
      header: 'Status',
      cell: (r) => <StatusBadge status={r.status} />,
      width: '120px',
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap-md)' }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <div>
          <Link
            href="/admin"
            style={{
              fontFamily: 'var(--font-family-label)',
              fontSize: 'var(--label-sm)',
              color: 'var(--text-secondary)',
              textDecoration: 'none',
            }}
          >
            ← Admin
          </Link>
          <h1
            style={{
              fontFamily: 'var(--font-family-heading)',
              fontSize: 'var(--heading-lg)',
              color: 'var(--text-primary)',
              margin: 'var(--gap-xs) 0 0',
            }}
          >
            Blog
          </h1>
        </div>
        <LinkButton href="/admin/blog/new" variant="primary" size="md">
          New post
        </LinkButton>
      </div>

      <EntityTable
        rows={rows}
        columns={columns}
        editHref={(r) => `/admin/blog/${r.id}/edit`}
        emptyMessage="No blog posts yet. Click 'New post' to add one."
      />
    </div>
  );
}
