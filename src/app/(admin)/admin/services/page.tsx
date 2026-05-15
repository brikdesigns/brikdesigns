import Link from 'next/link';
import { LinkButton } from '@brikdesigns/bds';
import { Badge } from '@brikdesigns/bds';
import { ServicesTabs } from './_components/Tabs';
import { EntityTable, type EntityTableColumn } from '../_components/EntityTable';
import { listServiceLines } from '@/lib/admin/service-lines';
import { listServices } from '@/lib/admin/services';
import { listOfferings } from '@/lib/admin/offerings';
import { PORTAL_SERVICES_ADMIN_URL, portalServiceEditUrl } from '@/lib/portal-url';

interface Props {
  searchParams: Promise<{ tab?: string }>;
}

type TabId = 'lines' | 'services' | 'offerings';

function isTab(v: string | undefined): v is TabId {
  return v === 'lines' || v === 'services' || v === 'offerings';
}

export default async function AdminServicesPage({ searchParams }: Props) {
  const { tab } = await searchParams;
  const active: TabId = isTab(tab) ? tab : 'lines';

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
            Services
          </h1>
        </div>
        <NewButton tab={active} />
      </div>

      <ServicesTabs active={active} />

      {active === 'lines' && <ServiceLinesPanel />}
      {active === 'services' && <ServicesPanel />}
      {active === 'offerings' && <OfferingsPanel />}
    </div>
  );
}

function NewButton({ tab }: { tab: TabId }) {
  // The `services` tab is read-only here — portal admin owns service catalog
  // edits + Stripe sync (#178). Surface a portal link instead of a "New"
  // button. The `lines` + `offerings` tabs stay writable until portal builds
  // admin UIs for them.
  if (tab === 'services') {
    return (
      <LinkButton
        href={PORTAL_SERVICES_ADMIN_URL}
        variant="secondary"
        size="md"
      >
        Manage in portal ↗
      </LinkButton>
    );
  }
  const map: Record<Exclude<TabId, 'services'>, { href: string; label: string }> = {
    lines: { href: '/admin/services/lines/new', label: 'New service line' },
    offerings: { href: '/admin/services/offerings/new', label: 'New offering' },
  };
  const cfg = map[tab];
  return (
    <LinkButton href={cfg.href} variant="primary" size="md">
      {cfg.label}
    </LinkButton>
  );
}

function PublicBadge({ value }: { value: boolean }) {
  return value ? (
    <Badge status="positive">Public</Badge>
  ) : (
    <Badge status="info">Draft</Badge>
  );
}

async function ServiceLinesPanel() {
  const rows = await listServiceLines();
  const columns: EntityTableColumn<(typeof rows)[number]>[] = [
    { header: 'Name', cell: (r) => r.name },
    { header: 'Slug', cell: (r) => r.slug },
    { header: 'Tagline', cell: (r) => r.tagline ?? '—' },
    { header: 'Rank', cell: (r) => r.rank, width: '80px' },
    { header: 'Status', cell: (r) => <PublicBadge value={r.is_public} />, width: '120px' },
  ];
  return (
    <EntityTable
      rows={rows}
      columns={columns}
      editHref={(r) => `/admin/services/lines/${r.id}/edit`}
      emptyMessage="No service lines yet. Click 'New service line' to add one."
    />
  );
}

async function ServicesPanel() {
  const rows = await listServices();
  type Row = (typeof rows)[number] & {
    slug: string;
    service_lines: { name: string; slug: string } | null;
  };
  const columns: EntityTableColumn<Row>[] = [
    { header: 'Name', cell: (r) => r.name },
    { header: 'Slug', cell: (r) => r.slug },
    { header: 'Service line', cell: (r) => r.service_lines?.name ?? '—' },
    { header: 'Rank', cell: (r) => r.rank, width: '80px' },
    { header: 'Status', cell: (r) => <PublicBadge value={r.is_public} />, width: '120px' },
  ];
  // Read-only: portal admin owns service-catalog edits (#178). Action column
  // deep-links each row to the portal admin detail page by slug.
  return (
    <>
      <ReadOnlyNotice />
      <EntityTable
        rows={rows as Row[]}
        columns={columns}
        editHref={(r) => portalServiceEditUrl(r.slug)}
        actionLabel="View in portal ↗"
        emptyMessage="No services yet."
      />
    </>
  );
}

function ReadOnlyNotice() {
  return (
    <p
      style={{
        fontFamily: 'var(--font-family-body)',
        fontSize: 'var(--body-sm)',
        color: 'var(--text-secondary)',
        margin: 0,
        padding: 'var(--padding-sm) var(--padding-md)',
        backgroundColor: 'var(--surface-secondary)',
        borderRadius: 'var(--border-radius-md)',
        border: 'var(--border-width-md) solid var(--border-primary)',
      }}
    >
      Services are managed in the portal (catalog, pricing, Stripe sync). This
      tab is read-only — use the per-row links to edit in the portal.
    </p>
  );
}

async function OfferingsPanel() {
  const rows = await listOfferings();
  type Row = (typeof rows)[number] & { services: { name: string; slug: string } | null };
  const columns: EntityTableColumn<Row>[] = [
    { header: 'Name', cell: (r) => r.name },
    { header: 'Slug', cell: (r) => r.slug },
    { header: 'Service', cell: (r) => r.services?.name ?? '—' },
    { header: 'Rank', cell: (r) => r.rank, width: '80px' },
    { header: 'Status', cell: (r) => <PublicBadge value={r.is_public} />, width: '120px' },
  ];
  return (
    <EntityTable
      rows={rows as Row[]}
      columns={columns}
      editHref={(r) => `/admin/services/offerings/${r.id}/edit`}
      emptyMessage="No offerings yet."
    />
  );
}
