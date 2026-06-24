'use client';

import { Suspense, useState, type ComponentProps } from 'react';
import { HeroSplitImageCardOverlay, Modal, type ServiceLine } from '@brikdesigns/bds';
import { LeadCaptureForm } from '@/components/marketing/LeadCaptureForm';

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
        size="md"
      >
        <Suspense>
          <LeadCaptureForm source="get_started" plan={plan} planName={planName} serviceLine={serviceLine} />
        </Suspense>
      </Modal>
    </>
  );
}
