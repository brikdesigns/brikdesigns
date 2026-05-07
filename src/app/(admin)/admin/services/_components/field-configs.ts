import type { SelectOption } from '@bds/components/ui/Select/Select';
import type { FieldDef } from './EntityForm';

type FieldOrSection = FieldDef | { sectionTitle: string };

export function serviceLineFields(): FieldOrSection[] {
  return [
    { sectionTitle: 'Identity' },
    { kind: 'text', name: 'name', label: 'Name', required: true },
    { kind: 'text', name: 'slug', label: 'Slug', required: true, placeholder: 'brand-design' },
    { kind: 'text', name: 'tagline', label: 'Tagline' },
    { kind: 'textarea', name: 'description', label: 'Description', rows: 4 },

    { sectionTitle: 'Imagery' },
    { kind: 'text', name: 'hero_image_url', label: 'Hero image URL' },
    { kind: 'text', name: 'card_image_url', label: 'Card image URL' },
    { kind: 'text', name: 'primary_badge_url', label: 'Primary badge URL' },
    { kind: 'text', name: 'secondary_badge_url', label: 'Secondary badge URL' },

    { sectionTitle: 'Brand colors' },
    { kind: 'text', name: 'brand_color_light', label: 'Brand color — light' },
    { kind: 'text', name: 'brand_color_base', label: 'Brand color — base' },
    { kind: 'text', name: 'brand_color_dark', label: 'Brand color — dark' },

    { sectionTitle: 'Linking' },
    { kind: 'text', name: 'support_plan_slug', label: 'Support plan slug' },
    { kind: 'text', name: 'support_plan_image_url', label: 'Support plan image URL' },

    { sectionTitle: 'Publishing' },
    { kind: 'number', name: 'rank', label: 'Display rank (lower = earlier)' },
    { kind: 'switch', name: 'is_public', label: 'Visible on brikdesigns.com' },
  ];
}

export function serviceFields(serviceLineOptions: SelectOption[]): FieldOrSection[] {
  return [
    { sectionTitle: 'Identity' },
    { kind: 'text', name: 'name', label: 'Name', required: true },
    { kind: 'text', name: 'slug', label: 'Slug', required: true },
    {
      kind: 'select',
      name: 'service_line_id',
      label: 'Service line',
      options: serviceLineOptions,
      required: true,
      placeholder: 'Select a service line…',
    },
    { kind: 'text', name: 'tagline', label: 'Tagline' },
    { kind: 'textarea', name: 'description', label: 'Description', rows: 4 },

    { sectionTitle: 'Imagery' },
    { kind: 'text', name: 'image_url', label: 'Image URL' },
    { kind: 'text', name: 'primary_badge_url', label: 'Primary badge URL' },
    { kind: 'text', name: 'secondary_badge_url', label: 'Secondary badge URL' },

    { sectionTitle: 'Linking' },
    { kind: 'text', name: 'related_service_slug', label: 'Related service slug' },
    { kind: 'text', name: 'support_plan_slug', label: 'Support plan slug' },
    { kind: 'switch', name: 'has_customer_story', label: 'Has a customer story' },

    { sectionTitle: 'Publishing' },
    { kind: 'number', name: 'rank', label: 'Display rank (lower = earlier)' },
    { kind: 'switch', name: 'is_public', label: 'Visible on brikdesigns.com' },
  ];
}

export function offeringFields(serviceOptions: SelectOption[]): FieldOrSection[] {
  return [
    { sectionTitle: 'Identity' },
    { kind: 'text', name: 'name', label: 'Name', required: true },
    { kind: 'text', name: 'slug', label: 'Slug', required: true },
    {
      kind: 'select',
      name: 'service_id',
      label: 'Service',
      options: serviceOptions,
      required: true,
      placeholder: 'Select a service…',
    },
    { kind: 'text', name: 'tagline', label: 'Tagline' },
    { kind: 'textarea', name: 'description', label: 'Description', rows: 3 },
    { kind: 'textarea', name: 'marketing_description', label: 'Marketing description', rows: 4 },

    { sectionTitle: 'Imagery' },
    { kind: 'text', name: 'image_url', label: 'Image URL' },
    { kind: 'text', name: 'hero_image_url', label: 'Hero image URL' },
    { kind: 'text', name: 'card_image_url', label: 'Card image URL' },
    { kind: 'text', name: 'primary_badge_url', label: 'Primary badge URL' },
    { kind: 'text', name: 'secondary_badge_url', label: 'Secondary badge URL' },

    { sectionTitle: 'Flags' },
    { kind: 'switch', name: 'is_featured', label: 'Featured' },
    { kind: 'switch', name: 'has_customer_story', label: 'Has a customer story' },
    { kind: 'switch', name: 'has_multiple_offerings', label: 'Has multiple offerings' },
    { kind: 'switch', name: 'has_maintenance_add_on', label: 'Has maintenance add-on' },

    { sectionTitle: 'Linking' },
    { kind: 'text', name: 'related_service_slug', label: 'Related service slug' },
    { kind: 'text', name: 'support_plan_slug', label: 'Support plan slug' },

    { sectionTitle: 'Publishing' },
    { kind: 'number', name: 'rank', label: 'Display rank (lower = earlier)' },
    { kind: 'switch', name: 'is_public', label: 'Visible on brikdesigns.com' },
  ];
}
