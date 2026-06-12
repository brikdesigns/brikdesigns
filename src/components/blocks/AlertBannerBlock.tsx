import { Banner } from '@brikdesigns/bds';
import { toBannerTone, type AlertBannerData } from '@/lib/blocks';

/**
 * alert-banner — contextual notice. Used both as an authored block and as the
 * page-level `events.alert_banner` field (same `{ message, tone }` shape).
 * Maps to the BDS `Banner` (tone → BDS banner appearance via `toBannerTone`).
 *
 * NOTE: the status-driven "event has ended" notice stays a separate,
 * status='ended' → EventEndedBanner special case (catalogue) — it is NOT
 * authored through this field.
 */
export function AlertBannerBlock({ message, tone }: AlertBannerData) {
  if (!message?.trim()) return null;
  return <Banner tone={toBannerTone(tone)} title={message} />;
}
