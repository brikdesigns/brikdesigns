import { Suspense } from 'react';
import type { FormProps, BlockContext } from '@/lib/blocks';
import { EventRegistrationForm } from '@/components/marketing/EventRegistrationForm';
import { LeadCaptureForm } from '@/components/marketing/LeadCaptureForm';
import { EventEndedBanner } from '@/components/marketing/EventStatusBanner';
import { EventCheckoutReturn } from '@/components/marketing/EventCheckoutReturn';
import { heading } from '@/lib/styles';
import { gap } from '@/lib/tokens';

/**
 * form block — lead capture in the accent form-card. Dispatches to the existing
 * form components per the catalogue Form-variants table:
 *   registration / newsletter → EventRegistrationForm (posts against `rowId`)
 *   lead                      → LeadCaptureForm
 * The accent is decorative (card top border) — never the submit button fill;
 * each form keeps its accessible BDS Button variant (#429). When the row has
 * ended, the form is replaced by the status-driven ended banner.
 */
export function FormBlock({
  variant,
  source,
  heading: formHeading,
  submitLabel,
  companyLabel,
  rowId,
  ended,
  customFields,
  columns,
  fee,
}: FormProps & {
  rowId: BlockContext['rowId'];
  accent: BlockContext['accent'];
  ended: BlockContext['ended'];
  customFields: BlockContext['customFields'];
  columns?: BlockContext['formColumns'];
  fee?: BlockContext['fee'];
}) {
  const form =
    variant === 'lead' ? (
      // LeadCaptureForm reads useSearchParams (?plan=) — Suspense-wrapped so it
      // doesn't opt the SSG landing route out of prerendering (mirrors the
      // legacy free-marketing-analysis page).
      <Suspense fallback={null}>
        <LeadCaptureForm source={source ?? 'marketing_analysis'} />
      </Suspense>
    ) : variant === 'newsletter' ? (
      <EventRegistrationForm
        eventId={rowId}
        variant="newsletter"
        source={source ?? 'newsletter_signup'}
        submitLabel={submitLabel ?? 'Subscribe'}
        customFields={customFields}
        columns={columns}
      />
    ) : (
      <EventRegistrationForm
        eventId={rowId}
        variant="event"
        source={source ?? 'event_signup'}
        submitLabel={submitLabel}
        companyLabel={companyLabel}
        customFields={customFields}
        columns={columns}
        fee={fee}
      />
    );

  return (
    <div className="lp-form-card">
      {ended ? (
        <EventEndedBanner />
      ) : (
        <>
          {/* Stripe return state (#899) — mirrors the non-block event page.
              Only the registration arm can produce it, but rendering it here
              covers every block layout at once, and it is a no-op without the
              query param. Suspense for the same prerender reason as the lead
              form above. */}
          {variant !== 'lead' && (
            <Suspense fallback={null}>
              <EventCheckoutReturn />
            </Suspense>
          )}
          {formHeading && <h2 style={{ ...heading.sm, marginBottom: gap.md }}>{formHeading}</h2>}
          {form}
        </>
      )}
    </div>
  );
}
