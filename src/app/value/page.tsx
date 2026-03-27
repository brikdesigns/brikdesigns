import type { Metadata } from 'next';
import { LinkButton } from '@bds/components/ui/Button/LinkButton';
import '../shared-sections.css';
import './value.css';

export const metadata: Metadata = {
  title: 'The Value of Design | Why Design Matters for Your Business',
  description: 'Learn the value of design in 4 steps. From first impressions to conversions, discover why design is the secret weapon behind every successful brand.',
};

const STEPS = [
  {
    number: '01',
    title: 'First Impressions Are Everything',
    intro: 'You have about 0.05 seconds to make an impression online. That\u2019s how fast people decide whether to stay on your site or bounce. If your design is cluttered, outdated, or just plain unappealing you\u2019re losing potential customers before they even give you a chance.',
    stats: [
      { value: '75%', label: 'of website credibility comes from design. If your site looks unprofessional, people won\u2019t trust your business.' },
      { value: '42%', label: 'of users leave a website because of poor functionality. Even the best product in the world won\u2019t sell if users struggle to navigate your site.' },
      { value: '50%', label: 'of consumers believe website design is crucial to a business\u2019s brand. It\u2019s not just about looks\u2014it\u2019s about perception.' },
    ],
  },
  {
    number: '02',
    title: 'Good Design = More Conversions',
    intro: 'Want more leads, sign-ups, and sales? Design can get you there.',
    stats: [
      { value: '200%', label: 'conversion rate increase. Strong UI/UX design can increase conversion rates by up to 200%. A well-thought-out, user-friendly design could literally double your results.' },
      { value: '60%', label: 'of consumers avoid brands with unattractive logos\u2014even if they have great reviews. Looks do matter when it comes to credibility.' },
      { value: '32%', label: 'more revenue. Businesses that embrace design generate 32% more revenue and 56% higher shareholder returns. This isn\u2019t a nice-to-have\u2014it\u2019s a must-have for growth.' },
    ],
  },
  {
    number: '03',
    title: 'People Crave Visually Appealing Content',
    intro: 'Humans are visual creatures. We process images 60,000x faster than text, so if you\u2019re relying on just words to tell your story, you\u2019re missing out.',
    stats: [
      { value: '61%', label: 'of marketers believe visuals are the key to a successful campaign.' },
      { value: 'Abandon', label: 'Users will leave a website if they have a bad experience with how it looks. If your visuals aren\u2019t drawing people in, they\u2019re pushing them away.' },
    ],
  },
  {
    number: '04',
    title: 'Design is a Business Essential',
    intro: 'Design isn\u2019t a luxury\u2014it\u2019s a business essential. The companies that invest in design consistently outperform those that don\u2019t.',
    stats: [
      { value: '61%', label: 'of marketers believe visuals are the key to a successful campaign. If your visuals aren\u2019t drawing people in, they\u2019re pushing them away.' },
      { value: '50%', label: 'of consumers believe website design is crucial to a business\u2019s brand. It\u2019s not just about looks\u2014it\u2019s about perception.' },
    ],
  },
];

export default function ValuePage() {
  return (
    <>
      {/* Hero */}
      <section className="page-hero value-hero">
        <div className="page-hero__container">
          <p className="text-label-sm text--brand">Why Design?</p>
          <h1 className="page-hero__title">In 4 Steps</h1>
          <p className="page-hero__description">
            Design is more than just making things look pretty. It&apos;s the secret weapon behind every successful brand,
            the silent salesperson that builds trust, boosts engagement, and turns browsers into buyers.
          </p>
          <p className="text-body-md text--secondary">
            Here&apos;s why design deserves a front-row seat in your marketing strategy.
          </p>

          {/* Step navigation */}
          <nav className="value-step-nav">
            {STEPS.map((step) => (
              <a key={step.number} href={`#value-${step.number}`} className="value-step-nav__link">
                <span className="text-label-sm text--brand">{step.number}</span>
                <span className="text-body-sm">{step.title}</span>
              </a>
            ))}
          </nav>
        </div>
      </section>

      {/* Steps */}
      {STEPS.map((step, i) => (
        <section
          key={step.number}
          id={`value-${step.number}`}
          className={`content-section ${i % 2 !== 0 ? 'content-section--secondary' : ''}`}
        >
          <div className="container-lg container-lg--comfortable">
            <div className="value-step-header">
              <span className="value-step-number">{step.number}</span>
              <h2 className="text-heading-lg">{step.title}</h2>
            </div>
            <p className="text-body-lg text--secondary" style={{ maxWidth: 700 }}>
              {step.intro}
            </p>
            <div className="value-stats-grid">
              {step.stats.map((stat) => (
                <div key={stat.value} className="value-stat-card">
                  <span className="value-stat-value">{stat.value}</span>
                  <p className="text-body-sm text--secondary">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      ))}

      {/* CTA */}
      <section className="content-section content-section--accent">
        <div className="container-lg">
          <div className="content-wrapper content-wrapper--center">
            <p className="text-body-lg text--center">
              Whether you need a fresh new look, a website that wows, or branding that speaks to your audience, we&apos;ve got you covered.
            </p>
            <h2 className="text-heading-lg text--center">
              Ready to see what great design can do for you?
            </h2>
            <p className="text-body-md text--secondary text--center">
              Let&apos;s make something amazing together.
            </p>
            <div className="button-wrapper button-wrapper--center">
              <LinkButton href="/contact" variant="primary" size="lg">Let&apos;s Talk</LinkButton>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
