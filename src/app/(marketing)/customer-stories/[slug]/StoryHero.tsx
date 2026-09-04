import Image from 'next/image';
import { Avatar, Frame, SocialIcon } from '@brikdesigns/bds';
import { heading, label, text } from '@/lib/styles';
import { color } from '@/lib/tokens';
import type { CustomerStorySocialLink } from '@/lib/customer-story-author';

/**
 * Story hero block for /customer-stories/[slug] — Figma node 25944:8615
 * (brik-client-portal#3799 AC3/AC4, umbrella #3767).
 *
 * Replaces the full-bleed 1280px hero image that #1205 shipped as a deliberate
 * deferral. Same two-column grid as the sections layout below it — 232px rail
 * plus a 768px body inside the 1024px `container-small` — so the page reads as
 * one column system rather than a wide band followed by a narrow one.
 *
 * The three metadata pairs in col_1 are NOT a duplicate of the sticky rail's.
 * Figma stacks three sections (breadcrumb/title `25944:8608`, this hero
 * `25944:8615`, the story body `25944:8933`), and the last carries its own
 * four-pair card below the TOC. Both use the same grid, which is why the
 * widths matched and made this look like the rail's first row.
 *
 * OPERATOR SAID 2026-09-04 (chat, #3799 AC4): "Keep them, matching Figma".
 *
 * Labels here are Figma's own — "Client" / "Industries" / "Services" — and
 * deliberately differ from the rail's ("Client" / "Service Line" / "Service" /
 * "Industry" / "Completion Date"), which the design draws from a different,
 * larger set.
 */

/** One label/value pair in the hero's tinted card. Iconless, unlike the rail's. */
export type StoryHeroPair = {
  key: string;
  label: string;
  value: string;
};

export type StoryHeroAuthor = {
  /** `customer_stories.quote_attribution` — the NAME since portal 00381. */
  name: string;
  /** `customer_stories.author_role`; null renders identity on one line. */
  role: string | null;
  /** `customer_stories.author_headshot_url`; null falls back to initials. */
  headshotUrl: string | null;
  socialLinks: CustomerStorySocialLink[];
};

type Props = {
  pairs: StoryHeroPair[];
  media: { url: string; alt: string } | null;
  /** `customer_stories.short_description`, under the static "About" heading. */
  description: string | null;
  author: StoryHeroAuthor | null;
};

export function StoryHero({ pairs, media, description, author }: Props) {
  const hasIdentity = Boolean(author && author.name);
  const socialLinks = author?.socialLinks ?? [];

  return (
    <section className="page-section story-hero" data-section="story-hero">
      <div className="container-lg container-lg--story-layout">
        <div className="story-layout">
          {pairs.length > 0 && (
            <div className="story-hero__meta">
              <dl className="story-hero__meta-list">
                {pairs.map((pair) => (
                  <div key={pair.key} className="story-hero__meta-item">
                    <dt style={label.smBold}>{pair.label}</dt>
                    <dd style={{ ...text.bodySm, margin: 0 }}>{pair.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}

          <div className="story-hero__body">
            {media && (
              <div className="story-figure">
                <Frame ratio="wide" fit="cover">
                  <Image src={media.url} alt={media.alt} width={768} height={400} priority />
                </Frame>
              </div>
            )}

            {/* Figma sets 44px between the image and this group but only 20px
                inside it, so the About block and the author row are one
                content-wrapper (`25944:8634`) rather than three flat siblings. */}
            <div className="story-hero__content">
              {description && (
                <div className="story-hero__about">
                  <h2 style={{ ...heading.subsection, margin: 0 }}>About</h2>
                  <p style={text.body}>{description}</p>
                </div>
              )}

              {(hasIdentity || socialLinks.length > 0) && (
                <div className="story-hero__author">
                  {author && hasIdentity && (
                    <div className="story-hero__author-identity">
                      <Avatar
                        size="lg"
                        name={author.name}
                        {...(author.headshotUrl
                          ? { src: author.headshotUrl, alt: author.name }
                          : {})}
                      />
                      <span className="story-hero__author-text">
                        <span style={{ ...label.smBold, color: color.text.primary }}>
                          {author.name}
                        </span>
                        {author.role && (
                          <span style={{ ...text.bodySm, color: color.text.secondary }}>
                            {author.role}
                          </span>
                        )}
                      </span>
                    </div>
                  )}

                  {socialLinks.length > 0 && (
                    <ul className="story-hero__social">
                      {socialLinks.map((link) => (
                        <li key={`${link.platform}-${link.url}`}>
                          <a
                            href={link.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="story-hero__social-link"
                          >
                            {/* size="md" is 28px, exactly the Figma mark at
                                25944:9430; emphasis="inverse" fills
                                `--surface-inverse` (#1b1b1b), the hue that
                                node specifies. */}
                            <SocialIcon
                              platform={link.platform}
                              type="badge"
                              size="md"
                              emphasis="inverse"
                            />
                          </a>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
