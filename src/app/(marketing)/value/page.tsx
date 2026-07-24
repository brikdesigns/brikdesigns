import type { Metadata } from 'next';
import { Button } from '@brikdesigns/bds';
import { Reveal } from '@/components/ui/Reveal';
import './value.css';

export const metadata: Metadata = {
  title: 'The Value of Design | Why Design Matters for Your Business',
  description:
    'Learn the value of design in 4 steps. From first impressions to conversions, discover why design is the secret weapon behind every successful brand.',
};

/* ─── Inline icons (stroke = currentColor; colour set by CSS) ─── */
const svgProps = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 3,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

const Glasses = () => (
  <svg viewBox="0 0 48 48" width="52" height="52" {...svgProps}>
    <circle cx="12" cy="30" r="8" />
    <circle cx="36" cy="30" r="8" />
    <path d="M20 27c1.5-2 6.5-2 8 0" />
    <path d="M4 20l4 3" />
    <path d="M44 20l-4 3" />
  </svg>
);
const PieChart = () => (
  <svg viewBox="0 0 48 48" width="52" height="52" {...svgProps}>
    <circle cx="21" cy="27" r="16" />
    <path d="M26 4 a18 18 0 0 1 18 18 h-18 z" fill="currentColor" stroke="none" />
  </svg>
);
const Presentation = () => (
  <svg viewBox="0 0 48 48" width="52" height="52" {...svgProps}>
    <rect x="8" y="8" width="32" height="22" rx="2" />
    <path d="M24 30v8" />
    <path d="M15 44l9-6 9 6" />
  </svg>
);
const Briefcase = () => (
  <svg viewBox="0 0 48 48" width="52" height="52" {...svgProps}>
    <rect x="6" y="16" width="36" height="24" rx="3" />
    <path d="M18 16v-4a3 3 0 0 1 3-3h6a3 3 0 0 1 3 3v4" />
    <path d="M6 26h36" />
  </svg>
);
const Timer = () => (
  <svg viewBox="0 0 48 48" width="64" height="64" {...svgProps}>
    <circle cx="24" cy="27" r="16" />
    <path d="M24 27V18" />
    <path d="M24 27l7 5" />
    <path d="M18 6h12" />
  </svg>
);
const Eye = () => (
  <svg viewBox="0 0 48 48" width="52" height="52" {...svgProps}>
    <path d="M4 24s7-13 20-13 20 13 20 13-7 13-20 13S4 24 4 24z" />
    <circle cx="24" cy="24" r="6" />
  </svg>
);
const Crown = () => (
  <svg viewBox="0 0 48 48" width="52" height="52" {...svgProps}>
    <path d="M6 34l-3-18 11 8 10-16 10 16 11-8-3 18z" />
    <path d="M6 34h36" />
  </svg>
);

const CARDS = [
  { num: '01', title: 'First Impressions are Everything', variant: 'green', Icon: Glasses },
  { num: '02', title: 'Good Design = More Conversions', variant: 'purple', Icon: PieChart },
  { num: '03', title: 'People Crave Visual Content', variant: 'blue', Icon: Presentation },
  { num: '04', title: 'Design is a Business Essential', variant: 'gold', Icon: Briefcase },
];

