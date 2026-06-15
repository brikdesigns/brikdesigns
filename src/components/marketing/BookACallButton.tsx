'use client';

import { useState } from 'react';
import Script from 'next/script';
import { Button, Modal } from '@brikdesigns/bds';

/**
 * "Book a Call" CTA that opens the LeadConnector (GoHighLevel) booking widget
 * in a BDS Modal instead of navigating away. Mirrors the GetStartedModalButton
 * pattern (#401). Replaces the dead calendly.com/brikdesigns link (#242 / #483).
 *
 * The owner supplied LeadConnector's *inline* iframe embed, so the popup is
 * built our side: the inline iframe lives in the modal body and
 * `form_embed.js` (loaded on open) handles the postMessage auto-resize. The
 * wrapper keeps a min-height floor because the iframe's own `height: 100%`
 * collapses without a sized parent.
 */
const BOOKING_ID = 'twul5TyLT353Jw6dcriU';

export function BookACallButton() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Button variant="secondary" size="md" onClick={() => setIsOpen(true)}>
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
                scrolls. */}
            <div
              tabIndex={0}
              role="group"
              aria-label="Booking calendar"
              style={{ height: 'min(70vh, 640px)', overflowY: 'auto' }}
            >
              <iframe
                src={`https://api.leadconnectorhq.com/widget/booking/${BOOKING_ID}`}
                title="Book a call with Brik Designs"
                style={{ width: '100%', minHeight: '100%', border: 'none' }}
                id={`${BOOKING_ID}_booking`}
              />
            </div>
            <Script src="https://link.msgsndr.com/js/form_embed.js" strategy="lazyOnload" />
          </>
        )}
      </Modal>
    </>
  );
}
