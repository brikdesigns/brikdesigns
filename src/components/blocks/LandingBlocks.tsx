import Image from 'next/image';
import type { RawBlock, BlockContext, DetailItem, SpeakerProps, HeroProps } from '@/lib/blocks';
import type { LandingSurface } from '@/lib/events';
import {
  parseContentBlockProps,
  parseDetailsProps,
  parseSpeakerBlockProps,
  parseHeroProps,
  parseLogoStripProps,
  parseCtaProps,
} from '@/lib/blocks';
import { LinkButton } from '@brikdesigns/bds';
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
 *     Graduation, redesigned in #852). Full-width fixed-palette cards stacked
 *     in a fixed region order: a yellow hero (photo + title + CTAs), a blue
 *     Venue/Admission/Audience trio, a purple schedule (agenda + photo), a
 *     purple about card, the purple registration card, a green speaker card,
 *     and the partners logo grid. Colors are baked into the layout (no
 *     per-event / per-block color — the section owns them via CSS), so events
 *     opt in with `layout: 'showcase'` and the same block data render
 *     differently.
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
    // .lp-showcase* CSS — never a per-block color (#429). The hero, trio and
    // speaker diverge structurally from their default blocks (photo + CTA row;
    // 3-up cards; circular avatars), so they're rendered here from parsed props
    // rather than via BlockRenderer.
    const heroBlocks = blocks.filter((b) => b.type === 'hero');
    const ctaBlocks = blocks.filter((b) => b.type === 'cta');
    // The about card lays its text (heading + prose body) in the left column;
    // an optional photo authored on the `content-block` fills the right column
    // (single column when no photo is set).
    const aboutHead = blocks.filter((b) => b.type === 'content-block');
    const aboutBody = blocks.filter((b) => b.type === 'prose' || b.type === 'rich-content');
    const aboutMedia = aboutHead[0] ? parseContentBlockProps(aboutHead[0].props).media ?? null : null;
    const metaBlocks = blocks.filter((b) => b.type === 'event-meta');
    const formBlocks = blocks.filter((b) => b.type === 'form');
    const detailsBlock = blocks.find((b) => b.type === 'details');
    const scheduleBlocks = blocks.filter((b) => b.type === 'schedule');
    const speakerBlock = blocks.find((b) => b.type === 'speaker');
    const logoBlocks = blocks.filter((b) => b.type === 'logo-strip');

    const hero = heroBlocks[0] ? parseHeroProps(heroBlocks[0].props) : null;
    const trioItems = detailsBlock ? parseDetailsProps(detailsBlock.props).items : [];
    const speakers = speakerBlock ? parseSpeakerBlockProps(speakerBlock.props).speakers : [];
    const partners = logoBlocks[0] ? parseLogoStripProps(logoBlocks[0].props) : null;
    // Hero CTA buttons come from the authored `cta` blocks — flattened, and
    // in-page anchor links dropped when the region they target isn't rendered
    // (a "View Schedule" button on an event with no schedule block would
    // scroll nowhere). Only the ids this layout emits count as rendered.
    const renderedAnchors = new Set<string>();
    if (scheduleBlocks.length) renderedAnchors.add(SCHEDULE_ANCHOR);
    const hasRegistration = metaBlocks.length > 0 || formBlocks.length > 0;
    if (hasRegistration) renderedAnchors.add(REGISTER_ANCHOR);
    const heroButtons = ctaBlocks
      .flatMap((b) => parseCtaProps(b.props).buttons)
      .filter((b) => !b.href.startsWith('#') || renderedAnchors.has(b.href.slice(1)));
    // The form lays out two-up inside the wide registration card (#showcase).
    const formContext: BlockContext = { ...context, formColumns: 2 };

    return (
      <section className="lp-blocks lp-showcase">
        <div className="lp-showcase__container">
          {/* Hero — yellow card: photo beside title / subtitle / CTAs. */}
          {hero && (hero.title || hero.eyebrow || hero.subtitle || hero.media) && (
            <div className="lp-showcase__card lp-showcase__card--yellow lp-showcase__hero">
              {hero.media && (
                <div className="lp-showcase__hero-media">
                  <Image
                    src={hero.media.url}
                    alt={hero.media.alt}
                    fill
                    sizes="(max-width: 767px) 100vw, 45vw"
                    style={{ objectFit: 'cover' }}
                    priority
                  />
                </div>
              )}
              <div className="lp-showcase__hero-main">
                <ShowcaseTitle {...hero} />
                {heroButtons.length > 0 && (
                  <div className="lp-showcase__hero-actions">
                    {heroButtons.map((button, i) => (
                      <LinkButton
                        key={`${button.href}-${i}`}
                        href={button.href}
                        // Accent fills are deliberately not used here: white on
                        // --background-brand-primary is 3.4:1 and fails the a11y
                        // gate (#429). The BDS variants stay accessible.
                        variant={button.variant ?? (i === 0 ? 'primary' : 'secondary')}
                        size="md"
                      >
                        {button.label}
                      </LinkButton>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Venue / Admission / Audience trio — 3-up blue stat cards. */}
          {trioItems.length > 0 && <ShowcaseTrio items={trioItems} />}

          {/* Schedule — purple card, agenda beside a photo. Anchor target for
              the hero's "View Schedule" CTA. */}
          {scheduleBlocks.length > 0 && (
            <div
              id={SCHEDULE_ANCHOR}
              className="lp-showcase__card lp-showcase__card--purple lp-showcase__schedule"
            >
              <BlockRenderer blocks={scheduleBlocks} context={context} />
            </div>
          )}

          {/* About — purple card: text (heading + body) in the left column, an
              optional authored photo in the right (single column when unset). */}
          {(aboutHead.length > 0 || aboutBody.length > 0) && (
            <div
              className={[
                'lp-showcase__card lp-showcase__card--purple lp-showcase__about',
                aboutMedia && 'lp-showcase__about--media',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              <div className="lp-showcase__about-content">
                <BlockRenderer blocks={aboutHead} context={context} />
                <BlockRenderer blocks={aboutBody} context={context} />
              </div>
              {aboutMedia && (
                <div className="lp-showcase__about-media">
                  <Image
                    src={aboutMedia.url}
                    alt={aboutMedia.alt}
                    fill
                    sizes="(max-width: 767px) 100vw, 45vw"
                    style={{ objectFit: 'cover' }}
                  />
                </div>
              )}
            </div>
          )}

          {/* Registration — purple card, full width. Anchor target for the
              hero's "Register" CTA. */}
          {hasRegistration && (
            <div
              id={REGISTER_ANCHOR}
              className="lp-showcase__card lp-showcase__card--purple lp-showcase__registration"
            >
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

          {/* Speakers — green card holding a 3-up grid of avatar + role + name + org. */}
          {speakers.length > 0 && <ShowcaseSpeakers speakers={speakers} />}

          {/* Partners — optional centered heading (authored on the logo-strip
              block) over the sponsor logo grid. */}
          {partners && partners.logos.length > 0 && (
            <div className="lp-showcase__partners-wrap">
              {(partners.title || partners.description) && (
                <div className="lp-showcase__partners-head">
                  {partners.title && (
                    <h2 className={SHOWCASE_DISPLAY_CLASS}>{partners.title}</h2>
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

/** Fragment ids the showcase regions emit — the hero CTAs' anchor targets. */
const SCHEDULE_ANCHOR = 'schedule';
const REGISTER_ANCHOR = 'register';

/**
 * Big display type for the showcase title + partners heading — one step above
 * the marketing heading scale (heading/huge · 45.5px), which HeroBlock's
 * default heading.lg (32px) doesn't reach. Title Case per the #852 design (the
 * earlier uppercase transform is gone); colour inherits the card's pinned dark
 * ink.
 *
 * A CSS class rather than an inline style object: the size steps down at phone
 * widths (a single long word overflows the card at 45.5px), and an inline
 * font-size would win over that media query.
 */
const SHOWCASE_DISPLAY_CLASS = 'lp-showcase__display';

/**
 * showcase title — the hero's eyebrow / title / subtitle rendered as the
 * oversized display headline, rather than HeroBlock's default marketing
 * heading. `titleEmphasis` sets an italic lead-in **inside** the same heading,
 * so "Grind" + "After Graduation" still reads as one accessible name.
 * Content only; the card owns the surface.
 */
function ShowcaseTitle({ eyebrow, title, titleEmphasis, subtitle }: HeroProps) {
  return (
    <>
      {eyebrow && (
        <p style={{ ...label.subtitle, marginBottom: gap.xs, textTransform: 'uppercase' }}>
          {eyebrow}
        </p>
      )}
      {(title || titleEmphasis) && (
        <h1 className={SHOWCASE_DISPLAY_CLASS}>
          {titleEmphasis && <em className="lp-showcase__title-em">{titleEmphasis} </em>}
          {title}
        </h1>
      )}
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
            <span
              style={{ ...label.subtitle, fontWeight: font.weight.semibold }}
              className="lp-showcase__stat-label"
            >
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
    <div className="lp-showcase__card lp-showcase__card--green lp-showcase__speakers-card">
      <h2 style={heading.sm}>Panel</h2>
      <div className="lp-showcase__speakers">
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
    </div>
  );
}
