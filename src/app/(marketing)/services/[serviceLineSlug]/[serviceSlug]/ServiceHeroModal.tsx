'use client';

import { Suspense, useState, type ComponentProps } from 'react';
import { HeroSplitImageCardOverlay, Modal } from '@brikdesigns/bds';
import { LeadCaptureForm } from '@/components/marketing/LeadCaptureForm';
import type { ServiceOption } from '@/components/marketing/ServiceMultiSelect';

type HeroProps = ComponentProps<typeof HeroSplitImageCardOverlay>;

/**
 * Service-detail hero whose price-card "Let's Talk" CTA opens the lead-capture
 * modal instead of navigating to /contact — the same modal the pricing-grid
 * "Get Started" CTAs open, so the single-tier hero CTA and the multi-tier grid
 * CTAs behave identically. Service + offering are preselected to match the
 * grid CTAs (#577/#592/#595).
 *
 * Uses the blueprint's `onPriceCtaClick` affordance (brik-bds#843, shipped in
 * @brikdesigns/bds@0.103.0 for the priceCard CTA). The CTA's `url` (`/contact`)
 * stays the rendered href, so it remains a working no-JS / SEO fallback
 * (progressive enhancement). Mirrors PlanHeroModal — this client wrapper holds
 * the modal state; the surrounding tint/scroll chrome stays in the server page.
 */
export function ServiceHeroModal({
  section,
  clientFacts,
  theme,
  service,
  serviceOptions = [],
  offering,
}: {
  section: HeroProps['section'];
  clientFacts: HeroProps['clientFacts'];
  theme: HeroProps['theme'];
  /** Service slug to preselect in the modal's service picker. */
  service: string;
  /** Options for the multi-select; passed through from the server page. */
  serviceOptions?: ServiceOption[];
  /**
   * The offering this hero represents (single-tier services only) — carried
   * into the lead record, consistent with the pricing-grid CTAs (#592).
   */
  offering?: { name: string; price?: string };
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <HeroSplitImageCardOverlay
        section={section}
        clientFacts={clientFacts}
        theme={theme}
        onPriceCtaClick={() => setIsOpen(true)}
      />
      <Modal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title="Get Started"
        size="md"
      >
        <Suspense>
          <LeadCaptureForm
            source="get_started"
            serviceOptions={serviceOptions}
            defaultServices={service ? [service] : undefined}
            offering={offering}
          />
        </Suspense>
      </Modal>
    </>
  );
}
