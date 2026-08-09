import Image from 'next/image';
import type { RawBlock, BlockContext, DetailItem, SpeakerProps, HeroProps } from '@/lib/blocks';
import type { LandingSurface } from '@/lib/events';
import { parseDetailsProps, parseSpeakerBlockProps, parseHeroProps, parseLogoStripProps } from '@/lib/blocks';
import { Icon } from '@/lib/icon';
import { heading, label, text } from '@/lib/styles';
import { color, font, gap } from '@/lib/tokens';
import { BlockRenderer } from './BlockRenderer';

/**
 * Page-level wrapper for a block-rendered landing page (#423). Owns the
 * **section surface** (tint / solid / none — resolved by `landingSurface`,
 * which sets the bg inline + a text-pairing class that re-points `--text-*` for
 * the subtree) and the **layout**:
 *
 *   - `layout="split"` — two columns: content (hero, prose, cta) on the left,
 *     the form on the right, with any `logo-strip` pulled into a full-width
 *     trailer **below** both columns (sponsors read as their own section, not a
 *     left-column tail — BACKLOG-1129). Matches the legacy fma 2-col pages.
 *   - `layout="showcase"` — the bold multi-color card layout (Grind After
 *     Graduation). A dark canvas with fixed-palette bright cards: intro
 *     (title + about, left) beside a registration card (right), a blue
 *     Venue/Hosts/Audience trio, a green speaker card + photo, and a partners
 *     logo grid. Colors are baked into the layout (no per-event / per-block
 *     color — the section owns them via CSS), so events opt in with
 *     `layout: 'showcase'` and the same block data render differently.
 *   - default — a single stacked column.
 *
 * Both routes (`/events/[slug]`, `/marketing/[slug]`) and the vanity landing
 * routes render through this so surface + layout behave identically everywhere.
 */
