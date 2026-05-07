import { EditPageShell } from '../../../_components/EditPageShell';
import { EntityForm } from '../../../_components/EntityForm';
import { serviceFields } from '../../_components/field-configs';
import { listServiceLines } from '@/lib/admin/service-lines';

export default async function NewServicePage() {
  const lines = await listServiceLines();
  const lineOptions = lines.map((l) => ({ label: l.name, value: l.id }));

  return (
    <EditPageShell
      backHref="/admin/services?tab=services"
      backLabel="Services"
      title="New service"
      subtitle="A service belongs to one service line."
    >
      <EntityForm
        fields={serviceFields(lineOptions)}
        initial={{}}
        endpoint="/api/admin/services"
        mode="create"
        successHref="/admin/services?tab=services"
      />
    </EditPageShell>
  );
}
