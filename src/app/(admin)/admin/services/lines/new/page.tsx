import Link from 'next/link';
import { Button } from '@brikdesigns/bds';
import { PORTAL_SERVICE_LINES_ADMIN_URL } from '@/lib/portal-url';

export default function ServiceLineNewMovedToPortalPage() {
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
          New service line
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
        Service line edits have moved to the portal admin. Create the new service
        line there; it will appear here automatically once it is marked public.
      </p>
      <Button href={PORTAL_SERVICE_LINES_ADMIN_URL} variant="primary" size="md">
        Open portal admin ↗
      </Button>
    </div>
  );
}
