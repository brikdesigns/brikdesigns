import type { CSSProperties, ReactNode } from 'react';
import { TextLink } from '@brikdesigns/bds';
import { Icon } from '@/lib/icon';
import { color } from '@/lib/tokens';

interface BackLinkProps {
  /** Destination — the parent index/list this page sits directly under. */
  href: string;
  /** Link text (e.g. "Customer Stories"), rendered after a left arrow. */
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}

/**
 * "← {Parent}" back link for single-level leaf pages — a detail page that sits
 * directly under one index (customer story, blog post, customer page). Replaces
 * a degenerate one-level breadcrumb: it's a clearer return affordance, stays
 * compact against long titles, and drops the dead non-link current-page crumb.
 *
 * Pages with two or more navigable ancestors (e.g. Services → Service Line) use
 * a full BDS `Breadcrumb` instead. Nav-pattern rule + rationale: brikdesigns#712.
 *
 * Color is pinned to `--text-brand-primary` (the AA-safe poppy-dark/-lighter
 * step from the #649 fix) rather than TextLink's default rest color, which is
 * the raw poppy base (#e35335 = 3.78:1 on white — fails AA). The arrow inherits
 * it via currentColor.
 */
export function BackLink({ href, children, className, style }: BackLinkProps) {
  return (
    <TextLink
      href={href}
      className={className}
      style={{ ...style, color: color.text.brand }}
      iconBefore={<Icon icon="ph:arrow-left" width={16} height={16} aria-hidden />}
    >
      {children}
    </TextLink>
  );
}
