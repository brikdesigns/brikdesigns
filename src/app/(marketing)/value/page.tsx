import type { Metadata } from 'next';
import { Button } from '@brikdesigns/bds';
import { Icon } from '@/lib/icon';
import { Reveal } from '@/components/ui/Reveal';
import { text, heading, label } from '@/lib/styles';
import { color, serviceColor } from '@/lib/tokens';
import '../shared-sections.css';
import './value.css';

export const metadata: Metadata = {
  title: 'The Value of Design | Why Design Matters for Your Business',
  description:
    'Learn the value of design in 4 steps. From first impressions to conversions, discover why design is the secret weapon behind every successful brand.',
};

/**
 * Each pillar is colour-coded to a Brik service line (Value-page colour map):
 * 01 → marketing (green), 02 → product (purple), 03 → information (blue),
 * 04 → brand (yellow). Tints use the token-safe pale `surfaceLight` ramp
 * applied to the band via `.service-surface`; saturated accents (number, icon)
 * use the on-light service `text` token. `icon` is a bundled `ph:*` glyph
 * (src/lib/icons.generated.json).
 */
const STEPS = [
  {
    number: '01',
    service: 'marketing',
    icon: 'ph:star',
    title: 'First Impressions Are Everything',
    intro:
      'You have about 0.05 seconds to make an impression online. That’s how fast people decide whether to stay on your site or bounce. If your design is cluttered, outdated, or just plain unappealing you’re losing potential customers before they even give you a chance.',
    stats: [
      { value: '75%', label: 'of website credibility comes from design. If your site looks unprofessional, people won’t trust your business.' },
      { value: '42%', label: 'of users leave a website because of poor functionality. Even the best product in the world won’t sell if users struggle to navigate your site.' },
      { value: '50%', label: 'of consumers believe website design is crucial to a business’s brand. It’s not just about looks—it’s about perception.' },
    ],
  },
  {
    number: '02',
    service: 'product',
    icon: 'ph:storefront',
    title: 'Good Design = More Conversions',
    intro: 'Want more leads, sign-ups, and sales? Design can get you there.',
    stats: [
      { value: '200%', label: 'conversion rate increase. Strong UI/UX design can increase conversion rates by up to 200%. A well-thought-out, user-friendly design could literally double your results.' },
      { value: '60%', label: 'of consumers avoid brands with unattractive logos—even if they have great reviews. Looks do matter when it comes to credibility.' },
      { value: '32%', label: 'more revenue. Businesses that embrace design generate 32% more revenue and 56% higher shareholder returns. This isn’t a nice-to-have—it’s a must-have for growth.' },
    ],
  },
  {
    number: '03',
    service: 'information',
    icon: 'ph:globe',
    title: 'People Crave Visually Appealing Content',
    intro: 'Humans are visual creatures. We process images 60,000x faster than text, so if you’re relying on just words to tell your story, you’re missing out.',
    stats: [
      { value: '61%', label: 'of marketers believe visuals are the key to a successful campaign.' },
      { value: 'Abandon', label: 'Users will leave a website if they have a bad experience with how it looks. If your visuals aren’t drawing people in, they’re pushing them away.' },
    ],
  },
  {
    number: '04',
    service: 'brand',
    icon: 'ph:briefcase',
    title: 'Design is a Business Essential',
    intro: 'Design isn’t a luxury—it’s a business essential. The companies that invest in design consistently outperform those that don’t.',
    stats: [
      { value: '61%', label: 'of marketers believe visuals are the key to a successful campaign. If your visuals aren’t drawing people in, they’re pushing them away.' },
      { value: '50%', label: 'of consumers believe website design is crucial to a business’s brand. It’s not just about looks—it’s about perception.' },
    ],
  },
];

