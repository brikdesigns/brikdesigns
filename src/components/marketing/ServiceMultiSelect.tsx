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
 * from the server; each selected item renders as a service-line-colored
 * `ServiceTag` chip (icon + label) via MultiSelect's `chip` slot.
 *
 * Note: the native dropdown `<option>` can't render a node, so the dropdown
 * still shows the plain label plus the per-line colored glyph via `icon`. A
 * full ServiceTag pill in the dropdown would require a custom ARIA listbox —
 * tracked separately under brik-bds#940, descoped from #602.
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
    // Dropdown glyph — native <option> can't host a node, so the colored
    // icon is the most the dropdown can show.
    icon: (
      <ServiceTag
        category={o.category}
        variant="icon"
        serviceName={o.label}
        size="sm"
      />
    ),
    // Selected chip — line-colored ServiceTag pill instead of the default
    // neutral Tag. MultiSelect supplies its own remove control beside it.
    chip: (
      <ServiceTag
        category={o.category}
        variant="icon-text"
        serviceName={o.label}
        label={o.label}
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
