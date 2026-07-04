'use client';

import { type ComponentProps, type MouseEvent, type ReactNode } from 'react';
import { Button } from '@brikdesigns/bds';

interface Props {
  /** In-page anchor target, e.g. `#services`. Retained as the anchor href for no-JS / SEO. */
  href: string;
  children: ReactNode;
  variant?: ComponentProps<typeof Button>['variant'];
  size?: ComponentProps<typeof Button>['size'];
}

/**
 * Button that smooth-scrolls to an in-page anchor on click, keeping `href` as a
 * no-JS / SEO fallback. Global `scroll-behavior: smooth` is intentionally off
 * (globals.css, #383 — it animates the App Router's route-change scroll-to-top),
 * so smooth scrolling is driven here via `scrollIntoView`. (BACKLOG-441)
 */
export function SmoothScrollButton({ href, children, variant, size }: Props) {
  const handleClick = (e: MouseEvent<HTMLAnchorElement>) => {
    const id = href.startsWith('#') ? href.slice(1) : href;
    const target = document.getElementById(id);
    if (!target) return; // no target on the page — fall back to the native anchor jump
    e.preventDefault();
    target.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <Button href={href} variant={variant} size={size} onClick={handleClick}>
      {children}
    </Button>
  );
}
