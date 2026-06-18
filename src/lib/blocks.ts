/**
 * Landing-page block model — the type ⇄ props contract for the block-based
 * landing pages (brikdesigns#423). The block `type` vocabulary and each
 * block's `props` are defined by the catalogue
 * (docs/landing-page-block-catalogue.md, #421); the column shapes
 * (`events.blocks` / `events.alert_banner`) are fixed by the portal migration
 * 00207 (the source of truth).
 *
 * SCOPE: the accent-bearing blocks (`hero` tint, `form` card accent border,
 * `cta` on accent) were gated on the BDS color foundation (brik-bds#827) —
 * that gate closed 2026-06-13, so they ship here alongside the non-accent
 * blocks and `cross-reference` (#422). Each `type` is added — type + renderer
 * arm together; an unknown `type` is skipped by the renderer (see BlockRenderer).
 */
import type { eventAccent } from './events';
import type { ButtonVariant } from '@brikdesigns/bds';

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

// ─── cross-reference (related stories / services) ────────────────────

/**
 * Live collection a cross-reference block pulls from. The catalogue vocabulary
 * also lists `newsletters` (the Webflow `/newsletter` past-issues list), but
 * that ships with the newsletter-page migration — not #422 — so it is not a
 * handled source here.
 */
export type CrossReferenceSource = 'customer_stories' | 'services';

/**
 * cross-reference block — a section of related rows resolved **live** from a
 * CMS collection (#422), rendered as neutral display cards (a non-accent block
 * per the catalogue — no service-tint surface).
 *
 * Catalogue contract is `source` + `limit?` + `layout?`. `items?` (curated,
 * ordered slugs) and `title?` are forward-compatible extensions the shared CMS
 * picker writes (the #405/#422 portal half); when `items` is omitted the block
 * auto-pulls the top `limit` rows by rank.
 */
export interface CrossReferenceProps {
  source: CrossReferenceSource;
  /** Curated, ordered row slugs. Omitted ⇒ auto-pull top-`limit` by rank. */
  items?: string[];
  /** Auto-pull cap when `items` is omitted. Default 3. */
  limit?: number;
  /** `grid` (default) = responsive card grid; `row` = stacked display rows. */
  layout?: 'grid' | 'row';
  /** Section heading override; defaults per source. */
  title?: string;
}

function isCrossReferenceSource(value: unknown): value is CrossReferenceSource {
  return value === 'customer_stories' || value === 'services';
}

/**
 * Normalize a cross-reference block's props. Returns `null` (renderer skips)
 * when `source` is missing/invalid — including the catalogue's `newsletters`
 * source, which is out of scope for #422. A dev warning surfaces premature
 * authoring rather than silently dropping the block.
 */
export function parseCrossReferenceProps(
  props: Record<string, unknown>,
): CrossReferenceProps | null {
  const source = props.source;
  if (!isCrossReferenceSource(source)) {
    if (process.env.NODE_ENV !== 'production' && typeof source === 'string') {
      console.warn(
        `[blocks] cross-reference source "${source}" is not handled by #422 ` +
          `(customer_stories | services). Block skipped.`,
      );
    }
    return null;
  }
  const out: CrossReferenceProps = { source };
  if (Array.isArray(props.items)) {
    const items = props.items.filter(
      (s): s is string => typeof s === 'string' && !!s.trim(),
    );
    if (items.length) out.items = items;
  }
  if (typeof props.limit === 'number' && props.limit > 0) out.limit = Math.floor(props.limit);
  if (props.layout === 'row' || props.layout === 'grid') out.layout = props.layout;
  const title = str(props.title);
  if (title) out.title = title;
  return out;
}

// ─── Block render context ────────────────────────────────────────────
// The accent-bearing arms (hero / form / cta) need page-level context the
// per-block props don't carry. The routes thread it through BlockRenderer;
// the non-accent arms ignore it.

export interface BlockContext {
  /** `events.id` — the registration / newsletter form posts against this row. */
  rowId: string;
  /** Service accent (`eventAccent(row.accent_color_token)`): hero tint + form-card border. */
  accent: ReturnType<typeof eventAccent>;
  /** `row.status === 'ended'` → the form arm renders the ended banner instead. */
  ended: boolean;
}

// ─── hero ────────────────────────────────────────────────────────────

