import Image from 'next/image';
import { Card, CardGrid, Grid, Frame, Button } from '@brikdesigns/bds';
import type { CrossReferenceProps, CrossReferenceSource } from '@/lib/blocks';
import { selectRows } from '@/lib/cross-reference';
import { getCustomerStories, getServices } from '@/lib/supabase/queries';
import { routeSlugForServiceLine } from '@/lib/service-line-routes';

/**
 * cross-reference block (#422) — renders a section of related customer stories
 * or services resolved **live** from the source collection. Maps to the
 * catalogue's neutral `CardGrid + Grid + Card preset="display"` — a non-accent
 * block, so it deliberately uses no service-tint / `serviceColor()` surface.
 *
 * Live resolution + graceful omit: rows are selected against the cached,
 * `is_public`-filtered collection query. A curated `items` slug that has been
 * unpublished or deleted is simply absent from that list, so it drops out
 * (the dangling-reference contract) — never a thrown error or a 404. When the
 * resolved set is empty the whole block renders nothing.
 */

/** A row mapped to the neutral display-card shape. */
interface RefCard {
  key: string;
  title: string;
  description?: string;
  imageUrl?: string | null;
  imageAlt: string;
  href: string;
  cta: string;
}

const DEFAULT_TITLE: Record<CrossReferenceSource, string> = {
  customer_stories: 'Related Customer Stories',
  services: 'Related Services',
};

const DEFAULT_LIMIT = 3;

/** Service-line slug from the `service_lines` embed, tolerating object|array
 *  shapes (mirrors the established pattern in the service detail page). */
function lineSlugOf(serviceLines: unknown): string | null {
  if (!serviceLines) return null;
  if (Array.isArray(serviceLines)) return serviceLines[0]?.slug ?? null;
  return (serviceLines as { slug?: string }).slug ?? null;
}

export async function CrossReferenceBlock({
  source,
  items,
  limit,
  layout = 'grid',
  title,
}: CrossReferenceProps) {
  const cap = limit ?? DEFAULT_LIMIT;
  let cards: RefCard[];

  if (source === 'customer_stories') {
    const rows = (await getCustomerStories()) ?? [];
    cards = selectRows(rows, items, cap).map((r) => ({
      key: r.slug,
      title: r.name,
      description: r.short_description ?? undefined,
      imageUrl: r.hero_image_url,
      imageAlt: r.client_name || r.name,
      href: `/customer-stories/${r.slug}`,
      cta: 'Read story',
    }));
  } else {
    const rows = (await getServices()) ?? [];
    cards = selectRows(rows, items, cap).map((r) => {
      const lineSlug = lineSlugOf(r.service_lines);
      return {
        key: r.slug,
        title: r.name,
        description: r.description ?? r.tagline ?? undefined,
        imageUrl: r.image_url,
        imageAlt: r.name,
        href: lineSlug ? `/services/${routeSlugForServiceLine(lineSlug)}/${r.slug}` : '/services',
        cta: 'Learn more',
      };
    });
  }

  if (!cards.length) return null;

  const decorated = cards.map((c) => ({
    ...c,
    imageNode: c.imageUrl ? (
      <Frame ratio="3-2" fit="cover">
        <Image src={c.imageUrl} alt={c.imageAlt} fill sizes="(max-width: 767px) 100vw, 360px" />
      </Frame>
    ) : undefined,
    actionNode: (
      <Button href={c.href} variant="primary" size="sm">
        {c.cta}
      </Button>
    ),
  }));

  return (
    <CardGrid sectionKey={`xref-${source}`} title={title ?? DEFAULT_TITLE[source]}>
      {layout === 'row' ? (
        <div className="xref-rows">
          {decorated.map((c) => (
            <Card
              key={c.key}
              preset="display-row"
              title={c.title}
              description={c.description}
              image={c.imageNode}
              action={c.actionNode}
            />
          ))}
        </div>
      ) : (
        <Grid columns="auto-fit" minColumnWidth="280px" gap="lg">
          {decorated.map((c) => (
            <Card
              key={c.key}
              preset="display"
              title={c.title}
              description={c.description}
              image={c.imageNode}
              action={c.actionNode}
            />
          ))}
        </Grid>
      )}
    </CardGrid>
  );
}
