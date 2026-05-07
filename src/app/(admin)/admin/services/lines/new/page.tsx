import { EditPageShell } from '../../_components/EditPageShell';
import { EntityForm } from '../../_components/EntityForm';
import { serviceLineFields } from '../../_components/field-configs';

export default function NewServiceLinePage() {
  return (
    <EditPageShell
      backHref="/admin/services?tab=lines"
      backLabel="Service lines"
      title="New service line"
      subtitle="Top-level grouping shown on /services."
    >
      <EntityForm
        fields={serviceLineFields()}
        initial={{}}
        endpoint="/api/admin/service-lines"
        mode="create"
        successHref="/admin/services?tab=lines"
      />
    </EditPageShell>
  );
}
