import { color, space, border } from '@/lib/tokens';
import { text } from '@/lib/styles';

/**
 * Shown in place of the registration form when an event's status is 'ended'
 * (brikdesigns#335 / #336). The page stays live on its public URL — the portal
 * flips status active → ended and revalidates — so the banner communicates the
 * closed state rather than 404-ing.
 */
export function EventEndedBanner() {
  return (
    <div
      role="status"
      style={{
        backgroundColor: color.surface.warning,
        padding: space.lg,
        borderRadius: border.radius.md,
        textAlign: 'center',
      }}
    >
      <p style={{ ...text.body, color: color.text.warning, margin: 0 }}>
        <strong>This event has ended.</strong> Registration is now closed.
      </p>
    </div>
  );
}
