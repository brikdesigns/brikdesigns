/**
 * Landing-page block model — the type ⇄ props contract for the block-based
 * landing pages (brikdesigns#423). The block `type` vocabulary and each
 * block's `props` are defined by the catalogue
 * (docs/landing-page-block-catalogue.md, #421); the column shapes
 * (`events.blocks` / `events.alert_banner`) are fixed by the portal migration
 * 00207 (the source of truth).
 *
 * SCOPE — foundation slice (#423): only the **non-accent** blocks are typed +
 * renderable here. The accent-bearing blocks (`hero` tint, `form` card accent
 * border, `cta` on accent) are gated on the BDS color foundation
 * (brik-bds#827) and `cross-reference` ships with #422 (shared CMS picker).
 * Those `type`s are added — type + renderer arm together — when their gates
 * clear; until then the renderer skips them (see BlockRenderer).
 */

// ─── Wire shape ──────────────────────────────────────────────────────
// What the untyped Supabase client hands back from the `events.blocks`
// jsonb column: an ordered array of `{ type, props }`. Props are narrowed to
// a typed interface per block at the render boundary (BlockRenderer).
export interface RawBlock {
  type: string;
  props: Record<string, unknown>;
}

// ─── Renderable (non-accent) block props ─────────────────────────────

/** Prose body — paragraphs, lists, checklists. `html` is sanitized at render. */
export interface RichContentProps {
  html: string;
}

/** Date / time / fee row. Each field optional; an omitted `fee` hides the
 *  fee item, `fee: null` renders "Free", a number renders the dollar amount. */
export interface EventMetaProps {
  date?: string | null;
  time?: string | null;
  fee?: number | null;
}

/** Speaker name + bio (+ optional avatar). */
export interface SpeakerProps {
  name: string;
  bio?: string | null;
  avatar?: { url: string; alt: string } | null;
}

/** Sponsor / partner logo row. */
export interface LogoStripLogo {
  url: string;
  alt: string;
  href?: string | null;
}
export interface LogoStripProps {
  logos: LogoStripLogo[];
}

// ─── Alert banner (block + page-level field share this shape) ─────────

export type AlertTone = 'info' | 'warning' | 'success' | 'neutral';

/** `events.alert_banner` jsonb and the `alert-banner` block share this shape. */
export interface AlertBannerData {
  message: string;
  tone: AlertTone;
}

/** BDS Banner tone vocabulary (mirrors @brikdesigns/bds BannerProps['tone']). */
export type BannerToneName = 'announcement' | 'warning' | 'error' | 'information';

/**
 * Map the data-model tone to a BDS Banner tone.
 *
 * `info` → `information` and `warning` → `warning` are exact. BDS Banner has
 * **no `success` or `neutral` tone** (its vocabulary is announcement / warning
 * / error / information), so both fall back to `information`. We deliberately
 * do NOT map `success` → `announcement`: BDS gives `announcement` the
 * `role="banner"` landmark (for persistent marketing notices), whereas the
 * status tones get `role="alert"` — the correct semantics for a transient
 * contextual notice. `information` keeps the alert role and the quieter
 * secondary surface. A dedicated Banner `success`/`neutral` tone is the proper
 * fix — a flagged BDS gap, never a per-block color override (catalogue
 * Foundation Gate; #429). Revisit when that BDS addition lands.
 */
const TONE_TO_BANNER: Record<AlertTone, BannerToneName> = {
  info: 'information',
  warning: 'warning',
  success: 'information',
  neutral: 'information',
};

export function toBannerTone(tone: AlertTone): BannerToneName {
  return TONE_TO_BANNER[tone] ?? 'information';
}

// ─── Parsing (untyped jsonb → typed surface) ─────────────────────────

function isAlertTone(value: unknown): value is AlertTone {
  return value === 'info' || value === 'warning' || value === 'success' || value === 'neutral';
}

/**
 * Normalize the raw `events.blocks` jsonb into an ordered `RawBlock[]`.
 * Empty / malformed → `[]`, which the routes treat as the legacy-column
 * render fallback (the 00207 contract).
 */
export function parseBlocks(raw: unknown): RawBlock[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (b): b is { type: string; props?: unknown } =>
        !!b && typeof b === 'object' && typeof (b as { type?: unknown }).type === 'string',
    )
    .map((b) => ({
      type: b.type,
      props:
        b.props && typeof b.props === 'object' ? (b.props as Record<string, unknown>) : {},
    }));
}

/**
 * Normalize the raw `events.alert_banner` jsonb. Empty `{}` or a missing
 * message → `null` (no banner). Unknown tone falls back to `info`.
 */
export function parseAlertBanner(raw: unknown): AlertBannerData | null {
  if (!raw || typeof raw !== 'object') return null;
  const message = (raw as { message?: unknown }).message;
  if (typeof message !== 'string' || !message.trim()) return null;
  const tone = (raw as { tone?: unknown }).tone;
  return { message, tone: isAlertTone(tone) ? tone : 'info' };
}

// ─── Per-block prop normalizers (untyped jsonb → typed props) ─────────
// Each block's `props` arrives as an untyped jsonb object. These coerce the
// fields the renderer reads, mirroring parseAlertBanner — so a malformed
// payload (wrong type, missing key) degrades to "render nothing for that
// field" instead of leaking `[object Object]` / `$NaN` onto the page.

function str(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

export function parseRichContentProps(props: Record<string, unknown>): RichContentProps {
  return { html: str(props.html) ?? '' };
}

export function parseEventMetaProps(props: Record<string, unknown>): EventMetaProps {
  const out: EventMetaProps = {};
  const date = str(props.date);
  if (date !== undefined) out.date = date;
  const time = str(props.time);
  if (time !== undefined) out.time = time;
  // Distinguish "no fee key" (hide) from `null` (Free) from a number ($amount).
  if (typeof props.fee === 'number') out.fee = props.fee;
  else if (props.fee === null) out.fee = null;
  return out;
}

export function parseSpeakerProps(props: Record<string, unknown>): SpeakerProps | null {
  const name = str(props.name) ?? '';
  const bio = str(props.bio);
  const rawAvatar = props.avatar;
  let avatar: SpeakerProps['avatar'] = null;
  if (rawAvatar && typeof rawAvatar === 'object') {
    const url = str((rawAvatar as { url?: unknown }).url);
    if (url) avatar = { url, alt: str((rawAvatar as { alt?: unknown }).alt) ?? '' };
  }
  if (!name && !bio) return null;
  return { name, bio, avatar };
}

export function parseLogoStripProps(props: Record<string, unknown>): LogoStripProps {
  const raw = props.logos;
  if (!Array.isArray(raw)) return { logos: [] };
  const logos: LogoStripLogo[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const url = str((item as { url?: unknown }).url);
    if (!url) continue;
    logos.push({
      url,
      alt: str((item as { alt?: unknown }).alt) ?? '',
      href: str((item as { href?: unknown }).href),
    });
  }
  return { logos };
}
