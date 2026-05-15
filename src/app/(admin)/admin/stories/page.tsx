import Link from 'next/link';
import { Button } from '@brikdesigns/bds';
import { Badge } from '@brikdesigns/bds';
import { EntityTable, type EntityTableColumn } from '../_components/EntityTable';
import { listCustomerStories } from '@/lib/admin/customer-stories';

export default async function AdminStoriesPage() {
  const rows = await listCustomerStories();
  const columns: EntityTableColumn<(typeof rows)[number]>[] = [
    { header: 'Title', cell: (r) => r.name },
    { header: 'Client', cell: (r) => r.client_name ?? '—' },
    { header: 'Slug', cell: (r) => r.slug },
    { header: 'Industry', cell: (r) => r.industry ?? '—' },
    { header: 'Rank', cell: (r) => r.rank, width: '80px' },
    {
      header: 'Status',
      cell: (r) =>
        r.is_public ? (
          <Badge status="positive">Public</Badge>
        ) : (
          <Badge status="info">Draft</Badge>
        ),
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
            Customer stories
          </h1>
        </div>
        <Button href="/admin/stories/new" variant="primary" size="md">
          New story
        </Button>
      </div>

      <EntityTable
        rows={rows}
        columns={columns}
        editHref={(r) => `/admin/stories/${r.id}/edit`}
        emptyMessage="No customer stories yet. Click 'New story' to add one."
      />
    </div>
  );
}
