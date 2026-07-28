'use client';

import { Suspense, useState } from 'react';
import {
  Hero,
  Modal,
  ServiceTag,
  Frame,
  Button,
  type ServiceLine,
  type BlueprintSection,
} from '@brikdesigns/bds';
import { LeadCaptureForm } from '@/components/marketing/LeadCaptureForm';
import { LeadModalLayout } from '@/components/marketing/LeadModalLayout';
import type { ServiceOption } from '@/components/marketing/ServiceMultiSelect';
import {
  BreadcrumbSwitcher,
  type BreadcrumbSwitchOption,
} from '@/components/marketing/BreadcrumbSwitcher';

/**
 * Service-detail hero whose price-card "Let's Talk" CTA opens the lead-capture
 * modal instead of navigating to /contact — the same modal the pricing-grid
 * "Get Started" CTAs open, so the single-tier hero CTA and the multi-tier grid
 * CTAs behave identically. Service + offering are preselected to match the
 * grid CTAs (#577/#592/#595).
 *
 * Composes `<Hero layout="with-pricing-card">` directly rather than the
 * `HeroSplitImageCardOverlay` adapter (`@deprecated` as of BDS 0.136 — new
 * consumers compose `<Hero>`). Going direct lets us pass a `<BreadcrumbSwitcher>`
 * into the hero's `breadcrumb` slot so the current-service crumb gains a caret
 * that jumps between sibling services (#740, BRIK-WEB-59). The eyebrow + price
 * card below reproduce the adapter's mapping for the fields this page uses
 * (audience-driven `<ServiceTag>`, image/price card, lead-modal CTA).
 *
 * The price CTA's click is intercepted (`preventDefault` → open modal); its
 * `href` stays the rendered anchor, so it remains a working no-JS / SEO
 * fallback (progressive enhancement, per the adapter's prior brik-bds#843
 * behavior). Mirrors PlanHeroModal — this client wrapper holds the modal state;
 * the surrounding tint/scroll chrome stays in the server page.
 */
export function ServiceHeroModal({
  section,
  service,
  serviceOptions = [],
  offering,
  serviceLine,
  serviceName,
  imageUrl,
  description,
  switchOptions,
}: {
  section: BlueprintSection;
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
  /** Offering description from the CMS, shown in the showcase panel (#653). */
  description?: string;
  /** Sibling services in this line for the breadcrumb switcher, incl. current (#740). */
  switchOptions: BreadcrumbSwitchOption[];
}) {
  const [isOpen, setIsOpen] = useState(false);

  // The hero represents a single offering; show the 2-col showcase panel when
  // we have that context. The panel carries it, so the in-form callout is
  // suppressed (`hideOfferingSummary`).
  const showPanel = Boolean(serviceLine && offering?.name);

  // `serviceLine` is the canonical BDS field; `audience` is the deprecated
  // alias (#788). This page sets `audience`.
  const resolvedServiceLine = section.serviceLine ?? section.audience;

  // Eyebrow icon — raw `iconUrl` escape hatch, else the canonical
  // audience-driven `<ServiceTag variant="icon">` (the design-system path).
  const eyebrowNode = section.iconUrl ? (
    <img
      src={section.iconUrl}
      alt={section.iconAlt ?? ''}
      className="bds-hero__icon"
      loading="eager"
      decoding="async"
    />
  ) : resolvedServiceLine ? (
    <ServiceTag
      category={resolvedServiceLine}
      variant="icon"
      size="lg"
      className="bds-hero__icon"
    />
  ) : undefined;

  const priceCard = section.priceCard;
  const media = priceCard ? (
    <aside className="bds-hero__media-card">
      <Frame ratio="square" className="bds-hero__image-frame">
        <img
          src={priceCard.imageUrl}
          alt={priceCard.imageAlt ?? ''}
          loading="eager"
          decoding="async"
          className="bds-hero__image"
        />
      </Frame>
      {(priceCard.priceLabel || priceCard.price || priceCard.cta) && (
        <div className="bds-hero__price">
          {priceCard.priceLabel && priceCard.price && (
            <p className="bds-hero__price-label">{priceCard.priceLabel}</p>
          )}
          {priceCard.price && <p className="bds-hero__price-value">{priceCard.price}</p>}
          {priceCard.cta &&
            ('url' in priceCard.cta ? (
              <Button
                href={priceCard.cta.url}
                variant="primary"
                size={priceCard.cta.size ?? 'sm'}
                // Progressive enhancement: with JS, suppress the anchor
                // navigation and open the lead modal; without JS the `href`
                // (/contact) still navigates.
                onClick={(event) => {
                  event.preventDefault();
                  setIsOpen(true);
                }}
              >
                {priceCard.cta.label}
              </Button>
            ) : (
              <Button
                onClick={priceCard.cta.onClick}
                variant="primary"
                size={priceCard.cta.size ?? 'sm'}
              >
                {priceCard.cta.label}
              </Button>
            ))}
        </div>
      )}
    </aside>
  ) : (
    <Frame
      ratio="square"
      as="aside"
      className="bds-blueprint-section__missing bds-hero__missing"
      data-content-needed="hero_image_url"
      role="presentation"
    >
      <p className="bds-blueprint-section__missing-label">
        Hero image card missing for this page.
      </p>
    </Frame>
  );

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
      <Hero
        layout="with-pricing-card"
        sectionKey={section.sectionKey}
        title={section.heading ?? ''}
        subtitle={section.subheading ?? undefined}
        lead={section.body ?? undefined}
        cta={section.cta ?? undefined}
        ctaVariant="inverse"
        breadcrumb={
          <BreadcrumbSwitcher
            items={section.breadcrumb ?? []}
            options={switchOptions}
            switchLabel="Switch service"
          />
        }
        eyebrow={eyebrowNode}
        media={media}
        data-service-line={resolvedServiceLine}
        data-audience={resolvedServiceLine}
        data-blueprint-key="hero_split_image_card_overlay"
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
              description={description}
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
