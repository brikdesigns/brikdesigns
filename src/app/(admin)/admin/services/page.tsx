import Link from 'next/link';
import { Button } from '@brikdesigns/bds';
import { Badge } from '@brikdesigns/bds';
import { ServicesTabs } from './_components/Tabs';
import { EntityTable, type EntityTableColumn } from '../_components/EntityTable';
import { listServiceLines } from '@/lib/admin/service-lines';
import { listServices } from '@/lib/admin/services';
import { listOfferings } from '@/lib/admin/offerings';
import {
  PORTAL_SERVICES_ADMIN_URL,
  PORTAL_SERVICE_LINES_ADMIN_URL,
  PORTAL_OFFERINGS_ADMIN_URL,
  portalServiceEditUrl,
} from '@/lib/portal-url';

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
  // All three tabs are now read-only (#178, #188, #189). Portal /settings/* owns
  // catalog writes. Surface a portal deep-link instead of a "New" button.
  const portalMap: Record<TabId, string> = {
    services: PORTAL_SERVICES_ADMIN_URL,
    lines: PORTAL_SERVICE_LINES_ADMIN_URL,
    offerings: PORTAL_OFFERINGS_ADMIN_URL,
  };
  return (
    <Button href={portalMap[tab]} variant="secondary" size="md">
      Manage in portal ↗
    </Button>
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
    <>
      <ReadOnlyNotice table="service lines" portalUrl={PORTAL_SERVICE_LINES_ADMIN_URL} />
      <EntityTable
        rows={rows}
        columns={columns}
        editHref={() => PORTAL_SERVICE_LINES_ADMIN_URL}
        actionLabel="View in portal ↗"
        emptyMessage="No service lines yet."
      />
    </>
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
  return (
    <>
      <ReadOnlyNotice table="services" portalUrl={PORTAL_SERVICES_ADMIN_URL} />
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

function ReadOnlyNotice({ table, portalUrl }: { table: string; portalUrl: string }) {
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
      {`${table.charAt(0).toUpperCase() + table.slice(1)} are managed in the `}
      <a href={portalUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit' }}>
        portal admin ↗
      </a>
      . This tab is read-only.
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
    <>
      <ReadOnlyNotice table="offerings" portalUrl={PORTAL_OFFERINGS_ADMIN_URL} />
      <EntityTable
        rows={rows as Row[]}
        columns={columns}
        editHref={() => PORTAL_OFFERINGS_ADMIN_URL}
        actionLabel="View in portal ↗"
        emptyMessage="No offerings yet."
      />
    </>
  );
}
