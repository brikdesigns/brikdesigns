import type { Metadata } from 'next';
import { Button, Card, CardTitle, CardDescription, Cluster, Grid, SectionHeader } from '@brikdesigns/bds';
import { PROCESS_STEPS, PRACTICE_CARDS } from '@/lib/how-it-works';
import { HOME_INDUSTRIES } from '@/lib/home-industries';
import { HomeIndustriesTabs } from '@/components/homepage/HomeIndustriesTabs';
import { getManagedPlanPrices, getIndustryPages } from '@/lib/supabase/queries';
import { CheckIcon } from '@/components/how-it-works/CheckIcon';
import { ProcessFoundationTiers } from '@/components/how-it-works/ProcessFoundationTiers';
import '../shared-sections.css';
import './how-it-works.css';

export const revalidate = 3600;

export const metadata: Metadata = {
  alternates: { canonical: '/how-it-works' },
  title: 'How It Works | Brik Designs',
  description:
    'How Brik takes marketing and back-office operations off your plate — so leads get followed up, your team has a process, and you can focus on the work.',
};

const BRIKDOWN_HREF = '/offers/brikdown-analysis';

// Step-3 mode icons — inline SVG (self-contained, no Iconify subset dependency,
// same reasoning as CheckIcon). Advisory = chat, Managed = gear.
function ChatIcon() {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" aria-hidden="true" focusable="false">
      <path
        d="M4 5.5h16a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H9l-4 3.5V16.5H4a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function GearIcon() {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" aria-hidden="true" focusable="false">
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.2 5.2l2.1 2.1M16.7 16.7l2.1 2.1M18.8 5.2l-2.1 2.1M7.3 16.7l-2.1 2.1"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default async function HowItWorksPage() {
  // Managed monthly price per plan slug — the Step-2 segmented control shows
  // each service line's Managed price (DB is the pricing SoT, #1123).
  const [plans, industryPages] = await Promise.all([
    getManagedPlanPrices(),
    getIndustryPages(),
  ]);
  const managedPriceBySlug = new Map(
    plans.map((plan) => [
      plan.slug,
      plan.service_plan_tiers.find((tier) => tier.name === 'Managed')?.monthly_price_display ?? null,
    ]),
  );

  // Industries section: the same MediaTabs the home uses (HomeIndustriesTabs) —
  // curated HOME_INDUSTRIES blurbs joined to each industry_pages row's
  // illustration by slug (DB is SoT for imagery). Any industry without an image
  // is dropped rather than rendering an empty panel — mirrors the home build.
  const industryBySlug = new Map(
    (industryPages as { slug: string; name: string; image_url: string | null }[]).map(
      (row) => [row.slug, row],
    ),
  );
  const industriesTabs = HOME_INDUSTRIES.map((industry) => {
    const row = industryBySlug.get(industry.slug);
    if (!row?.image_url) return null;
    return {
      id: industry.slug,
      label: industry.label,
      description: industry.description,
      imageUrl: row.image_url,
      alt: `${row.name} illustration`,
    };
  }).filter((tab): tab is NonNullable<typeof tab> => tab !== null);

  return (
    <>
      {/* ═══ Hero ═══ */}
      {/* Figma node 25790:14435 — full-bleed blue band (surface/accent-blue),
          headline + lead. The frame renders white ink with orange emphasis words;
          white on #8ebbcc is ~1.9:1 (AA fail). Per operator decision on #1127 we
          keep the band and darken the ink instead of the band: base ink stays the
          mode-invariant dark primitive, and the Figma orange emphasis is restored
          with poppy-800 (#7d1d09, 4.94:1 on the band — the deepest brand orange
          that clears AA-body in both themes). */}
      <section className="hiw-hero" data-section="hero">
        <div className="hiw-hero__container">
          <div className="hiw-hero__text">
            <h1 className="hiw-hero__title">
              No <span className="hiw-hero__em">surprises</span>. Here&rsquo;s exactly how it{' '}
              <span className="hiw-hero__em">works</span>.
            </h1>
            <p className="hiw-hero__description">
              Every client starts with a free BrikDown Analysis — no obligation to go
              further until you&rsquo;re ready. From there, everything moves at your pace.
            </p>
          </div>
        </div>
      </section>

      {/* ═══ Process ("Three steps. One team. Total clarity.") ═══ */}
      {/* Figma node 25880:4743 — a vertical timeline of three NEW split cards
          (app-local, outside BDS per #1121). Left pane is shared (step label +
          title + prose + CTA); the right pane differs per step (#1123):
            • checklist  — a 2×2 checklist (Step 1)
            • tiers      — a SegmentedControl over the service-line plans, each
                           showing its Managed monthly price + bullets (Step 2)
            • engagement — two stacked mode sub-cards, Advisory / Managed (Step 3)
          The central spine (::before) connects the cards through the gaps and,
          inside each card, reads as the divider between the panes. */}
      <section className="hiw-process" data-section="process">
        <div className="hiw-container">
          <SectionHeader title="Three steps. One team. Total clarity." />
          <ol className="hiw-timeline">
            {PROCESS_STEPS.map((step) => (
              <li key={step.id} className="hiw-step">
                <article className="hiw-card" data-kind={step.kind}>
                  <div className="hiw-card__content">
                    <p className="hiw-card__step">{step.step}</p>
                    <h3 className="hiw-card__title">{step.title}</h3>
                    <div className="hiw-card__prose">
                      {step.paragraphs.map((paragraph, i) => (
                        <p key={i} className="hiw-card__paragraph">
                          {paragraph}
                        </p>
                      ))}
                    </div>
                    <Button href={step.cta.href} variant="primary" size="lg">
                      {step.cta.label}
                    </Button>
                  </div>

                  <div className="hiw-card__pane">
                    {step.kind === 'checklist' && (
                      <div className="hiw-card__checklist">
                        {step.checklist.map((item) => (
                          <div key={item.title} className="hiw-check">
                            <span className="hiw-check__icon" aria-hidden="true">
                              <CheckIcon />
                            </span>
                            <div className="hiw-check__text">
                              <p className="hiw-check__title">{item.title}</p>
                              <p className="hiw-check__description">{item.description}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {step.kind === 'tiers' && (
                      <ProcessFoundationTiers
                        segments={step.segments.map((segment) => ({
                          id: segment.id,
                          label: segment.label,
                          price: managedPriceBySlug.get(segment.planSlug) ?? null,
                          bullets: segment.bullets,
                        }))}
                      />
                    )}

                    {step.kind === 'engagement' && (
                      <div className="hiw-modes">
                        {step.modes.map((mode) => (
                          <div key={mode.id} className="hiw-mode">
                            <span className="hiw-mode__icon" aria-hidden="true">
                              {mode.id === 'advisory' ? <ChatIcon /> : <GearIcon />}
                            </span>
                            <h4 className="hiw-mode__title">{mode.title}</h4>
                            <p className="hiw-mode__description">{mode.description}</p>
                            <p className="hiw-mode__best-for">{mode.bestFor}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </article>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ═══ Practice ("What It Looks Like In Practice") ═══ */}
      {/* Figma node 25790:14529 — purple accent band; header row (title + CTA)
          over two example Cards. Card chrome is band-derived — .hiw-practice is
          registered on the "Card chrome by band" rule in shared-sections.css so
          the cards drop their border for a containment shadow on the tint. */}
      <section className="hiw-practice" data-section="practice">
        <div className="hiw-container">
          <div className="hiw-practice__header">
            <div className="hiw-practice__heading">
              <h2 className="hiw-section-title">What It Looks Like In Practice</h2>
            </div>
            <Button href="/customer-stories" variant="primary" size="lg">
              See all results
            </Button>
          </div>
          <Grid columns={2} gap="lg">
            {PRACTICE_CARDS.map((card) => (
              // A card deep-links to its customer story when one exists (#1128);
              // Renew Dental has no story yet, so it renders display-only.
              <Card
                key={card.id}
                padding="lg"
                {...(card.href ? { interactive: true, href: card.href } : {})}
              >
                <CardTitle>{card.title}</CardTitle>
                <CardDescription>{card.description}</CardDescription>
              </Card>
            ))}
          </Grid>
        </div>
      </section>

      {/* ═══ Industries ("Where we do our best work.") ═══ */}
      {/* Figma node 25887:4854 — yellow accent band. Uses the same tabbed
          container as the home Industries section (HomeIndustriesTabs →
          MediaTabs): one tab per industry, each revealing its blurb and a synced
          illustration panel. Labels + blurbs are the curated HOME_INDUSTRIES
          copy (shared SoT); illustrations come from industry_pages.image_url.
          On-band text is pinned dark in how-it-works.css (fixed-light yellow
          tint, same as home). */}
      {industriesTabs.length > 0 && (
        <section className="hiw-industries" data-section="industries">
          <div className="hiw-container">
            <SectionHeader
              align="start"
              title="Where we do our best work."
              description="We work most closely with dental practices, property management and real estate firms, and small businesses."
            />
            <HomeIndustriesTabs tabs={industriesTabs} />
          </div>
        </section>
      )}

      {/* ═══ CTA ("Let's build something.") ═══ */}
      {/* Figma node 25886:4799 — Brik-orange panel. Reuses the shared brand CTA
          card (.cta-section-brand / .cta-card-brand, shared-sections.css). */}
      <section className="cta-section-brand hiw-cta" data-section="cta">
        <div className="cta-card-brand">
          <div className="cta-card-brand__content">
            <h2 className="hiw-cta__title">Ready to see what fits?</h2>
            <p className="hiw-cta__description">
              You work directly with Abbey and Nick throughout — from the BrikDown to Foundation
              to ongoing. We keep our client list focused so every engagement gets our full attention.
            </p>
          </div>
          <Cluster gap="md" justify="center">
            <Button href={BRIKDOWN_HREF} variant="on-color" size="lg">
              Get your free BrikDown
            </Button>
            <Button
              href="/plans"
              variant="outline"
              size="lg"
              className="hiw-cta__btn-outline"
            >
              See all plans
            </Button>
          </Cluster>
        </div>
      </section>
    </>
  );
}
