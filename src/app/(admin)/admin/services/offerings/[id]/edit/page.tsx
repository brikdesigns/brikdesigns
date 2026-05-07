import { notFound } from 'next/navigation';
import { EditPageShell } from '../../../_components/EditPageShell';
import { EntityForm } from '../../../_components/EntityForm';
import { offeringFields } from '../../../_components/field-configs';
import { getOfferingById } from '@/lib/admin/offerings';
import { listServices } from '@/lib/admin/services';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function EditOfferingPage({ params }: Props) {
  const { id } = await params;
  const [row, services] = await Promise.all([
    getOfferingById(id).catch(() => null),
    listServices(),
  ]);
  if (!row) notFound();

  const serviceOptions = services.map((s) => ({ label: s.name, value: s.id }));

  return (
    <EditPageShell
      backHref="/admin/services?tab=offerings"
      backLabel="Offerings"
      title={row.name}
      subtitle={`Slug: ${row.slug}`}
    >
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
