import type { Metadata } from 'next';
import { Suspense } from 'react';
import { LeadCaptureForm } from '@/components/marketing/LeadCaptureForm';
import type { ServiceOption } from '@/components/marketing/ServiceMultiSelect';
import {
  getSupportPlans,
  getServiceCategories,
  getServices,
  resolveServiceTagCategory,
} from '@/lib/supabase/queries';
import '../shared-sections.css';

export const metadata: Metadata = {
  title: 'Get Started | Tell Us About Your Project',
  description: 'Start your project with Brik Designs. Tell us about your business, your goals, and what you need — and we\'ll take it from there.',
};

type Props = { searchParams: Promise<{ plan?: string }> };

export default async function GetStartedPage({ searchParams }: Props) {
  // Resolve the real plan name from its slug at this single chokepoint so the
  // form's "Selected plan" chip never has to humanize the slug — humanizing
  // drops words when the display name diverges from the slug (e.g.
  // `product-support` → "Product Design Support", not "Product Support"). #400.
  const { plan: planSlug } = await searchParams;
  let planName = '';
  if (planSlug) {
    const plans = await getSupportPlans();
    planName = plans.find((p) => p.slug === planSlug)?.name ?? '';
  }

  // Build the service-picker options, clustered by service line (line rank,
  // then service rank) so the flat MultiSelect groups lines together. Each
  // option carries its BDS ServiceLine so the selected chip is line-colored.
  const [serviceLines, services] = await Promise.all([
    getServiceCategories(),
    getServices(),
  ]);
  const lineRank = new Map<string, number>(
    serviceLines.map((line) => [line.id, line.rank ?? 0]),
  );
  const serviceOptions: ServiceOption[] = [...services]
    .sort(
      (a, b) =>
        (lineRank.get(a.service_line_id) ?? 99) -
          (lineRank.get(b.service_line_id) ?? 99) ||
        (a.rank ?? 0) - (b.rank ?? 0),
    )
    .map((service) => ({
      value: service.slug,
      label: service.name,
      category: resolveServiceTagCategory({
        slug: service.service_lines?.slug ?? service.slug,
      }),
    }));

  return (
    <>
      <section className="page-hero">
        <div className="page-hero__container">
          <h1 className="page-hero__title">Get Started</h1>
          <p className="page-hero__description">
            Tell us about your business and what you&apos;re looking for.
            We&apos;ll be in touch within 1 business day.
          </p>
        </div>
      </section>

      <section className="page-section">
        <div className="container-lg" style={{ maxWidth: 600, alignItems: 'flex-start' }}>
          <Suspense>
            <LeadCaptureForm
              source="get_started"
              planName={planName}
              serviceOptions={serviceOptions}
            />
          </Suspense>
        </div>
      </section>
    </>
  );
}
