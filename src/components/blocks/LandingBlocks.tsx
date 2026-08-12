import Image from 'next/image';
import type { RawBlock, BlockContext, DetailItem, SpeakerProps, HeroProps } from '@/lib/blocks';
import type { LandingSurface } from '@/lib/events';
import { seriesIdentity } from '@/lib/series';
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
import { heading, text } from '@/lib/styles';
import { color, gap } from '@/lib/tokens';
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
 *     Graduation, restyled to the Paper mock). Each fixed-palette card carries
 *     one oversized rounded corner and framed (purple-ringed) photos, stacked in
 *     a fixed region order: a yellow hero (title + CTAs beside a photo), a blue
 *     Venue/Admission/Audience trio, a yellow schedule (agenda + photo), a green
 *     about card, the purple registration card, a blue Panel card, and a
 *     full-width grey sponsors band. Colors are baked into the layout (no
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
  series,
  surface,
}: {
  blocks: RawBlock[];
  context: BlockContext;
  layout: string | null;
  /** Series-category slug (showcase layout only); resolved via SERIES_REGISTRY. */
  series?: string | null;
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
    // Series tag — the code-owned identity (label + wine icon) for the event's
    // series slug; rendered atop the hero text column on a green-light ground.
    const seriesTag = seriesIdentity(series);
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
            <div className="lp-showcase__card lp-showcase__card--yellow lp-showcase__card--corner-bl lp-showcase__hero">
              <div className="lp-showcase__hero-main">
                {seriesTag && (
                  <span className="lp-showcase__series-tag">
                    <Icon icon={seriesTag.icon} width={18} height={18} aria-hidden />
                    {seriesTag.label}
                  </span>
                )}
                {/* The series tag is the hero kicker — drop the authored eyebrow
                    when one renders so the series name isn't shown twice. */}
                <ShowcaseTitle {...hero} eyebrow={seriesTag ? undefined : hero.eyebrow} />
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
              {hero.media && (
                <div className="lp-showcase__hero-media lp-showcase__framed lp-showcase__framed--corner-br">
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
            </div>
          )}

          {/* Venue / Admission / Audience trio — 3-up blue stat cards. */}
          {trioItems.length > 0 && <ShowcaseTrio items={trioItems} />}

          {/* Schedule — yellow card, agenda beside a framed photo. Anchor target
              for the hero's "View Schedule" CTA. */}
          {scheduleBlocks.length > 0 && (
            <div
              id={SCHEDULE_ANCHOR}
              className="lp-showcase__card lp-showcase__card--yellow lp-showcase__card--corner-bl lp-showcase__schedule"
            >
              <BlockRenderer blocks={scheduleBlocks} context={context} />
            </div>
          )}

          {/* About — green card: a framed photo in the left column, text
              (heading + body) in the right (single column when no photo). */}
          {(aboutHead.length > 0 || aboutBody.length > 0) && (
            <div
              className={[
                'lp-showcase__card lp-showcase__card--green lp-showcase__card--corner-br lp-showcase__about',
                aboutMedia && 'lp-showcase__about--media',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              {aboutMedia && (
                <div className="lp-showcase__about-media lp-showcase__framed lp-showcase__framed--corner-tr">
                  <Image
                    src={aboutMedia.url}
                    alt={aboutMedia.alt}
                    fill
                    sizes="(max-width: 767px) 100vw, 45vw"
                    style={{ objectFit: 'cover' }}
                  />
                </div>
              )}
              <div className="lp-showcase__about-content">
                <BlockRenderer blocks={aboutHead} context={context} />
                <BlockRenderer blocks={aboutBody} context={context} />
              </div>
            </div>
          )}

          {/* Registration — purple card, full width. Anchor target for the
              hero's "Register" CTA. */}
          {hasRegistration && (
            <div
              id={REGISTER_ANCHOR}
              className="lp-showcase__card lp-showcase__card--purple lp-showcase__card--corner-tr lp-showcase__registration"
            >
              {/* Title + event metadata grouped as one header above the form
                  (functional chrome — "Register today" mirrors the legacy
                  path's hardcoded heading, not authored copy). */}
              <div className="lp-showcase__registration-head">
                <h2 style={heading.lg}>
                  Register today
                </h2>
                <BlockRenderer blocks={metaBlocks} context={context} />
              </div>
              <BlockRenderer blocks={formBlocks} context={formContext} />
            </div>
          )}

          {/* Speakers — blue card holding a 3-up grid of avatar + role + name + org. */}
          {speakers.length > 0 && <ShowcaseSpeakers speakers={speakers} />}
        </div>

        {/* Sponsors — a full-width grey band below the card stack: a centered
            heading over a grid of white logo cards. */}
        {partners && partners.logos.length > 0 && (
          <div className="lp-showcase__partners-band">
            <div className="lp-showcase__partners-inner">
              {(partners.title || partners.description) && (
                <div className="lp-showcase__partners-head">
                  {partners.title && <h2 style={heading.lg}>{partners.title}</h2>}
                  {partners.description && (
                    <p style={{ ...text.body, margin: 0 }}>{partners.description}</p>
                  )}
                </div>
              )}
              <div className="lp-showcase__partners">
                {partners.logos.map((logo, i) => {
                  const inner = (
                    <span className="lp-showcase__logo">
                      <Image
                        src={logo.url}
                        alt={logo.alt || ''}
                        fill
                        sizes="(max-width: 639px) 45vw, 22vw"
                        style={{ objectFit: 'contain' }}
                      />
                    </span>
                  );
                  return logo.href ? (
                    <a
                      key={logo.url || i}
                      href={logo.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={logo.alt || 'Sponsor website'}
                      className="lp-showcase__logo-card"
                    >
                      {inner}
                    </a>
                  ) : (
                    <div key={logo.url || i} className="lp-showcase__logo-card">
                      {inner}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
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
 * Big display type for the showcase hero title — one step above the marketing
 * heading scale (heading/huge · 45.5px), which HeroBlock's default heading.lg
 * (32px) doesn't reach. Title Case per the #852 design (the
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
      {eyebrow && <span className="lp-showcase__eyebrow">{eyebrow}</span>}
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
            // Card-title weight/size (mock); left-aligned by .lp-showcase__stat.
            <span style={heading.card} className="lp-showcase__stat-label">
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
 * showcase speakers — one yellow card holding a 3-up grid of speaker cells, each
 * a circular avatar over a role eyebrow, name, and org (mirroring the flyer).
 * Renders every authored speaker; the grid reflows to 1/2 columns below the
 * showcase breakpoints.
 */
function ShowcaseSpeakers({ speakers }: { speakers: SpeakerProps[] }) {
  return (
    <div className="lp-showcase__card lp-showcase__card--blue lp-showcase__card--corner-br lp-showcase__speakers-card">
      <h2 style={heading.lg}>Panel</h2>
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
            <span
              className={`lp-showcase__role-pill ${
                /host/i.test(speaker.role)
                  ? 'lp-showcase__role-pill--host'
                  : 'lp-showcase__role-pill--speaker'
              }`}
            >
              {speaker.role}
            </span>
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
