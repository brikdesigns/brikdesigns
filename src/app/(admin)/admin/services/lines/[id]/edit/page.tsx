import { notFound } from 'next/navigation';
import { EditPageShell } from '../../../../_components/EditPageShell';
import { EntityForm } from '../../../../_components/EntityForm';
import { serviceLineFields } from '../../../_components/field-configs';
import { getServiceLineById } from '@/lib/admin/service-lines';
import { getBdsColorTokens, getGroupedBdsColorTokens } from '@/lib/bds-color-tokens';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function EditServiceLinePage({ params }: Props) {
  const { id } = await params;
  let row;
  try {
    row = await getServiceLineById(id);
  } catch {
    notFound();
  }
  if (!row) notFound();

  const flat = getBdsColorTokens();
  const groups = getGroupedBdsColorTokens();

  return (
    <EditPageShell
      backHref="/admin/services?tab=lines"
      backLabel="Service lines"
      title={row.name}
      subtitle={`Slug: ${row.slug}`}
    >
      <EntityForm
        fields={serviceLineFields({ groups, flat })}
        initial={row}
        endpoint="/api/admin/service-lines"
        mode="edit"
        id={row.id}
        successHref="/admin/services?tab=lines"
      />
    </EditPageShell>
  );
}
