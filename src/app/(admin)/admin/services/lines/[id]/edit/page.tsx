import Link from 'next/link';
import { Button } from '@brikdesigns/bds';
import { getServiceLineById } from '@/lib/admin/service-lines';
import { PORTAL_SERVICE_LINES_ADMIN_URL } from '@/lib/portal-url';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ServiceLineEditMovedToPortalPage({ params }: Props) {
  const { id } = await params;
  const row = await getServiceLineById(id).catch(() => null);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap-md)', maxWidth: '640px' }}>
      <div>
        <Link
          href="/admin/services?tab=lines"
          style={{
            fontFamily: 'var(--font-family-label)',
            fontSize: 'var(--label-sm)',
            color: 'var(--text-secondary)',
            textDecoration: 'none',
          }}
        >
          ← Service lines
        </Link>
        <h1
          style={{
            fontFamily: 'var(--font-family-heading)',
            fontSize: 'var(--heading-lg)',
            color: 'var(--text-primary)',
            margin: 'var(--gap-xs) 0 0',
          }}
        >
          {row ? row.name : 'Edit service line'}
        </h1>
      </div>
      <p
        style={{
          fontFamily: 'var(--font-family-body)',
          fontSize: 'var(--body-md)',
          color: 'var(--text-primary)',
          margin: 0,
        }}
      >
        Service line edits have moved to the portal admin. Open the portal to
        update this service line.
      </p>
      <Button href={PORTAL_SERVICE_LINES_ADMIN_URL} variant="primary" size="md">
        Open in portal ↗
      </Button>
    </div>
  );
}
