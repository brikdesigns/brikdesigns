import type { Metadata } from 'next';
import { Accordion, Button, Card, CardTitle, CardDescription, Cluster, Grid, SectionHeader } from '@brikdesigns/bds';
import { PROCESS_STEPS, PRACTICE_CARDS } from '@/lib/how-it-works';
import { HOME_INDUSTRIES } from '@/lib/home-industries';
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

// Inline check glyph for the process-card checklist. App-local (this whole card
// style lives outside BDS per #1121) and self-contained so it never waits on the
// Iconify offline subset — the BDS <Icon> falls through to a CDN fetch for a
// ph:* glyph not yet bundled, which would flash an empty box on first paint.
function CheckIcon() {
  return (
    <svg viewBox="0 0 20 20" width="20" height="20" fill="none" aria-hidden="true" focusable="false">
      <path
        d="M4.5 10.5l3.5 3.5 7.5-8"
        stroke="currentColor"
        strokeWidth="2.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function HowItWorksPage() {
  return (
    <>
      {/* ═══ Hero ═══ */}
      {/* Figma node 25790:14435 — full-bleed blue band (surface/accent-blue),
          headline + lead. The frame renders white ink on the blue; we ship dark
          ink instead, following the site's ratified accent-band AA treatment
          (shared-sections.css "Accent band on-color text") — white on #8ebbcc is
          ~1.9:1. The orange emphasis + white-text treatment is a copy/contrast
          decision deferred with the rest of the real copy (#1121). */}
      <section className="hiw-hero" data-section="hero">
        <div className="hiw-hero__container">
          <div className="hiw-hero__text">
            <h1 className="hiw-hero__title">
              No surprises. Here&rsquo;s exactly how it works.
            </h1>
            <p className="hiw-hero__description">
              Every client starts with a free BrikDown Analysis — no obligation to go
              further until you&rsquo;re ready. From there, everything moves at your pace.
            </p>
          </div>
        </div>
      </section>

      {/* ═══ Process ("Simple From Day One.") ═══ */}
      {/* Figma node 25880:4743 — a vertical timeline of three NEW split cards
          (app-local, outside BDS per #1121): left = step label + title + prose +
          CTA; right = a 2×2 checklist. The central spine (::before) connects the
          cards through the gaps and, inside each card, reads as the divider
          between the two panes (see how-it-works.css). */}
      <section className="hiw-process" data-section="process">
        <div className="hiw-container">
          <SectionHeader title="Three steps. One team. Total clarity." />
          <ol className="hiw-timeline">
            {PROCESS_STEPS.map((step) => (
              <li key={step.id} className="hiw-step">
                <article className="hiw-card">
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
              <Card key={card.id} padding="lg">
                <CardTitle>{card.title}</CardTitle>
                <CardDescription>{card.description}</CardDescription>
              </Card>
            ))}
          </Grid>
        </div>
      </section>

      {/* ═══ Industries ("Where we do our best work.") ═══ */}
      {/* Figma node 25887:4854 — yellow accent band. Diverges from the home
          Industries section (tabs): here the three industries are a BDS
          Accordion, beside a decorative illustration panel. Labels + blurbs are
          the curated HOME_INDUSTRIES copy (shared SoT). On-band text is pinned
          dark in how-it-works.css (fixed-light yellow tint, same as home). */}
      <section className="hiw-industries" data-section="industries">
        <div className="hiw-container">
          <SectionHeader
            align="start"
            title="Where we do our best work."
            description="We work most closely with dental practices, property management and real estate firms, and small businesses."
          />
          <div className="hiw-industries__layout">
            <Accordion
              className="hiw-industries__accordion"
              defaultOpenItems={[HOME_INDUSTRIES[0].slug]}
              items={HOME_INDUSTRIES.map((industry) => ({
                id: industry.slug,
                title: industry.label,
                content: industry.description,
              }))}
            />
            {/* Decorative placeholder for the Figma illustration + chat bubble.
                Real artwork lands with the rest of the imagery (#1121). */}
            <div className="hiw-industries__media" aria-hidden="true">
              <span className="hiw-industries__bubble">“How can I help today?”</span>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ CTA ("Let's build something.") ═══ */}
      {/* Figma node 25886:4799 — Brik-orange panel. Reuses the shared brand CTA
          card (.cta-section-brand / .cta-card-brand, shared-sections.css). */}
      <section className="cta-section-brand" data-section="cta">
        <div className="cta-card-brand">
          <h2 className="hiw-cta__title">Ready to see what fits?</h2>
          <p className="hiw-cta__description">
            You work directly with Abbey and Nick throughout — from the BrikDown to Foundation
            to ongoing. We keep our client list focused so every engagement gets our full attention.
          </p>
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
