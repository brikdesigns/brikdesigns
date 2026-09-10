import Image from 'next/image';
import { Card, Frame } from '@brikdesigns/bds';
import type { CardGridProps } from '@/lib/blocks';
import { heading, text } from '@/lib/styles';

/**
 * card-grid block — a full-width grid of vertical cards (Figma `card-vertical`:
 * a 4:3 photo above a title + summary), with an optional centered header. The
 * `columns` prop sets the fixed track count via a `data-columns` attribute
 * (matched by `.card-grid[data-columns]` in blocks.css); the grid collapses to
 * 1/2 columns below the marketing breakpoints.
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
      <div className="card-grid" data-columns={columns}>
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
      </div>
    </div>
  );
}
