'use client';

import { useState } from 'react';
import Script from 'next/script';
import { Button, Modal, Spinner } from '@brikdesigns/bds';
import { color, gap } from '@/lib/tokens';
import { text } from '@/lib/styles';

/**
 * "Book a Call" CTA that opens the LeadConnector (GoHighLevel) booking widget
 * in a BDS Modal instead of navigating away. Mirrors the GetStartedModalButton
 * pattern (#401). Replaces the dead calendly.com/brikdesigns link (#242 / #483).
 *
 * The owner supplied LeadConnector's *inline* iframe embed, so the popup is
 * built our side: the inline iframe lives in the modal body and
 * `form_embed.js` (loaded on open) handles the postMessage auto-resize.
 *
 * The widget is slow to load over the network, so the modal would otherwise
 * sit empty for a few seconds. Open the modal instantly with a branded spinner
 * overlaying the iframe region; reveal the widget the moment its `load` event
 * fires (#484 follow-up). The iframe stays mounted underneath the overlay so it
 * loads in place — no remount/reload. `loaded` resets on each open.
 */
const BOOKING_ID = 'twul5TyLT353Jw6dcriU';

export function BookACallButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const open = () => {
    setLoaded(false);
    setIsOpen(true);
  };

  return (
    <>
      <Button variant="secondary" size="md" onClick={open}>
        Book a Call
      </Button>
      <Modal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title="Book a Call"
        size="xl"
      >
        {isOpen && (
          <>
            {/* form_embed.js auto-resizes the iframe to its full content
                height, which would make the BDS modal body the scroll region
                with no keyboard-focusable child (axe scrollable-region-
                focusable). Own the scroll here instead: a bounded, focusable
                region that stays within the modal body so the body never
                scrolls. `position: relative` anchors the loading overlay. */}
            <div
              tabIndex={0}
              role="group"
              aria-label="Booking calendar"
              aria-busy={!loaded}
              style={{ position: 'relative', height: 'min(70vh, 640px)', overflowY: 'auto' }}
            >
              <iframe
                src={`https://api.leadconnectorhq.com/widget/booking/${BOOKING_ID}`}
                title="Book a Call With Brik Designs"
                style={{ width: '100%', minHeight: '100%', border: 'none' }}
                id={`${BOOKING_ID}_booking`}
                onLoad={() => setLoaded(true)}
              />
              {!loaded && (
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: gap.md,
                    backgroundColor: color.surface.primary,
                  }}
                >
                  {/* Spinner already renders role="status"; give it a descriptive
                      label and keep the visible copy decorative so SRs announce once. */}
                  <Spinner size="lg" aria-label="Loading the booking calendar" />
                  <span aria-hidden="true" style={{ ...text.bodySm, color: color.text.secondary }}>
                    Loading the booking calendar…
                  </span>
                </div>
              )}
            </div>
            <Script src="https://link.msgsndr.com/js/form_embed.js" strategy="lazyOnload" />
          </>
        )}
      </Modal>
    </>
  );
}
