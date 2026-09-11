import Image from 'next/image';
import { Card, Frame, Grid } from '@brikdesigns/bds';
import type { CardGridProps } from '@/lib/blocks';
import { heading, text } from '@/lib/styles';

/**
 * card-grid block — a full-width grid of vertical cards (Figma `card-vertical`:
 * a 4:3 photo above a title + summary), with an optional centered header.
 *
 * The grid itself is BDS `<Grid>`, the same primitive the sibling
 * `CrossReferenceBlock` imports (#1357). `columns` (`2 | 3 | 4`) is a strict
 * subset of `GridColumns`, so it passes straight through and BDS owns the
 * responsive collapse: 1-up ≤639px, 2-up ≤991px, then the requested count.
 *
 * NOT the BDS `<CardGrid>` section wrapper, for two blockers:
 *
 *   1. `CardGridProps.title` is REQUIRED there
 *      (`content-system/blueprints/react/CardGrid.d.ts:59`) and drives the
 *      section's `aria-labelledby`. This block's `title` is optional
 *      (`@/lib/blocks:369`), so an untitled CMS row would render an empty
 *      `<h2>` that the section then points its accessible name at.
 *   2. `CardGrid` renders its own `<section>` plus the ADR-021
 *      `bds-blueprint-section` shell — container and vertical inset included.
 *      This block renders as a content fragment inside a surface the page
 *      already owns (`LandingBlocks.tsx:73`, and on the `split` layout
 *      specifically the `lp-split__trailer` container at `:83`), so the shell
 *      would nest a section inside a section and double the inset.
 *
 * Both blockers are about the WRAPPER, not the grid — hence adopting `<Grid>`
 * and keeping the header page-local. Promoting the header into a shared
 * section vocabulary is #1289 slice 2, which is not ratified.
 *
 * Card chrome is left to the BDS `<Card>` default so the "Card chrome by band"
 * rule derives border/shadow from the section band (card-treatment.md) — never a
 * `variant` override. The image is optional: an imageless card renders title +
 * summary only, so the grid can ship before its photography is sourced.
 */
export function CardGridBlock({ columns, title, description, items }: CardGridProps) {
  if (!items.length) return null;

  return (
    <div className="card-grid-block">
      {(title || description) && (
        <div className="card-grid-block__head">
          {title && <h2 style={heading.lg}>{title}</h2>}
          {description && <p style={{ ...text.bodyLg, margin: 0 }}>{description}</p>}
        </div>
      )}
      <Grid columns={columns} gap="lg">
        {items.map((item, i) => (
          <Card key={i} padding="lg" className="card-grid__card">
            {item.image && (
              <Frame ratio="4-3" fit="cover" className="card-grid__media">
                <Image
                  src={item.image.url}
                  alt={item.image.alt}
                  fill
                  sizes="(max-width: 639px) 100vw, (max-width: 899px) 50vw, 33vw"
                />
              </Frame>
            )}
            <div className="card-grid__content">
              <h3 style={heading.md} className="card-grid__title">
                {item.title}
              </h3>
              {item.summary && <p style={{ ...text.bodyLg, margin: 0 }}>{item.summary}</p>}
            </div>
          </Card>
        ))}
      </Grid>
    </div>
  );
}
