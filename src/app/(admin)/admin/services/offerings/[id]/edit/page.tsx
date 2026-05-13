import { notFound } from 'next/navigation';
import { EditPageShell } from '../../../../_components/EditPageShell';
import { EntityForm } from '../../../../_components/EntityForm';
import { offeringFields } from '../../../_components/field-configs';
import { getOfferingById } from '@/lib/admin/offerings';
import { listServices } from '@/lib/admin/services';
import { mapCategorySlug } from '@/lib/supabase/queries';
import { hasIconFor } from '@/lib/service-icons';
import { ServiceTag } from '@brikdesigns/bds';

interface Props {
  params: Promise<{ id: string }>;
}

interface ServiceLineRef {
  slug: string;
  name: string;
}
interface ServiceRef {
  id: string;
  name: string;
  slug: string;
  service_lines?: ServiceLineRef | ServiceLineRef[] | null;
}

function pickServiceLine(svc: ServiceRef | null | undefined): ServiceLineRef | null {
  const sl = svc?.service_lines;
  if (!sl) return null;
  if (Array.isArray(sl)) return sl[0] ?? null;
  return sl;
}

export default async function EditOfferingPage({ params }: Props) {
  const { id } = await params;
  const [row, services] = await Promise.all([
    getOfferingById(id).catch(() => null),
    listServices(),
  ]);
  if (!row) notFound();

  const serviceOptions = services.map((s) => ({ label: s.name, value: s.id }));
  const serviceLine = pickServiceLine(row.services as ServiceRef | null);
  const audience = serviceLine ? mapCategorySlug(serviceLine.slug) : null;

  return (
    <EditPageShell
      backHref="/admin/services?tab=offerings"
      backLabel="Offerings"
      title={row.name}
      subtitle={`Slug: ${row.slug}`}
    >
      {audience && serviceLine && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--gap-sm)',
            marginBottom: 'var(--gap-md)',
          }}
        >
          <ServiceTag
            category={audience}
            {...(hasIconFor(audience, row.name) ? { serviceName: row.name } : {})}
            variant="icon-text"
            label={serviceLine.name}
            size="md"
          />
        </div>
      )}
      <EntityForm
        fields={offeringFields(serviceOptions)}
        initial={row}
        endpoint="/api/admin/offerings"
        mode="edit"
        id={row.id}
        successHref="/admin/services?tab=offerings"
      />
    </EditPageShell>
  );
}
