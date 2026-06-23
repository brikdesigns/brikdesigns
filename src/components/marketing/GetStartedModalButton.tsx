'use client';

import { Suspense, useState } from 'react';
import { Button, Modal } from '@brikdesigns/bds';
import { LeadCaptureForm } from '@/components/marketing/LeadCaptureForm';
import type { ServiceOption } from '@/components/marketing/ServiceMultiSelect';

/**
 * Get-started CTA that opens the lead form in a BDS Modal instead of
 * navigating to /get-started. Used by support-plan pages (plan preselect) and
 * service-detail pages (service preselect + the service multi-select). The
 * standalone /get-started route stays live as a fallback. #401, #577.
 */
export function GetStartedModalButton({
  plan,
  planName,
  service,
  serviceOptions = [],
  offering,
  label = 'Get Started',
  variant = 'primary',
  size = 'lg',
}: {
  plan?: string;
  planName?: string;
  /** Service slug to preselect in the picker (service-detail pages). */
  service?: string;
  /** Options for the multi-select; passed through from the server page. */
  serviceOptions?: ServiceOption[];
  /**
   * The pricing tier this CTA renders for (service-detail pricing grid).
   * Already-resolved display data — name + formatted price — passed straight
   * through to the lead record so we know which offering the lead clicked.
   * Offerings are nested under services and aren't globally addressable by
   * slug, so we carry the resolved values rather than re-querying (#592).
   */
  offering?: { name: string; price?: string };
  label?: string;
  variant?: 'primary' | 'secondary';
  size?: 'sm' | 'md' | 'lg';
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Button variant={variant} size={size} onClick={() => setIsOpen(true)}>
        {label}
      </Button>
      <Modal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title="Get Started"
        size="md"
      >
        <Suspense>
          <LeadCaptureForm
            source="get_started"
            plan={plan}
            planName={planName}
            serviceOptions={serviceOptions}
            defaultServices={service ? [service] : undefined}
            offering={offering}
          />
        </Suspense>
      </Modal>
    </>
  );
}
