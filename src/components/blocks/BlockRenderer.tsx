import type { RawBlock } from '@/lib/blocks';
import {
  parseAlertBanner,
  parseRichContentProps,
  parseEventMetaProps,
  parseSpeakerProps,
  parseLogoStripProps,
  parseCrossReferenceProps,
} from '@/lib/blocks';
import { RichContentBlock } from './RichContentBlock';
import { EventMetaBlock } from './EventMetaBlock';
import { SpeakerBlock } from './SpeakerBlock';
import { LogoStripBlock } from './LogoStripBlock';
import { AlertBannerBlock } from './AlertBannerBlock';
import { CrossReferenceBlock } from './CrossReferenceBlock';
import './blocks.css';

/**
 * Renderer for one block from the data model. Props arrive as untyped jsonb
 * (author-supplied, composer-validated, sanitized downstream); each arm casts
 * to its typed interface at this boundary.
 *
 * Non-accent blocks are handled (the #423 foundation slice + `cross-reference`,
 * #422). The accent-bearing blocks (hero / form / cta — gated on brik-bds#827)
 * have no arm yet, so the `default` skips them: there are no live rows authoring
 * those types until their gate clears, and the dev warning surfaces any
 * premature authoring. This is intentional gated coverage, not a silent drop —
 * each arm is added with its gate.
 */
function renderBlock(block: RawBlock, key: number) {
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
    default:
      if (process.env.NODE_ENV !== 'production') {
        console.warn(
          `[BlockRenderer] No renderer for block type "${block.type}". Accent blocks ` +
            `(hero/form/cta) are gated on brik-bds#827. Block skipped.`,
        );
      }
      return null;
  }
}

/**
 * Render an ordered list of landing-page blocks. The caller decides the
 * fallback: an empty `blocks` array means "render from the legacy columns"
 * (the 00207 contract) and BlockRenderer is not invoked.
 */
export function BlockRenderer({ blocks }: { blocks: RawBlock[] }) {
  return <>{blocks.map((block, i) => renderBlock(block, i))}</>;
}
