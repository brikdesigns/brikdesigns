import Image from 'next/image';
import { Stack, Frame } from '@brikdesigns/bds';
import type { LogoStripProps } from '@/lib/blocks';

/**
 * logo-strip block — sponsor / partner logos. Maps to a horizontal BDS Stack
 * of `Frame fit="contain"` items (COMPONENT-MAP), mirroring the legacy
 * `.event-page__sponsors` row. Item width is set in blocks.css.
 */
export function LogoStripBlock({ logos }: LogoStripProps) {
  if (!logos?.length) return null;

  return (
    <Stack direction="horizontal" gap="lg" wrap align="center">
      {logos.map((logo, i) => {
        const frame = (
          <Frame ratio="3-2" fit="contain" className="logo-strip__item">
            <Image src={logo.url} alt={logo.alt || ''} fill sizes="120px" />
          </Frame>
        );
        return logo.href ? (
          <a
            key={logo.url || i}
            href={logo.href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={logo.alt || 'Sponsor website'}
          >
            {frame}
          </a>
        ) : (
          <span key={logo.url || i}>{frame}</span>
        );
      })}
    </Stack>
  );
}
