'use client';

import { Suspense, useState } from 'react';
import { Button, Modal } from '@brikdesigns/bds';
import { LeadCaptureForm } from '@/components/marketing/LeadCaptureForm';

/**
 * Get-started CTA that opens the lead form in a BDS Modal instead of
 * navigating to /get-started. The standalone route stays live as a
 * fallback / direct-link target. #401.
 *
 * The plan slug is passed in (the modal has no `?plan=` query string to read,
 * unlike the standalone page) and forwarded to the form for the preselect.
 */
export function GetStartedModalButton({
  plan,
  planName,
}: {
  plan: string;
  planName?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Button variant="primary" size="lg" onClick={() => setIsOpen(true)}>
        Get Started
      </Button>
      <Modal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title="Get Started"
        size="md"
      >
        <Suspense>
          <LeadCaptureForm source="get_started" plan={plan} planName={planName} />
        </Suspense>
      </Modal>
    </>
  );
}
