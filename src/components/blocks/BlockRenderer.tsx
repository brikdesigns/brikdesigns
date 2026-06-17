import type { RawBlock, BlockContext } from '@/lib/blocks';
import {
  parseAlertBanner,
  parseRichContentProps,
  parseEventMetaProps,
  parseSpeakerProps,
  parseLogoStripProps,
  parseCrossReferenceProps,
  parseHeroProps,
  parseFormProps,
  parseCtaProps,
} from '@/lib/blocks';
import { RichContentBlock } from './RichContentBlock';
import { EventMetaBlock } from './EventMetaBlock';
import { SpeakerBlock } from './SpeakerBlock';
import { LogoStripBlock } from './LogoStripBlock';
import { AlertBannerBlock } from './AlertBannerBlock';
import { CrossReferenceBlock } from './CrossReferenceBlock';
import { HeroBlock } from './HeroBlock';
import { FormBlock } from './FormBlock';
import { CtaBlock } from './CtaBlock';
import './blocks.css';

/**
 * Renderer for one block from the data model. Props arrive as untyped jsonb
 * (author-supplied, composer-validated, sanitized downstream); each arm casts
 * to its typed interface at this boundary.
 *
 * The accent-bearing arms (hero / form / cta) read page-level `context`
 * (row id for the form, service accent for the hero tint / form-card border,
 * ended state for the form). The non-accent arms ignore it. An unknown `type`
 * is skipped with a dev warning — gated coverage, not a silent drop.
 */
function renderBlock(block: RawBlock, key: number, context: BlockContext) {
  const { props } = block;
  switch (block.type) {
    case 'rich-content':
      return <RichContentBlock key={key} {...parseRichContentProps(props)} />;
    case 'event-meta':
      return <EventMetaBlock key={key} {...parseEventMetaProps(props)} />;
    case 'speaker': {
      const data = parseSpeakerProps(props);
      return data ? <SpeakerBlock key={key} {...data} /> : null;
    }
    case 'logo-strip':
      return <LogoStripBlock key={key} {...parseLogoStripProps(props)} />;
    case 'alert-banner': {
      const data = parseAlertBanner(props);
      return data ? <AlertBannerBlock key={key} {...data} /> : null;
    }
    case 'cross-reference': {
      const data = parseCrossReferenceProps(props);
      return data ? <CrossReferenceBlock key={key} {...data} /> : null;
    }
    case 'hero':
      return <HeroBlock key={key} {...parseHeroProps(props)} />;
    case 'form':
      return (
        <FormBlock
          key={key}
          {...parseFormProps(props)}
          rowId={context.rowId}
          accent={context.accent}
          ended={context.ended}
        />
      );
    case 'cta':
      return <CtaBlock key={key} {...parseCtaProps(props)} />;
    default:
      if (process.env.NODE_ENV !== 'production') {
        console.warn(`[BlockRenderer] No renderer for block type "${block.type}". Block skipped.`);
      }
      return null;
  }
}

/**
 * Render an ordered list of landing-page blocks. The caller decides the
 * fallback: an empty `blocks` array means "render from the legacy columns"
 * (the 00207 contract) and BlockRenderer is not invoked. `context` carries the
 * page-level data the accent-bearing arms need (see BlockContext).
 */
export function BlockRenderer({
  blocks,
  context,
}: {
  blocks: RawBlock[];
  context: BlockContext;
}) {
  return <>{blocks.map((block, i) => renderBlock(block, i, context))}</>;
}
