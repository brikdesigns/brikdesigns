import { notFound } from 'next/navigation';
import { EditPageShell } from '../../../_components/EditPageShell';
import { EntityForm } from '../../../_components/EntityForm';
import { serviceFields } from '../../../_components/field-configs';
import { getServiceById } from '@/lib/admin/services';
import { listServiceLines } from '@/lib/admin/service-lines';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function EditServicePage({ params }: Props) {
  const { id } = await params;
  const [row, lines] = await Promise.all([
    getServiceById(id).catch(() => null),
    listServiceLines(),
  ]);
  if (!row) notFound();

  const lineOptions = lines.map((l) => ({ label: l.name, value: l.id }));

  return (
    <EditPageShell
      backHref="/admin/services?tab=services"
      backLabel="Services"
      title={row.name}
      subtitle={`Slug: ${row.slug}`}
    >
      <EntityForm
        fields={serviceFields(lineOptions)}
        initial={row}
        endpoint="/api/admin/services"
        mode="edit"
        id={row.id}
        successHref="/admin/services?tab=services"
      />
    </EditPageShell>
  );
}
