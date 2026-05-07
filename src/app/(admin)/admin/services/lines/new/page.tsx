import { EditPageShell } from '../../_components/EditPageShell';
import { EntityForm } from '../../_components/EntityForm';
import { serviceLineFields } from '../../_components/field-configs';
import { getBdsColorTokens, getGroupedBdsColorTokens } from '@/lib/bds-color-tokens';

export default function NewServiceLinePage() {
  const flat = getBdsColorTokens();
  const groups = getGroupedBdsColorTokens();

  return (
    <EditPageShell
      backHref="/admin/services?tab=lines"
      backLabel="Service lines"
      title="New service line"
      subtitle="Top-level grouping shown on /services."
    >
      <EntityForm
        fields={serviceLineFields({ groups, flat })}
        initial={{}}
        endpoint="/api/admin/service-lines"
        mode="create"
        successHref="/admin/services?tab=lines"
      />
    </EditPageShell>
  );
}