/** Title + optional eyebrow / tagline / media. Section tint comes from the
 *  page accent (BlockContext), not props — never a per-block color override. */
export interface HeroProps {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  media?: { url: string; alt: string } | null;
}

export function parseHeroProps(props: Record<string, unknown>): HeroProps {
  const out: HeroProps = { title: str(props.title) ?? '' };
  const eyebrow = str(props.eyebrow);
  if (eyebrow) out.eyebrow = eyebrow;
  const subtitle = str(props.subtitle);
  if (subtitle) out.subtitle = subtitle;
  const rawMedia = props.media;
  if (rawMedia && typeof rawMedia === 'object') {
    const url = str((rawMedia as { url?: unknown }).url);
    if (url) out.media = { url, alt: str((rawMedia as { alt?: unknown }).alt) ?? '' };
  }
  return out;
}

// ─── form ────────────────────────────────────────────────────────────

/**
 * Registration / newsletter / lead capture. Maps to the existing form
 * components (catalogue Form-variants table): `registration`/`newsletter` →
 * `EventRegistrationForm`, `lead` → `LeadCaptureForm`. The submit button keeps
 * its accessible BDS variant — the accent is decorative (form-card top border),
 * never the button fill (#429).
 */
export type FormVariant = 'registration' | 'newsletter' | 'lead';

export interface FormProps {
  variant: FormVariant;
  /** Lead source written to the contact + registration row. Defaults per variant. */
  source?: string;
  /** Optional card heading above the form (e.g. "Register" / "Sign Up"). */
  heading?: string;
  submitLabel?: string;
  /** Label override for the practice/company field (registration variant). */
  companyLabel?: string;
}

function isFormVariant(value: unknown): value is FormVariant {
  return value === 'registration' || value === 'newsletter' || value === 'lead';
}

export function parseFormProps(props: Record<string, unknown>): FormProps {
  const variant = isFormVariant(props.variant) ? props.variant : 'registration';
  if (
    process.env.NODE_ENV !== 'production' &&
    props.variant !== undefined &&
    !isFormVariant(props.variant)
  ) {
    console.warn(
      `[blocks] form variant "${String(props.variant)}" unknown ` +
        `(registration | newsletter | lead) — defaulting to "registration".`,
    );
  }
  const out: FormProps = { variant };
  const source = str(props.source);
  if (source) out.source = source;
  const heading = str(props.heading);
  if (heading) out.heading = heading;
  const submitLabel = str(props.submitLabel ?? props.submit_label);
  if (submitLabel) out.submitLabel = submitLabel;
  const companyLabel = str(props.companyLabel ?? props.company_label);
  if (companyLabel) out.companyLabel = companyLabel;
  return out;
}

// ─── cta ─────────────────────────────────────────────────────────────

/** Heading + body + one or more link buttons. Buttons render with their
 *  native BDS variant (default `primary`) — accessible by construction. */
export interface CtaButton {
  label: string;
  href: string;
  variant?: ButtonVariant;
}

export interface CtaProps {
  heading?: string;
  body?: string;
  buttons: CtaButton[];
}

// Marketing-CTA-appropriate variants only — the semantic/danger variants
// (`destructive`/`danger`/`positive`) don't belong on a landing-page CTA.
const CTA_BUTTON_VARIANTS = new Set<ButtonVariant>([
  'primary',
  'secondary',
  'outline',
  'ghost',
  'inverse',
  'on-color',
]);

function parseCtaButtonVariant(value: unknown): ButtonVariant | undefined {
  return typeof value === 'string' && CTA_BUTTON_VARIANTS.has(value as ButtonVariant)
    ? (value as ButtonVariant)
    : undefined;
}

export function parseCtaProps(props: Record<string, unknown>): CtaProps {
  const out: CtaProps = { buttons: [] };
  const heading = str(props.heading);
  if (heading) out.heading = heading;
  const body = str(props.body);
  if (body) out.body = body;
  if (Array.isArray(props.buttons)) {
    for (const item of props.buttons) {
      if (!item || typeof item !== 'object') continue;
      const label = str((item as { label?: unknown }).label);
      const href = str((item as { href?: unknown }).href);
      if (!label || !href) continue;
      const variant = parseCtaButtonVariant((item as { variant?: unknown }).variant);
      out.buttons.push(variant ? { label, href, variant } : { label, href });
    }
  }
  return out;
}
