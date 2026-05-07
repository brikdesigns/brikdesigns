import { EditPageShell } from '../../../_components/EditPageShell';
import { EntityForm } from '../../../_components/EntityForm';
import { offeringFields } from '../../_components/field-configs';
import { listServices } from '@/lib/admin/services';

export default async function NewOfferingPage() {
  const services = await listServices();
  const serviceOptions = services.map((s) => ({ label: s.name, value: s.id }));

  return (
    <EditPageShell
      backHref="/admin/services?tab=offerings"
      backLabel="Offerings"
      title="New offering"
      subtitle="An offering belongs to one service."
    >
      <EntityForm
        fields={offeringFields(serviceOptions)}
        initial={{}}
        endpoint="/api/admin/offerings"
        mode="create"
        successHref="/admin/services?tab=offerings"
      />
    </EditPageShell>
  );
}
