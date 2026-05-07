import { notFound } from 'next/navigation';
import { EditPageShell } from '../../../_components/EditPageShell';
import { EntityForm } from '../../../_components/EntityForm';
import { customerStoryFields } from '../../_components/field-configs';
import { getCustomerStoryById } from '@/lib/admin/customer-stories';
import { listServiceLines } from '@/lib/admin/service-lines';
import { listServices } from '@/lib/admin/services';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function EditCustomerStoryPage({ params }: Props) {
  const { id } = await params;
  const [row, lines, services] = await Promise.all([
    getCustomerStoryById(id).catch(() => null),
    listServiceLines(),
    listServices(),
  ]);
  if (!row) notFound();

  const serviceLineOptions = lines.map((l) => ({ label: l.name, value: l.id }));
  const serviceOptions = services.map((s) => ({ label: s.name, value: s.id }));

  return (
    <EditPageShell
      backHref="/admin/stories"
      backLabel="Customer stories"
      title={row.name}
      subtitle={`Slug: ${row.slug} · Client: ${row.client_name}`}
    >
      <EntityForm
        fields={customerStoryFields({ serviceLineOptions, serviceOptions })}
        initial={row}
        endpoint="/api/admin/customer-stories"
        mode="edit"
        id={row.id}
        successHref="/admin/stories"
      />
    </EditPageShell>
  );
}
