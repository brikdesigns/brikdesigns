import type { SelectOption } from '@brikdesigns/bds';
import type { FieldDef } from '../../_components/EntityForm';
import type { BdsColorToken } from '@/lib/bds-color-tokens';

type FieldOrSection = FieldDef | { sectionTitle: string };

export interface ColorTokenInputs {
  groups: { family: string; tokens: BdsColorToken[] }[];
  flat: BdsColorToken[];
}

export function serviceLineFields(opts: ColorTokenInputs): FieldOrSection[] {
  const { groups, flat } = opts;
  const prefix = 'service-lines';
  return [
    { sectionTitle: 'Identity' },
    { kind: 'text', name: 'name', label: 'Name', required: true },
    { kind: 'text', name: 'slug', label: 'Slug', required: true, placeholder: 'brand-design' },
    { kind: 'text', name: 'tagline', label: 'Tagline' },
    { kind: 'textarea', name: 'description', label: 'Description', rows: 4 },

    { sectionTitle: 'Imagery' },
    { kind: 'media', name: 'hero_image_url', label: 'Hero image', pathPrefix: `${prefix}/hero` },
    { kind: 'media', name: 'card_image_url', label: 'Card image', pathPrefix: `${prefix}/card` },
    { kind: 'media', name: 'primary_badge_url', label: 'Primary badge', pathPrefix: `${prefix}/badges`, accept: 'image/svg+xml,image/png' },
    { kind: 'media', name: 'secondary_badge_url', label: 'Secondary badge', pathPrefix: `${prefix}/badges`, accept: 'image/svg+xml,image/png' },

    { sectionTitle: 'Brand colors' },
    { kind: 'color', name: 'brand_color_light', label: 'Brand color — light', groups, flat },
    { kind: 'color', name: 'brand_color_base', label: 'Brand color — base', groups, flat },
    { kind: 'color', name: 'brand_color_dark', label: 'Brand color — dark', groups, flat },

    { sectionTitle: 'Linking' },
    { kind: 'text', name: 'support_plan_slug', label: 'Support plan slug' },
    { kind: 'media', name: 'support_plan_image_url', label: 'Support plan image', pathPrefix: `${prefix}/support-plan` },

    { sectionTitle: 'Publishing' },
    { kind: 'number', name: 'rank', label: 'Display rank (lower = earlier)' },
    { kind: 'switch', name: 'is_public', label: 'Visible on brikdesigns.com' },
  ];
}

export function serviceFields(serviceLineOptions: SelectOption[]): FieldOrSection[] {
  const prefix = 'services';
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
    { kind: 'media', name: 'image_url', label: 'Image', pathPrefix: `${prefix}/image` },
    { kind: 'media', name: 'primary_badge_url', label: 'Primary badge', pathPrefix: `${prefix}/badges`, accept: 'image/svg+xml,image/png' },
    { kind: 'media', name: 'secondary_badge_url', label: 'Secondary badge', pathPrefix: `${prefix}/badges`, accept: 'image/svg+xml,image/png' },

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
  const prefix = 'offerings';
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
    { kind: 'media', name: 'image_url', label: 'Image', pathPrefix: `${prefix}/image` },
    { kind: 'media', name: 'hero_image_url', label: 'Hero image', pathPrefix: `${prefix}/hero` },
    { kind: 'media', name: 'card_image_url', label: 'Card image', pathPrefix: `${prefix}/card` },
    { kind: 'media', name: 'primary_badge_url', label: 'Primary badge', pathPrefix: `${prefix}/badges`, accept: 'image/svg+xml,image/png' },
    { kind: 'media', name: 'secondary_badge_url', label: 'Secondary badge', pathPrefix: `${prefix}/badges`, accept: 'image/svg+xml,image/png' },

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
