import Image from 'next/image';
import { Avatar, Card, Frame, TableOfContents, Tag } from '@brikdesigns/bds';
import { heading, label, text } from '@/lib/styles';
import { color } from '@/lib/tokens';
import {
  sectionAnchorId,
  type CustomerStorySection,
} from '@/lib/customer-story-sections';

/**
 * Flexible-sections body for /customer-stories/[slug] — the `sections`-present
 * branch (brikdesigns#1205, Figma node 25944-8605).
 *
 * Two columns inside one 1024px container, matching the Figma "container-small":
 *   – 232px sticky rail: TableOfContents (BDS, scroll-spy) + the story metadata
 *     card, which moves here off the interior hero
 *   – 768px body: N titled sections, then the restyled pull-quote, then the
 *     closing media + tag row
 *
 * The legacy branch (`sections === null`) never reaches this component — see
 * page.tsx. Everything here is additive so the fixed template stays byte-for-
 * byte identical for the twelve stories that have no `sections` yet.
 */

/** One label/value metadata pair, shared by the interior hero and the rail. */
export type StoryMetaItem = {
  key: string;
  label: string;
  icon: React.ReactNode;
  value: React.ReactNode;
};

type Props = {
  sections: CustomerStorySection[];
  /**
   * Metadata rows resolved by the page, so the interior-hero `dl` and this
   * rail render the same pairs from one source. Split into `icon` + `value`
   * rather than one node because both surfaces wrap them identically
   * (`.story-meta__icon` then the text) — see page.tsx.
   */
  meta: StoryMetaItem[];
  quote: string | null;
  quoteAttribution: string | null;
  /** Classification labels for the closing tag row. */
  tags: string[];
  closingMedia: { url: string; alt: string } | null;
};

/**
 * Attribution is a single free-text field (`customer_stories.quote_attribution`)
 * — there is no separate role column — so the Figma's two-line name/role chip
 * degrades to one line. Split on the first comma when the CMS author wrote
 * "Name, Role", which is the convention in the seeded rows.
 */
function splitAttribution(raw: string): { name: string; role: string | null } {
  const comma = raw.indexOf(',');
  if (comma === -1) return { name: raw.trim(), role: null };
  return {
    name: raw.slice(0, comma).trim(),
    role: raw.slice(comma + 1).trim() || null,
  };
}

export function StorySections({
  sections,
  meta,
  quote,
  quoteAttribution,
  tags,
  closingMedia,
}: Props) {
  const tocItems = sections.map((section, index) => ({
    id: sectionAnchorId(section.title, index),
    label: section.title,
  }));

  const attribution = quoteAttribution ? splitAttribution(quoteAttribution) : null;

  return (
    <div className="container-lg container-lg--story-layout">
      <div className="story-layout">
        {/* Sticky rail. <aside> because the TOC + metadata are complementary to
            the story, not part of its narrative — the sections themselves are
            the article. */}
        <aside className="story-rail">
          <div className="story-rail__inner">
            <TableOfContents
              items={tocItems}
              ariaLabel="Story sections"
              className="story-toc"
            />
            {meta.length > 0 && (
              <Card padding="md" className="story-rail__meta">
                <dl className="story-rail__meta-list">
                  {meta.map((item) => (
                    <div key={item.key} className="story-meta__item">
                      <dt style={{ ...label.smBold, color: color.text.primary }}>
                        {item.label}
                      </dt>
                      <dd
                        className="story-meta__value"
                        style={{ ...text.bodySm, color: color.text.secondary, margin: 0 }}
                      >
                        <span className="story-meta__icon">{item.icon}</span>
                        {item.value}
                      </dd>
                    </div>
                  ))}
                </dl>
              </Card>
            )}
          </div>
        </aside>

        <div className="story-body">
          {sections.map((section, index) => {
            const anchorId = sectionAnchorId(section.title, index);
            return (
              <section
                key={section.id}
                id={anchorId}
                className="story-section"
                aria-labelledby={`${anchorId}-title`}
              >
                <h2 id={`${anchorId}-title`} style={heading.md}>
                  {section.title}
                </h2>
                {section.body && (
                  <div
                    className="story-section__description"
                    dangerouslySetInnerHTML={{ __html: section.body }}
                  />
                )}
                {section.list && (
                  <div className="story-section__list">
                    {section.list.title && (
                      <h3 className="story-section__list-title" style={label.md}>
                        {section.list.title}
                      </h3>
                    )}
                    <ul className="story-section__list-items">
                      {section.list.items.map((item, itemIndex) => (
                        <li key={`${section.id}-${itemIndex}`}>{item}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </section>
            );
          })}

          {quote && (
            <Card padding="lg" className="story-quote-card">
              {/* Decorative glyph — the quotation is announced by <blockquote>,
                  so the mark itself is hidden from the accessibility tree. */}
              <span className="story-quote-card__glyph" aria-hidden>
                &ldquo;
              </span>
              <blockquote className="story-quote-card__quote">
                <p className="story-quote-card__description">{quote}</p>
                {attribution && (
                  <footer className="story-quote-card__attribution">
                    <Avatar name={attribution.name} size="xl" />
                    <span className="story-quote-card__attribution-text">
                      <span style={{ ...label.smBold, color: color.text.primary }}>
                        {attribution.name}
                      </span>
                      {attribution.role && (
                        <span style={{ ...text.bodySm, color: color.text.secondary }}>
                          {attribution.role}
                        </span>
                      )}
                    </span>
                  </footer>
                )}
              </blockquote>
            </Card>
          )}

          {(closingMedia || tags.length > 0) && (
            <div className="story-closing">
              {closingMedia && (
                <div className="story-figure">
                  <Frame ratio="wide" fit="cover">
                    <Image
                      src={closingMedia.url}
                      alt={closingMedia.alt}
                      width={768}
                      height={432}
                    />
                  </Frame>
                </div>
              )}
              {tags.length > 0 && (
                <ul className="story-closing__tags">
                  {tags.map((tag) => (
                    <li key={tag}>
                      <Tag size="sm">{tag}</Tag>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
