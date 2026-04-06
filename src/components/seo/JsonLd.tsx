/**
 * JSON-LD structured data components for SEO.
 * Renders schema.org markup as <script type="application/ld+json">.
 */

interface OrganizationProps {
  name?: string;
  url?: string;
  logo?: string;
  description?: string;
  phone?: string;
  sameAs?: string[];
}

export function OrganizationJsonLd({
  name = 'Brik Designs',
  url = 'https://brikdesigns.com',
  logo = 'https://brikdesigns.com/images/Brik-logo.svg',
  description = 'Brik Designs helps small businesses grow with smart branding, marketing, product, and service design.',
  phone = '+15614908714',
  sameAs = [
    'https://www.linkedin.com/company/brik-designs',
    'https://www.facebook.com/brikdesigns',
    'https://www.instagram.com/brikdesigns',
  ],
}: OrganizationProps) {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name,
    url,
    logo,
    description,
    telephone: phone,
    sameAs,
    foundingDate: '2024',
    founders: [
      { '@type': 'Person', name: 'Abbey Stanerson' },
      { '@type': 'Person', name: 'Nick Stanerson' },
    ],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

interface ArticleProps {
  title: string;
  description: string;
  url: string;
  image?: string;
  datePublished: string;
  dateModified?: string;
  author?: string;
  category?: string;
}

export function ArticleJsonLd({
  title,
  description,
  url,
  image,
  datePublished,
  dateModified,
  author = 'Brik Designs',
  category,
}: ArticleProps) {
  const schema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: title,
    description,
    url,
    datePublished,
    dateModified: dateModified || datePublished,
    author: { '@type': 'Organization', name: author },
    publisher: {
      '@type': 'Organization',
      name: 'Brik Designs',
      logo: { '@type': 'ImageObject', url: 'https://brikdesigns.com/images/Brik-logo.svg' },
    },
  };
  if (image) schema.image = image;
  if (category) schema.articleSection = category;

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

interface ServiceProps {
  name: string;
  description: string;
  url: string;
  image?: string;
  category?: string;
}

export function ServiceJsonLd({ name, description, url, image, category }: ServiceProps) {
  const schema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name,
    description,
    url,
    provider: {
      '@type': 'Organization',
      name: 'Brik Designs',
      url: 'https://brikdesigns.com',
    },
  };
  if (image) schema.image = image;
  if (category) schema.serviceType = category;

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

interface BreadcrumbItem {
  name: string;
  url: string;
}

export function BreadcrumbJsonLd({ items }: { items: BreadcrumbItem[] }) {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: item.url,
    })),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}
