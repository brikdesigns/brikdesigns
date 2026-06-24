'use client';

import { Suspense, useState, type ComponentProps } from 'react';
import { HeroSplitImageCardOverlay, Modal, type ServiceLine } from '@brikdesigns/bds';
import { LeadCaptureForm } from '@/components/marketing/LeadCaptureForm';
import { LeadModalLayout } from '@/components/marketing/LeadModalLayout';

type HeroProps = ComponentProps<typeof HeroSplitImageCardOverlay>;

/**
 * Plan-page hero whose price-card "Get Started" CTA opens the lead-capture
 * modal instead of navigating to /get-started — the same modal the lower
 * cta-panel button (GetStartedModalButton) opens, so both above- and
 * below-fold CTAs behave identically (#401).
 *
 * Uses the blueprint's `onPriceCtaClick` affordance (brik-bds#843, shipped in
 * @brikdesigns/bds@0.101.0). The CTA's `url` (`/get-started?plan=…`) stays the
 * rendered href, so it remains a working no-JS / SEO fallback and direct-link
 * target (progressive enhancement). This client wrapper holds the modal state;
 * the surrounding tint/scroll chrome stays in the server component.
 */
export function PlanHeroModal({
  section,
  clientFacts,
  theme,
  plan,
  planName,
  serviceLine,
}: {
  section: HeroProps['section'];
  clientFacts: HeroProps['clientFacts'];
  theme: HeroProps['theme'];
  plan: string;
  planName?: string;
  /** Plan's parent service-line driving the lead-form summary card's ServiceTag (#600). */
  serviceLine?: ServiceLine;
}) {
  const [isOpen, setIsOpen] = useState(false);

  // Plans have no offering/image — the panel shows the service-line glyph plus
  // the "Selected plan" label/value. The panel carries that context, so the
  // in-form callout is suppressed (`hideOfferingSummary`).
  const showPanel = Boolean(serviceLine && plan);

  const form = (
    <LeadCaptureForm
      source="get_started"
      plan={plan}
      planName={planName}
      serviceLine={serviceLine}
      hideOfferingSummary={showPanel}
    />
  );

  return (
    <>
      <HeroSplitImageCardOverlay
        section={section}
        clientFacts={clientFacts}
        theme={theme}
        showServiceTag={false}
        onPriceCtaClick={() => setIsOpen(true)}
      />
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
              label="Selected plan"
              value={
                planName ||
                plan.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
              }
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
