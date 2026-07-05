'use client';

/**
 * Offline-first `<Icon>` for the marketing site.
 *
 * Re-exports `@iconify/react`'s `<Icon>` and, as a module-load side effect,
 * registers the site's Phosphor subset with `addCollection`. So
 * `import { Icon } from '@/lib/icon'` resolves every `ph:*` glyph from bundled
 * data with NO request to api.iconify.design — no first-paint CDN round-trip,
 * no icon pop-in, no silent failure when the CDN is blocked. (brikdesigns#626)
 *
 * Why `'use client'`: `@iconify/react` is itself a `'use client'` package, so
 * `addCollection` is a client function — calling it at module scope from the
 * RSC server throws. Marking this module `'use client'` means the registration
 * runs in the SSR + browser environments (where Iconify actually renders), and
 * the Server Components among the import sites simply get a client reference
 * with no RSC-side execution. `<Icon>` was already a client component before
 * this change (Iconify has always been client-side), so this adds no new
 * hydration cost — it only swaps the runtime CDN fetch for bundled data.
 *
 * Why `@iconify/react` directly and not `@brikdesigns/bds`: BDS shipped an
 * offline `<Icon>` + `addBrikIcons` in v0.106.0 (brik-bds#1002), but BDS's
 * `<Icon>` auto-registers BDS's full ~77-icon subset (~31 KB) into the client
 * bundle regardless of what the site uses — and the site uses only 23 icons,
 * 11 of which overlap. For a performance ticket, shipping our own ~10 KB
 * 23-icon collection via `addCollection` (the exact primitive `addBrikIcons`
 * wraps) is ~28 KB lighter and fully self-sufficient.
 *
 * The collection is generated from `ph:*` usage by
 * `scripts/gen-icon-collection.mjs` (`npm run gen:icons`); its `--check` mode
 * gates CI so a newly added icon can't silently fall through to the CDN.
 */
import { Icon, addCollection, type IconifyJSON } from '@iconify/react';

import iconCollection from './icons.generated.json';

addCollection(iconCollection as IconifyJSON);

export { Icon };
