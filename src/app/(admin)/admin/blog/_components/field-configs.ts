import type { FieldDef } from '../../_components/EntityForm';

type FieldOrSection = FieldDef | { sectionTitle: string };

export function blogPostFields(): FieldOrSection[] {
  const prefix = 'blog';
  return [
    { sectionTitle: 'Identity' },
    { kind: 'text', name: 'title', label: 'Title', required: true },
    { kind: 'text', name: 'slug', label: 'Slug', required: true, placeholder: 'clear-is-kind' },
    { kind: 'textarea', name: 'excerpt', label: 'Excerpt (summary)', rows: 3 },
    { kind: 'media', name: 'featured_image_url', label: 'Featured image', pathPrefix: `${prefix}/featured` },

    { sectionTitle: 'Body' },
    {
      kind: 'textarea',
      name: 'content',
      label: 'Content (Markdown / MDX — same syntax as the legacy MDX files)',
      rows: 24,
    },

    { sectionTitle: 'Metadata' },
    { kind: 'text', name: 'author', label: 'Author' },
    { kind: 'text', name: 'duration', label: 'Read time', placeholder: '2 minute read' },

    { sectionTitle: 'Per-post CTA' },
    { kind: 'text', name: 'cta_title', label: 'CTA title' },
    { kind: 'textarea', name: 'cta_description', label: 'CTA description', rows: 2 },

    { sectionTitle: 'SEO' },
    { kind: 'text', name: 'seo_title', label: 'SEO title' },
    { kind: 'textarea', name: 'seo_description', label: 'SEO description', rows: 2 },

    { sectionTitle: 'Publishing' },
    {
      kind: 'select',
      name: 'status',
      label: 'Status',
      required: true,
      placeholder: 'Select status…',
      options: [
        { label: 'Draft', value: 'draft' },
        { label: 'Published', value: 'published' },
        { label: 'Archived', value: 'archived' },
      ],
    },
    { kind: 'text', name: 'published_at', label: 'Published at (ISO timestamp)', placeholder: '2025-05-30T00:00:00Z' },
    { kind: 'switch', name: 'featured', label: 'Featured (highlight on /blog)' },
  ];
}
