'use client';

/**
 * BreadcrumbSwitcher — the hero breadcrumb trail plus a leaf-record switcher
 * for the service interior page (#740, BRIK-WEB-59 / Round 12).
 *
 * The trailing crumb names the service you're viewing. This adds a caret after
 * the trail that opens a menu of the sibling services in the same service line,
 * so visitors can jump between them without going back to the line index. The
 * BDS `Breadcrumb` renders the trail unchanged — the current crumb keeps
 * `aria-current="page"`; the caret is a separate `aria-haspopup` control
 * alongside it.
 *
 * Adapted from the client-portal `BreadcrumbSwitcher` (PORTAL-81 /
 * brik-client-portal#2145) — the same composition of BDS primitives
 * (Breadcrumb + Menu + Button + caret Icon). Promoting this to a shared BDS
 * component so both consumers drop their local copy is tracked separately
 * (brik-bds consolidation item filed with #740).
 *
 * `Icon` comes from the site's offline `@/lib/icon` (not `@brikdesigns/bds`),
 * so `ph:caret-down` must stay in `src/lib/icons.generated.json` — run
 * `npm run gen:icons` after changing the glyph (CI gates it via
 * `gen:icons:check`). (brikdesigns#626)
 *
 * The caret only renders when there's more than one option (nothing to switch
 * to otherwise).
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Breadcrumb, Menu, Button } from '@brikdesigns/bds';
import { Icon } from '@/lib/icon';
import { font, gap } from '@/lib/tokens';

export interface BreadcrumbSwitchItem {
  label: string;
  href?: string;
}

export interface BreadcrumbSwitchOption {
  label: string;
  href: string;
  /** The service currently being viewed — highlighted and non-navigating. */
  current?: boolean;
}

interface BreadcrumbSwitcherProps {
  /** Full crumb trail (Services → service line → current service). */
  items: readonly BreadcrumbSwitchItem[];
  /** Sibling services to switch between, including the current one. */
  options: BreadcrumbSwitchOption[];
  /** Accessible label for the switch trigger, e.g. `Switch service`. */
  switchLabel: string;
}

export function BreadcrumbSwitcher({ items, options, switchLabel }: BreadcrumbSwitcherProps) {
  const [isOpen, setIsOpen] = useState(false);
  const router = useRouter();

  const activeHref = options.find((o) => o.current)?.href;

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: gap.xs, position: 'relative' }}>
      {/* `bds-hero__breadcrumb` preserves the hero trail styling + the
          `[data-audience] .bds-breadcrumb` service-line tint cascade
          (brik-bds#781) the adapter previously applied. */}
      <Breadcrumb
        className="bds-hero__breadcrumb"
        items={items.map((i) => ({ label: i.label, href: i.href }))}
        linkComponent={Link}
      />

      {options.length > 1 && (
        <span style={{ position: 'relative', display: 'inline-flex' }}>
          <Button
            variant="ghost"
            size="tiny"
            label={switchLabel}
            aria-haspopup="menu"
            aria-expanded={isOpen}
            // Stop the mousedown reaching the Menu's document outside-click
            // listener, so toggling closed on the trigger doesn't immediately
            // reopen.
            onMouseDown={(e) => e.stopPropagation()}
            onClick={() => setIsOpen((o) => !o)}
            icon={
              <Icon
                icon="ph:caret-down"
                style={{
                  fontSize: font.size.body.tiny,
                  transition: 'transform 0.15s',
                  transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                }}
              />
            }
          />

          {/* Menu positions itself off the relative caret span — same
              composition as the portal switcher. */}
          <Menu
            isOpen={isOpen}
            onClose={() => setIsOpen(false)}
            activeId={activeHref}
            style={{ top: `calc(100% + ${gap.xs})`, left: 0 }}
            items={options.map((o) => ({
              id: o.href,
              label: o.label,
              onClick: () => {
                setIsOpen(false);
                if (!o.current) router.push(o.href);
              },
            }))}
          />
        </span>
      )}
    </span>
  );
}