export function LandingBlocks({
  blocks,
  context,
  layout,
  surface,
}: {
  blocks: RawBlock[];
  context: BlockContext;
  layout: string | null;
  surface: LandingSurface;
}) {
  const sectionClass = ['lp-blocks', surface.className].filter(Boolean).join(' ');
  const style = surface.background ? { backgroundColor: surface.background } : undefined;

  if (layout === 'split') {
    const formBlocks = blocks.filter((b) => b.type === 'form');
    // logo-strip breaks out of the 2-col grid into a full-width trailer below
    // both columns, so sponsors read as their own section (BACKLOG-1129).
    const trailerBlocks = blocks.filter((b) => b.type === 'logo-strip');
    const contentBlocks = blocks.filter(
      (b) => b.type !== 'form' && b.type !== 'logo-strip',
    );
    return (
      <section className={sectionClass} style={style}>
        <div className="lp-blocks__container lp-split">
          <div className="lp-split__content">
            <BlockRenderer blocks={contentBlocks} context={context} />
          </div>
          <div className="lp-split__aside">
            <BlockRenderer blocks={formBlocks} context={context} />
          </div>
        </div>
        {trailerBlocks.length > 0 && (
          <div className="lp-blocks__container lp-split__trailer">
            <BlockRenderer blocks={trailerBlocks} context={context} />
          </div>
        )}
      </section>
    );
  }

  if (layout === 'showcase') {
    // Fixed-slot partition (COMPONENT-MAP idiom, mirroring split): each design
    // region pulls specific block types. The canvas + card colors are owned by
    // .lp-showcase* CSS — never a per-block color (#429). The trio and speaker
    // diverge structurally from their default blocks (3-up cards; big
    // right-column photo), so they're rendered here from parsed props rather
    // than via BlockRenderer.
    const heroBlocks = blocks.filter((b) => b.type === 'hero');
    const introContent = blocks.filter((b) =>
      b.type === 'content-block' || b.type === 'prose' || b.type === 'rich-content',
    );
    const metaBlocks = blocks.filter((b) => b.type === 'event-meta');
    const formBlocks = blocks.filter((b) => b.type === 'form');
    const detailsBlock = blocks.find((b) => b.type === 'details');
    const speakerBlock = blocks.find((b) => b.type === 'speaker');
    const logoBlocks = blocks.filter((b) => b.type === 'logo-strip');

    const hero = heroBlocks[0] ? parseHeroProps(heroBlocks[0].props) : null;
    const trioItems = detailsBlock ? parseDetailsProps(detailsBlock.props).items : [];
    const speakers = speakerBlock ? parseSpeakerBlockProps(speakerBlock.props).speakers : [];
    const partners = logoBlocks[0] ? parseLogoStripProps(logoBlocks[0].props) : null;
    // The form lays out two-up inside the wide registration card (#showcase).
    const formContext: BlockContext = { ...context, formColumns: 2 };

    return (
      <section className="lp-blocks lp-showcase">
        <div className="lp-showcase__container">
          {/* Intro row — title + about (left) beside the registration card (right). */}
          <div className="lp-showcase__intro">
            <div className="lp-showcase__intro-main">
              {hero && (hero.title || hero.eyebrow || hero.subtitle) && (
                <div className="lp-showcase__card lp-showcase__card--purple lp-showcase__title">
                  <ShowcaseTitle {...hero} />
                </div>
              )}
              {introContent.length > 0 && (
                <div className="lp-showcase__card lp-showcase__card--purple">
                  <BlockRenderer blocks={introContent} context={context} />
                </div>
              )}
            </div>
            {(metaBlocks.length > 0 || formBlocks.length > 0) && (
              <div className="lp-showcase__card lp-showcase__card--purple lp-showcase__registration">
                {/* Region heading — the registration card's section title
                    (mirrors the legacy path's hardcoded "Register" heading),
                    functional chrome, not authored copy. */}
                <h2 style={heading.section}>
                  Register today
                </h2>
                <BlockRenderer blocks={metaBlocks} context={context} />
                <BlockRenderer blocks={formBlocks} context={formContext} />
              </div>
            )}
          </div>

          {/* Venue / Hosts / Audience trio — 3-up blue stat cards. */}
          {trioItems.length > 0 && <ShowcaseTrio items={trioItems} />}

          {/* Speakers — green card holding a 3-up grid of avatar + role + name + org. */}
          {speakers.length > 0 && <ShowcaseSpeakers speakers={speakers} />}

          {/* Partners — optional yellow heading band (authored on the logo-strip
              block) over the sponsor logo grid. */}
          {partners && partners.logos.length > 0 && (
            <div className="lp-showcase__partners-wrap">
              {(partners.title || partners.description) && (
                <div className="lp-showcase__card lp-showcase__card--yellow lp-showcase__partners-head">
                  {partners.title && (
                    <h2 style={showcaseDisplay}>{partners.title}</h2>
                  )}
                  {partners.description && (
                    <p style={{ ...text.body, margin: 0 }}>{partners.description}</p>
                  )}
                </div>
              )}
              <div className="lp-showcase__partners">
                {partners.logos.map((logo, i) => {
                  const img = (
                    <Image
                      src={logo.url}
                      alt={logo.alt || ''}
                      fill
                      sizes="(max-width: 767px) 45vw, 280px"
                      style={{ objectFit: 'contain' }}
                    />
                  );
                  return logo.href ? (
                    <a
                      key={logo.url || i}
                      href={logo.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={logo.alt || 'Sponsor website'}
                      className="lp-showcase__logo"
                    >
                      {img}
                    </a>
                  ) : (
                    <span key={logo.url || i} className="lp-showcase__logo">
                      {img}
                    </span>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </section>
    );
  }

  return (
    <section className={sectionClass} style={style}>
      <div className="lp-blocks__container">
        <BlockRenderer blocks={blocks} context={context} />
      </div>
    </section>
  );
}

/**
 * Big uppercase display type for the showcase title + partners heading — one
 * step above the marketing heading scale (heading/huge · 45.5px, semibold via
 * the shared heading weight token), which HeroBlock's default heading.lg (32px)
 * doesn't reach. Colour inherits the card's pinned dark ink.
 */
const showcaseDisplay = {
  fontFamily: font.family.heading,
  fontSize: font.size.heading.xxxLarge,
  fontWeight: font.weight.bold,
  lineHeight: font.lineHeight.tight,
  textTransform: 'uppercase',
  margin: 0,
} as const;

/**
 * showcase title — the hero's eyebrow / title / subtitle rendered as the
 * oversized uppercase display headline (semibold), rather than
 * HeroBlock's default marketing heading. Content only; the card owns the surface.
 */
function ShowcaseTitle({ eyebrow, title, subtitle }: HeroProps) {
  return (
    <>
      {eyebrow && (
        <p style={{ ...label.subtitle, marginBottom: gap.xs, textTransform: 'uppercase' }}>
          {eyebrow}
        </p>
      )}
      {title && <h1 style={showcaseDisplay}>{title}</h1>}
      {subtitle && <p style={{ ...text.bodyLg, marginTop: gap.sm }}>{subtitle}</p>}
    </>
  );
}

/**
 * showcase trio — the `details` items (Venue / Hosts / Audience) as a 3-up grid
 * of centered stat cards. DetailsBlock renders a vertical stack, so the showcase
 * card grid is rendered here from the same parsed `DetailItem`s. Icon + text
 * take the card's pinned dark ink (`.lp-showcase__card` re-points `--text-*`).
 */
function ShowcaseTrio({ items }: { items: DetailItem[] }) {
  return (
    <div className="lp-showcase__trio">
      {items.map((item, i) => (
        <div key={i} className="lp-showcase__card lp-showcase__card--blue lp-showcase__stat">
          {item.icon && (
            <Icon
              icon={item.icon}
              width={36}
              height={36}
              aria-hidden
              style={{ color: color.text.primary }}
            />
          )}
          {item.label && (
            <span style={label.subtitle} className="lp-showcase__stat-label">
              {item.label}
            </span>
          )}
          {item.value && <span style={text.body}>{item.value}</span>}
        </div>
      ))}
    </div>
  );
}

/**
 * showcase speakers — one green card holding a 3-up grid of speaker cells, each
 * a circular avatar over a role eyebrow, name, and org (mirroring the flyer).
 * Renders every authored speaker; the grid reflows to 1/2 columns below the
 * showcase breakpoints.
 */
function ShowcaseSpeakers({ speakers }: { speakers: SpeakerProps[] }) {
  return (
    <div className="lp-showcase__card lp-showcase__card--green lp-showcase__speakers">
      {speakers.map((speaker, i) => (
        <div key={i} className="lp-showcase__speaker">
          {speaker.avatar?.url && (
            <div className="lp-showcase__speaker-avatar">
              <Image
                src={speaker.avatar.url}
                alt={speaker.avatar.alt || speaker.name || ''}
                fill
                sizes="128px"
                style={{ objectFit: 'cover' }}
              />
            </div>
          )}
          {speaker.role && (
            <p className="lp-showcase__region-label" style={label.subtitle}>
              {speaker.role}
            </p>
          )}
          {speaker.name && <h3 style={heading.card}>{speaker.name}</h3>}
          {speaker.org && (
            <p style={{ ...text.body, margin: 0 }}>{speaker.org}</p>
          )}
        </div>
      ))}
    </div>
  );
}
