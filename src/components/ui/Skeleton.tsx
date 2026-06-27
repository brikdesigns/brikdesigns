import type { CSSProperties } from 'react';
import './skeleton.css';

type SkeletonProps = {
  /** Extra class names appended after the base `skeleton` class. */
  className?: string;
  /** Inline sizing/layout. Width/height/aspect-ratio live here per-instance. */
  style?: CSSProperties;
};

/**
 * Animated placeholder block for route-level `loading.tsx` skeletons.
 * Pulses via opacity so it reads as "loading" rather than a static
 * (broken-looking) grey block. Respects `prefers-reduced-motion`.
 *
 * Compose these inside the page's real layout classes (`.page-hero`,
 * `.container-lg`, etc.) so the skeleton matches the content's shape.
 */
export function Skeleton({ className, style }: SkeletonProps) {
  return <div aria-hidden className={className ? `skeleton ${className}` : 'skeleton'} style={style} />;
}