export default function ValuePage() {
  return (
    <>
      {/* 1 · Hero */}
      <section className="vband vband--coral value-hero">
        <Reveal>
          <div className="value-hero__title rise">Why Design?</div>
          <div className="value-hero__sub rise" style={{ transitionDelay: '0.08s' }}>In 4 steps</div>
        </Reveal>
      </section>

      {/* 2 · Pillar-nav cards */}
      <section className="vband vband--coral value-cards">
        <Reveal className="value-cards__row">
          {CARDS.map((c, i) => (
            <a
              key={c.num}
              href={`#value-${c.num}`}
              className={`value-card value-card--${c.variant} rise rise--scale`}
              style={{ transitionDelay: `${i * 0.09}s` }}
            >
              <span className="value-card__icon"><c.Icon /></span>
              <span className="value-card__number">{c.num}</span>
              <span className="value-card__title">{c.title}</span>
              <span className="value-card__view">View</span>
            </a>
          ))}
        </Reveal>
      </section>

      {/* 3 · Editorial "Let's Be Real" */}
      <section className="vband vband--coral value-editorial">
        <Reveal>
          <div className="value-editorial__eyebrow rise">Let&apos;s Be Real</div>
          <div className="value-editorial__line rise" style={{ transitionDelay: '0.06s' }}>
            Design is more than<br />just making things<br />look pretty
          </div>
          <div className="value-editorial__line value-editorial__line--spaced rise" style={{ transitionDelay: '0.12s' }}>
            It&apos;s the secret weapon behind
          </div>
          <div className="value-editorial__line value-editorial__line--ink rise" style={{ transitionDelay: '0.18s' }}>
            every successful brand,<br />the silent salesperson that<br />builds trust, boosts engagement,<br />and turns browsers into buyers
          </div>
        </Reveal>
      </section>

      {/* 4 · Gold transition */}
      <section className="vband vband--gold value-transition">
        <Reveal>
          <div className="value-transition__text rise">
            Yet, so many businesses<br />treat design as an afterthought<br />instead of the powerhouse<br />that it really is.
          </div>
          <div className="value-transition__text rise" style={{ transitionDelay: '0.1s' }}>
            Here&apos;s why design deserves<br />a front-row seat<br />in your marketing strategy.
          </div>
        </Reveal>
      </section>

      {/* 5 · Pillar 01 title */}
      <section id="value-01" className="vband vband--green value-ptitle">
        <Reveal>
          <div className="value-ptitle__num rise">01</div>
          <div className="value-ptitle__head rise" style={{ transitionDelay: '0.08s' }}>
            First Impressions<br />Are Everything
          </div>
        </Reveal>
      </section>

      {/* 6 · Pillar 01 dramatic callout */}
      <section className="vband vband--dark-green value-callout">
        <Reveal>
          <span className="value-callout__icon rise"><Timer /></span>
          <div className="value-callout__pre rise" style={{ transitionDelay: '0.06s' }}>You have about</div>
          <div className="value-callout__big rise" style={{ transitionDelay: '0.12s' }}>0.05 seconds</div>
          <div className="value-callout__post rise" style={{ transitionDelay: '0.18s' }}>to make an impression online.</div>
        </Reveal>
      </section>

      {/* 7 + 8 · Pillar 01 sub-callout + stats */}
      <section className="vband vband--pink value-statband">
        <Reveal>
          <div className="value-subcallout rise">
            If your design is cluttered, outdated, or just plain unappealing you&apos;re losing potential customers before they even give you a chance.
          </div>
        </Reveal>
        <Reveal className="value-stats">
          <div className="value-stat rise rise--scale">
            <div className="value-stat__value value-stat__value--coral">75%</div>
            <p className="value-stat__desc">of website credibility comes from design. If your site looks unprofessional, people won&apos;t trust your business.</p>
          </div>
          <div className="value-stat rise rise--scale" style={{ transitionDelay: '0.1s' }}>
            <div className="value-stat__value value-stat__value--coral">42%</div>
            <p className="value-stat__desc">of users leave a website because of poor functionality. Even the best product in the world won&apos;t sell if users struggle to navigate your site.</p>
          </div>
          <div className="value-stat rise rise--scale" style={{ transitionDelay: '0.2s' }}>
            <div className="value-stat__value value-stat__value--coral">50%</div>
            <p className="value-stat__desc">of consumers believe website design is crucial to a business&apos;s brand. It&apos;s not just about looks—it&apos;s about perception.</p>
          </div>
        </Reveal>
      </section>

      {/* 9 · Pillar 02 title */}
      <section id="value-02" className="vband vband--lavender value-ptitle">
        <Reveal>
          <div className="value-ptitle__num rise">02</div>
          <div className="value-ptitle__head rise" style={{ transitionDelay: '0.08s' }}>
            Good Design =<br />More Conversions
          </div>
        </Reveal>
      </section>

      {/* 10 · Pillar 02 intro */}
      <section className="vband vband--lavender value-pintro">
        <Reveal>
          <div className="value-pintro__text rise">
            Want more leads, sign-ups, and sales?<br />Design can get you there.
          </div>
        </Reveal>
      </section>

      {/* 11 · Pillar 02 stats */}
      <section className="vband vband--pink value-statband value-statband--flush">
        <Reveal className="value-stats">
          <div className="value-stat rise rise--scale">
            <div className="value-stat__value value-stat__value--coral">200%</div>
            <div className="value-stat__label">conversion rates</div>
            <p className="value-stat__desc">Strong UI/UX design can increase conversion rates by up to 200%. That means a well-thought-out, user-friendly design could literally double your results.</p>
          </div>
          <div className="value-stat rise rise--scale" style={{ transitionDelay: '0.1s' }}>
            <div className="value-stat__value value-stat__value--coral">60%</div>
            <div className="value-stat__label">of consumers</div>
            <p className="value-stat__desc">avoid brands with unattractive logos—even if they have great reviews. Looks do matter when it comes to credibility.</p>
          </div>
          <div className="value-stat rise rise--scale" style={{ transitionDelay: '0.2s' }}>
            <div className="value-stat__value value-stat__value--coral">32%</div>
            <div className="value-stat__label">more revenue</div>
            <p className="value-stat__desc">Businesses that embrace design generate 32% more revenue and 56% higher shareholder returns. This isn&apos;t a nice-to-have—it&apos;s a must-have for growth.</p>
          </div>
        </Reveal>
      </section>

      {/* 12 · Pillar 03 title */}
      <section id="value-03" className="vband vband--blue value-ptitle">
        <Reveal>
          <div className="value-ptitle__num rise">03</div>
          <div className="value-ptitle__head rise" style={{ transitionDelay: '0.08s' }}>
            People Crave<br />Visually Appealing Content
          </div>
        </Reveal>
      </section>

      {/* 13 · Pillar 03 intro */}
      <section className="vband vband--blue value-pintro">
        <Reveal>
          <div className="value-pintro__text rise">Humans are visual creatures.<br />We process images</div>
          <div className="value-pintro__big rise" style={{ transitionDelay: '0.08s' }}>60,000x</div>
          <div className="value-pintro__text rise" style={{ transitionDelay: '0.12s' }}>faster than text,</div>
          <div className="value-pintro__note rise" style={{ transitionDelay: '0.18s' }}>
            so if you&apos;re relying on just words to tell your story, you&apos;re missing out.
          </div>
        </Reveal>
      </section>

      {/* 14 · Pillar 03 stats */}
      <section className="vband vband--gold value-statband value-statband--flush">
        <Reveal className="value-stats value-stats--two">
          <div className="value-stat rise rise--scale">
            <span className="value-stat__icon"><PieChart /></span>
            <div className="value-stat__value">61%</div>
            <p className="value-stat__desc">of marketers believe visuals are the key to a successful campaign.</p>
          </div>
          <div className="value-stat rise rise--scale" style={{ transitionDelay: '0.1s' }}>
            <div className="value-stat__value">Abandon</div>
            <p className="value-stat__desc">Users will leave a website if they have a bad experience with how it looks. If your visuals aren&apos;t drawing people in, they&apos;re pushing them away.</p>
          </div>
        </Reveal>
      </section>

      {/* 15 · Pillar 04 title */}
      <section id="value-04" className="vband vband--gold value-ptitle">
        <Reveal>
          <div className="value-ptitle__num rise">04</div>
          <div className="value-ptitle__head rise" style={{ transitionDelay: '0.08s' }}>
            Design is a<br />Business Essential
          </div>
        </Reveal>
      </section>

      {/* 16 · Pillar 04 intro (coral) */}
      <section className="vband vband--coral value-pintro value-pintro--full">
        <Reveal>
          <div className="value-pintro__text rise">
            Want more leads, sign-ups, and sales?<br />Design can get you there.
          </div>
        </Reveal>
      </section>

      {/* 17 · Pillar 04 stats */}
      <section className="vband vband--gold value-statband value-statband--flush">
        <Reveal className="value-stats value-stats--two">
          <div className="value-stat rise rise--scale">
            <span className="value-stat__icon"><Eye /></span>
            <div className="value-stat__value">61%</div>
            <p className="value-stat__desc">of marketers believe visuals are the key to a successful campaign. Users will leave a website if they have a bad experience with how it looks. If your visuals aren&apos;t drawing people in, they&apos;re pushing them away.</p>
          </div>
          <div className="value-stat rise rise--scale" style={{ transitionDelay: '0.1s' }}>
            <span className="value-stat__icon"><Crown /></span>
            <div className="value-stat__value">50%</div>
            <p className="value-stat__desc">of consumers believe website design is crucial to a business&apos;s brand. It&apos;s not just about looks—it&apos;s about perception.</p>
          </div>
        </Reveal>
      </section>

      {/* 18 · Pre-CTA */}
      <section className="vband vband--salmon value-precta">
        <Reveal>
          <div className="value-precta__text rise">
            Whether you need a fresh new look, a website that wows, or branding that speaks to your audience, we&apos;ve got you covered.
          </div>
        </Reveal>
      </section>

      {/* 19 · Final CTA */}
      <section className="vband vband--coral value-cta">
        <Reveal>
          <div className="value-cta__head rise">Ready to see what great design can do for you?</div>
          <div className="value-cta__sub rise" style={{ transitionDelay: '0.08s' }}>Let&apos;s make something amazing together.</div>
          <div className="value-cta__btn rise" style={{ transitionDelay: '0.16s' }}>
            <Button href="/contact" variant="inverse" size="lg">Let&apos;s Talk</Button>
          </div>
        </Reveal>
      </section>
    </>
  );
}
