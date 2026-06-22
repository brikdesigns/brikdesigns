'use client';

import { MultiSelect, ServiceTag, type ServiceLine } from '@brikdesigns/bds';

/**
 * A single service option for the lead-form picker. `category` is the BDS
 * ServiceLine used to color the selected ServiceTag chip; `value` is the
 * service slug submitted to /api/leads.
 */
export type ServiceOption = {
  value: string;
  label: string;
  category: ServiceLine;
};

/**
 * ServiceMultiSelect — wraps the BDS MultiSelect for picking Brik services on
 * the Get Started form. Options arrive pre-ordered by service line (clustered)
 * from the server; each selected item renders with a service-line-colored
 * ServiceTag glyph as its leading icon.
 *
 * Note: the shipped MultiSelect takes a flat option list (no `<optgroup>`
 * headers), so "grouped by line" is expressed as clustered ordering + the
 * per-line tag color on selections. True header-grouped dropdowns are the
 * deferred brik-bds Menu/MultiSelect enhancement (out of scope for #576).
 */
export function ServiceMultiSelect({
  options,
  value,
  onChange,
  label = "Services you're interested in (optional)",
  placeholder = 'Select services…',
}: {
  options: ServiceOption[];
  value: string[];
  onChange: (values: string[]) => void;
  label?: string;
  placeholder?: string;
}) {
  const multiOptions = options.map((o) => ({
    value: o.value,
    label: o.label,
    icon: (
      <ServiceTag
        category={o.category}
        variant="icon"
        serviceName={o.label}
        size="sm"
      />
    ),
  }));

  return (
    <MultiSelect
      label={label}
      placeholder={placeholder}
      options={multiOptions}
      value={value}
      onChange={onChange}
    />
  );
}
