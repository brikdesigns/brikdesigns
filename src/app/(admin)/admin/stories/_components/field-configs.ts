import type { SelectOption } from '@bds/components/ui/Select/Select';
import type { FieldDef } from '../../_components/EntityForm';

type FieldOrSection = FieldDef | { sectionTitle: string };

export interface CustomerStoryFieldOpts {
  serviceOptions: SelectOption[];
  serviceLineOptions: SelectOption[];
}

export function customerStoryFields(opts: CustomerStoryFieldOpts): FieldOrSection[] {
  const { serviceOptions, serviceLineOptions } = opts;
  const prefix = 'customer-stories';

  return [
    { sectionTitle: 'Identity' },
    { kind: 'text', name: 'name', label: 'Story title', required: true, placeholder: 'How Birdwell Mutlak…' },
    { kind: 'text', name: 'slug', label: 'Slug', required: true, placeholder: 'birdwell-mutlak' },
    { kind: 'text', name: 'client_name', label: 'Client name', required: true },
    { kind: 'textarea', name: 'short_description', label: 'Short description', rows: 3 },
    { kind: 'text', name: 'industry', label: 'Industry label (free text)' },

    { sectionTitle: 'Linking' },
    {
      kind: 'select',
      name: 'primary_category_id',
      label: 'Primary service line',
      options: serviceLineOptions,
      placeholder: 'Select a service line…',
    },
    {
      kind: 'select',
      name: 'primary_service_id',
      label: 'Primary service',
      options: serviceOptions,
      placeholder: 'Select a service…',
    },
    { kind: 'text', name: 'service_slug', label: 'Service slug (denormalized — keep in sync with primary service)' },
    { kind: 'text', name: 'service_line_slug', label: 'Service line slug (denormalized)' },
    { kind: 'text', name: 'website_url', label: 'Project URL (Brik-rendered)' },
    { kind: 'text', name: 'client_website', label: 'Client website URL' },
    { kind: 'text', name: 'client_website_display', label: 'Client website display label' },

    { sectionTitle: 'Hero & thumbnail' },
    { kind: 'media', name: 'hero_image_url', label: 'Hero image', pathPrefix: `${prefix}/hero` },
    { kind: 'media', name: 'hero_video_url', label: 'Hero video', pathPrefix: `${prefix}/hero`, accept: 'video/*' },
    { kind: 'media', name: 'thumbnail_url', label: 'Thumbnail (list view)', pathPrefix: `${prefix}/thumb` },

    { sectionTitle: 'Brand assets' },
    { kind: 'media', name: 'client_logo_url', label: 'Client logo', pathPrefix: `${prefix}/logo`, accept: 'image/svg+xml,image/png' },
    { kind: 'media', name: 'client_icon_url', label: 'Client icon', pathPrefix: `${prefix}/logo`, accept: 'image/svg+xml,image/png' },
    { kind: 'media', name: 'industry_badge_url', label: 'Industry badge', pathPrefix: `${prefix}/badges`, accept: 'image/svg+xml,image/png' },
    { kind: 'media', name: 'service_line_icon_url', label: 'Service line icon', pathPrefix: `${prefix}/badges`, accept: 'image/svg+xml,image/png' },

    { sectionTitle: 'Story' },
    { kind: 'textarea', name: 'the_challenge', label: 'The challenge', rows: 5 },
    { kind: 'textarea', name: 'the_solution', label: 'The solution', rows: 5 },
    { kind: 'textarea', name: 'results', label: 'The results', rows: 5 },
    { kind: 'textarea', name: 'quote', label: 'Pull quote', rows: 3 },
    { kind: 'text', name: 'quote_attribution', label: 'Quote attribution' },

    { sectionTitle: 'Before / after / results media' },
    { kind: 'media', name: 'before_photo_url', label: 'Before photo', pathPrefix: `${prefix}/before-after` },
    { kind: 'media', name: 'after_photo_url', label: 'After photo', pathPrefix: `${prefix}/before-after` },
    { kind: 'media', name: 'results_photo_url', label: 'Results photo', pathPrefix: `${prefix}/before-after` },
    { kind: 'media', name: 'before_video_url', label: 'Before video', pathPrefix: `${prefix}/before-after`, accept: 'video/*' },
    { kind: 'media', name: 'after_video_url', label: 'After video', pathPrefix: `${prefix}/before-after`, accept: 'video/*' },
    { kind: 'media', name: 'results_video_url', label: 'Results video', pathPrefix: `${prefix}/before-after`, accept: 'video/*' },

    { sectionTitle: 'Metadata' },
    { kind: 'text', name: 'launch_date', label: 'Launch date (YYYY-MM-DD)' },
    { kind: 'text', name: 'award_label', label: 'Award label' },

    { sectionTitle: 'Publishing' },
    { kind: 'number', name: 'rank', label: 'Display rank (lower = earlier)' },
    { kind: 'switch', name: 'is_public', label: 'Visible on brikdesigns.com' },
  ];
}
