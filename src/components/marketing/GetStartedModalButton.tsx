'use client';

import { Suspense, useState } from 'react';
import { Button, Modal, type ServiceLine } from '@brikdesigns/bds';
import { LeadCaptureForm } from '@/components/marketing/LeadCaptureForm';
import { LeadModalLayout } from '@/components/marketing/LeadModalLayout';
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
  serviceLine,
  serviceName,
  imageUrl,
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
   * Already-resolved display data — name + formatted price + frequency —
   * passed straight through to the lead record so we know which offering the
   * lead clicked. Offerings are nested under services and aren't globally
   * addressable by slug, so we carry the resolved values rather than
   * re-querying (#592).
   */
  offering?: { name: string; price?: string; frequency?: string };
  /** Parent service-line driving the lead-form summary card's ServiceTag (#600). */
  serviceLine?: ServiceLine;
  /** Parent service name resolving the ServiceTag glyph (offering callouts). */
  serviceName?: string;
  /** Service image for the 2-col modal's showcase panel (offering CTAs). */
  imageUrl?: string;
  label?: string;
  variant?: 'primary' | 'secondary';
  size?: 'sm' | 'md' | 'lg';
}) {
  const [isOpen, setIsOpen] = useState(false);

  // Render the 2-col showcase layout only when there's offering/plan context to
  // put in the panel. Generic "Get Started" CTAs (no offering, no plan) keep the
  // single-column form. The panel carries the context, so the in-form callout is
  // suppressed (`hideOfferingSummary`) whenever the panel shows.
  const showPanel = Boolean(serviceLine && (offering?.name || plan));

  const form = (
    <LeadCaptureForm
      source="get_started"
      plan={plan}
      planName={planName}
      serviceOptions={serviceOptions}
      defaultServices={service ? [service] : undefined}
      offering={offering}
      serviceLine={serviceLine}
      serviceName={serviceName}
      hideOfferingSummary={showPanel}
    />
  );

  return (
    <>
      <Button variant={variant} size={size} onClick={() => setIsOpen(true)}>
        {label}
      </Button>
      <Modal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title="Get Started"
        size={showPanel ? 'xl' : 'md'}
      >
        <Suspense>
          {showPanel && serviceLine ? (
            <LeadModalLayout
              serviceLine={serviceLine}
              imageUrl={offering?.name ? imageUrl : undefined}
              imageAlt={offering?.name ?? planName ?? ''}
              label={offering?.name ? 'Interested in' : 'Selected plan'}
              value={
                offering?.name ||
                planName ||
                (plan ?? '').replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
              }
              price={offering?.price}
              frequency={offering?.frequency}
            >
              {form}
            </LeadModalLayout>
          ) : (
            form
          )}
        </Suspense>
      </Modal>
    </>
  );
}
