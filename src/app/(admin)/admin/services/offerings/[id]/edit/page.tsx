import Link from 'next/link';
import { Button } from '@brikdesigns/bds';
import { getOfferingById } from '@/lib/admin/offerings';
import { PORTAL_OFFERINGS_ADMIN_URL } from '@/lib/portal-url';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function OfferingEditMovedToPortalPage({ params }: Props) {
  const { id } = await params;
  const row = await getOfferingById(id).catch(() => null);

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
          {row ? row.name : 'Edit offering'}
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
        Offering edits have moved to the portal admin. Open the portal to update
        this offering.
      </p>
      <Button href={PORTAL_OFFERINGS_ADMIN_URL} variant="primary" size="md">
        Open in portal ↗
      </Button>
    </div>
  );
}
