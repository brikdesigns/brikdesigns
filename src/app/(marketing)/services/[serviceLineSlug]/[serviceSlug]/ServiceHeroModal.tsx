'use client';

import { Suspense, useState, type ComponentProps } from 'react';
import { HeroSplitImageCardOverlay, Modal, type ServiceLine } from '@brikdesigns/bds';
import { LeadCaptureForm } from '@/components/marketing/LeadCaptureForm';
import { LeadModalLayout } from '@/components/marketing/LeadModalLayout';
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
  serviceLine,
  serviceName,
  imageUrl,
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
  offering?: { name: string; price?: string; frequency?: string };
  /** Parent service-line driving the lead-form summary card's ServiceTag (#600). */
  serviceLine?: ServiceLine;
  /** Parent service name resolving the ServiceTag glyph. */
  serviceName?: string;
  /** Service image for the 2-col modal's showcase panel (the hero priceCard image). */
  imageUrl?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);

  // The hero represents a single offering; show the 2-col showcase panel when
  // we have that context. The panel carries it, so the in-form callout is
  // suppressed (`hideOfferingSummary`).
  const showPanel = Boolean(serviceLine && offering?.name);

  const form = (
    <LeadCaptureForm
      source="get_started"
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
        size={showPanel ? 'xl' : 'md'}
      >
        <Suspense>
          {showPanel && serviceLine && offering ? (
            <LeadModalLayout
              serviceLine={serviceLine}
              imageUrl={imageUrl}
              imageAlt={offering.name}
              label="Interested in"
              value={offering.name}
              price={offering.price}
              frequency={offering.frequency}
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
