import Link from 'next/link';
import { LinkButton } from '@brikdesigns/bds';
import { PORTAL_SERVICES_ADMIN_URL } from '@/lib/portal-url';

/**
 * Service catalog admin moved to the portal (brikdesigns#178). Marketing CMS
 * keeps its read-only view on the services tab; new-row creation happens in
 * `portal.brikdesigns.com/admin/services` so catalog + Stripe sync + pricing
 * stay in one place.
 */
export default function ServiceNewMovedToPortalPage() {
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
          New service
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
        Create the new service there; it'll appear here automatically once it's
        marked public.
      </p>
      <LinkButton href={PORTAL_SERVICES_ADMIN_URL} variant="primary" size="md">
        Open portal admin ↗
      </LinkButton>
    </div>
  );
}