export default function ValuePage() {
  return (
    <>
      {/* ── Hero + colour-coded pillar navigator ────────────────── */}
      <section className="page-hero value-hero" data-scroll-hero>
        <div className="page-hero__container">
          <Reveal className="value-hero__intro">
            <p className="rise" style={{ ...label.smBold, color: color.text.brand }}>Why Design?</p>
            <h1 className="page-hero__title rise" style={{ transitionDelay: '0.06s' }}>In 4 Steps</h1>
            <p className="page-hero__description rise" style={{ transitionDelay: '0.12s' }}>
              Design is more than just making things look pretty. It&apos;s the secret weapon behind every successful
              brand, the silent salesperson that builds trust, boosts engagement, and turns browsers into buyers.
            </p>
            <p className="rise" style={{ ...text.body, color: color.text.secondary, transitionDelay: '0.18s' }}>
              Here&apos;s why design deserves a front-row seat in your marketing strategy.
            </p>
          </Reveal>

          <Reveal className="value-toc" as="nav">
            {STEPS.map((step, i) => (
              <a
                key={step.number}
                href={`#value-${step.number}`}
                className="value-toc__card rise rise--scale"
                style={{
                  backgroundColor: serviceColor(step.service).surfaceLight,
                  transitionDelay: `${i * 0.09}s`,
                }}
              >
                <Icon icon={step.icon} className="value-toc__icon" aria-hidden style={{ color: serviceColor(step.service).text }} />
                <span className="value-toc__number" style={{ color: serviceColor(step.service).text }}>{step.number}</span>
                <span className="value-toc__title" style={heading.sm}>{step.title}</span>
                <span className="value-toc__view" style={label.smBold}>View</span>
              </a>
            ))}
          </Reveal>
        </div>
      </section>

      {/* ── Editorial reveal band ───────────────────────────────── */}
      <section className="page-section value-editorial">
        <div className="container-lg container-lg--comfortable">
          <Reveal className="content-wrapper content-wrapper--narrow">
            <p className="rise" style={{ ...label.smBold, color: color.text.brand }}>Let&apos;s Be Real</p>
            <p className="value-editorial__lede rise" style={{ ...heading.md, transitionDelay: '0.08s' }}>
              Yet so many businesses treat design as an afterthought instead of the powerhouse that it really is.
            </p>
            <p className="rise" style={{ ...text.bodyLg, color: color.text.secondary, transitionDelay: '0.16s' }}>
              Design isn&apos;t decoration — it&apos;s how trust is earned, attention is held, and browsers become buyers.
              Here&apos;s the proof, four ways.
            </p>
          </Reveal>
        </div>
      </section>

      {/* ── Four colour-coded pillars ───────────────────────────── */}
      {STEPS.map((step) => {
        const c = serviceColor(step.service);
        return (
          <section
            key={step.number}
            id={`value-${step.number}`}
            className="page-section service-surface value-pillar"
            style={{ backgroundColor: c.surfaceLight }}
          >
            <div className="container-lg container-lg--comfortable">
              <Reveal className="value-pillar__inner">
                <div className="value-pillar__header rise">
                  <span className="value-pillar__number" style={{ color: c.text }}>{step.number}</span>
                  <div className="value-pillar__heading-group">
                    <Icon icon={step.icon} className="value-pillar__icon" aria-hidden style={{ color: c.text }} />
                    <h2 style={heading.lg}>{step.title}</h2>
                  </div>
                </div>
                <p className="value-pillar__intro rise" style={{ ...text.bodyLg, color: color.text.secondary, transitionDelay: '0.08s' }}>
                  {step.intro}
                </p>
                <div className="value-stats-grid">
                  {step.stats.map((stat, i) => (
                    <div
                      key={stat.value}
                      className="value-stat-card rise rise--scale"
                      style={{ borderLeftColor: c.text, transitionDelay: `${0.14 + i * 0.1}s` }}
                    >
                      <span className="value-stat-value" style={{ color: c.text }}>{stat.value}</span>
                      <p style={{ ...text.bodySm, color: color.text.secondary }}>{stat.label}</p>
                    </div>
                  ))}
                </div>
              </Reveal>
            </div>
          </section>
        );
      })}

      {/* ── Closing CTA ─────────────────────────────────────────── */}
      <section className="page-section page-section--accent">
        <div className="container-lg">
          <Reveal className="content-wrapper content-wrapper--center">
            <p className="rise" style={{ ...text.bodyLg, textAlign: 'center' }}>
              Whether you need a fresh new look, a website that wows, or branding that speaks to your audience,
              we&apos;ve got you covered.
            </p>
            <h2 className="rise" style={{ ...heading.lg, textAlign: 'center', transitionDelay: '0.08s' }}>
              Ready to see what great design can do for you?
            </h2>
            <p className="rise" style={{ ...text.body, color: color.text.secondary, textAlign: 'center', transitionDelay: '0.16s' }}>
              Let&apos;s make something amazing together.
            </p>
            <div className="button-wrapper button-wrapper--center rise" style={{ transitionDelay: '0.24s' }}>
              <Button href="/contact" variant="primary" size="lg">Let&apos;s Talk</Button>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}
