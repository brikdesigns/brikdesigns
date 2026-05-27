import Link from 'next/link';
import { Button } from '@brikdesigns/bds';
import { getServiceById } from '@/lib/admin/services';
import { portalServiceEditUrl, PORTAL_SERVICES_ADMIN_URL } from '@/lib/portal-url';

/**
 * Service catalog edits moved to the portal (brikdesigns#178). This page
 * still resolves the service so the deep-link to portal admin is precise;
 * if the row is gone we surface the catalog landing instead.
 */
interface Props {
  params: Promise<{ id: string }>;
}

export default async function ServiceEditMovedToPortalPage({ params }: Props) {
  const { id } = await params;
  const row = await getServiceById(id).catch(() => null);
  const portalHref = row ? portalServiceEditUrl(row.slug) : PORTAL_SERVICES_ADMIN_URL;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap-md)', maxWidth: '640px' }}>
      <div>
        <Link
          href="/admin/services?tab=services"
          style={{
            fontFamily: 'var(--font-family-label)',
            fontSize: 'var(--label-sm)',
            color: 'var(--text-secondary)',
            textDecoration: 'none',
          }}
        >
          ← Services
        </Link>
        <h1
          style={{
            fontFamily: 'var(--font-family-heading)',
            fontSize: 'var(--heading-lg)',
            color: 'var(--text-primary)',
            margin: 'var(--gap-xs) 0 0',
          }}
        >
          {row ? row.name : 'Edit service'}
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
        Service catalog edits live in the portal admin (catalog tab + Stripe sync).
        Open this service in the portal to update it.
      </p>
      <Button href={portalHref} variant="primary" size="md">
        Open in portal ↗
      </Button>
    </div>
  );
}
