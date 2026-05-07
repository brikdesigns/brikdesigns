import { EditPageShell } from '../../_components/EditPageShell';
import { EntityForm } from '../../_components/EntityForm';
import { customerStoryFields } from '../_components/field-configs';
import { listServiceLines } from '@/lib/admin/service-lines';
import { listServices } from '@/lib/admin/services';

export default async function NewCustomerStoryPage() {
  const [lines, services] = await Promise.all([listServiceLines(), listServices()]);
  const serviceLineOptions = lines.map((l) => ({ label: l.name, value: l.id }));
  const serviceOptions = services.map((s) => ({ label: s.name, value: s.id }));

  return (
    <EditPageShell
      backHref="/admin/stories"
      backLabel="Customer stories"
      title="New customer story"
      subtitle="A story belongs to a primary service + service line."
    >
      <EntityForm
        fields={customerStoryFields({ serviceLineOptions, serviceOptions })}
        initial={{}}
        endpoint="/api/admin/customer-stories"
        mode="create"
        successHref="/admin/stories"
      />
    </EditPageShell>
  );
}
