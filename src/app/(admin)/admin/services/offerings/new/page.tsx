import Link from 'next/link';
import { Button } from '@brikdesigns/bds';
import { PORTAL_OFFERINGS_ADMIN_URL } from '@/lib/portal-url';

export default function OfferingNewMovedToPortalPage() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap-md)', maxWidth: '640px' }}>
      <div>
        <Link
          href="/admin/services?tab=offerings"
          style={{
            fontFamily: 'var(--font-family-label)',
            fontSize: 'var(--label-sm)',
            color: 'var(--text-secondary)',
            textDecoration: 'none',
          }}
        >
          ← Offerings
        </Link>
        <h1
          style={{
            fontFamily: 'var(--font-family-heading)',
            fontSize: 'var(--heading-lg)',
            color: 'var(--text-primary)',
            margin: 'var(--gap-xs) 0 0',
          }}
        >
          New offering
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
        Offering edits have moved to the portal admin. Create the new offering
        there; it will appear here automatically once it is marked public.
      </p>
      <Button href={PORTAL_OFFERINGS_ADMIN_URL} variant="primary" size="md">
        Open portal admin ↗
      </Button>
    </div>
  );
}
