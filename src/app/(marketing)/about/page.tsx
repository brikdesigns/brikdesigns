import type { Metadata } from 'next';
import Image from 'next/image';
import { Icon } from '@/lib/icon';
import { Button, Accordion } from '@brikdesigns/bds';
import { text, heading, label } from '@/lib/styles';
import { color } from '@/lib/tokens';
import { ScrollDownCta } from '@/components/ui/ScrollDownCta';
import '../shared-sections.css';
import './about.css';

export const metadata: Metadata = {
  alternates: { canonical: '/about' },
  // Bare title — the root layout applies the `%s | Brik Designs` template.
  title: 'Meet Brik',
  description:
    'Meet Abbey and Nick — the team behind Brik. We help dental practices, real estate professionals, and small businesses handle marketing and operations so owners can focus on the work.',
};

export const revalidate = 3600;

// BrikDown CTA target. Matches the home (R2) and how-we-work rebuilds, which all
// point "Get your free BrikDown" at /offers/brikdown-analysis. The operator
// named /offers/free-marketing-analysis, but that slug is comment-flagged
// "legacy" in FormBlock.tsx — reconcile before launch (see PR / #1245).
const BRIKDOWN_HREF = '/offers/brikdown-analysis';

const TEAM = [
  {
    name: 'Abbey',
    fullName: 'Abbey Stanerson',
    role: 'Marketing & Operations',
    image: '/images/Abbey-Headshot.webp',
    bio: [
      'Abbey spent over a decade working inside marketing agencies — including a Fortune 500 firm focused on private practices and the dental industry — before launching Brik. She’s worked with hundreds of clients across marketing strategy, operations, and business development, and she’s seen firsthand what actually moves the needle and what’s just noise.',
      'At Brik, Abbey leads strategy and client relationships. She’s the one who gets into your business, figures out what’s slipping, and builds the plan to fix it.',
    ],
    linkedin: 'https://www.linkedin.com/in/abbey-stanerson-62682142/',
    email: 'abbey@brikdesigns.com',
  },
  {
    name: 'Nick',
    fullName: 'Nick Stanerson',
    role: 'Creative & Execution',
    image: '/images/Nick-Headshot.webp',
    bio: [
      'Nick spent years as a lead designer at scale — iHeartRadio, SimplePractice, and Built — building products that had to work for thousands of users at once. That kind of work teaches you how to think about systems, not just surfaces.',
      'At Brik, Nick leads creative and execution. He’s responsible for making sure everything Brik builds — websites, campaigns, brand assets, client-facing materials — actually works the way it should. Good-looking and functional aren’t competing priorities to Nick. They’re the same thing.',
    ],
    linkedin: 'https://www.linkedin.com/in/nickstanerson/',
    email: 'nick@brikdesigns.com',
    website: 'https://nickstanerson.com',
  },
];

// §3 "Why Brik?" origin story. Rendered as prose this session; the accordion
// treatment the operator asked for is blocked on the BDS Accordion subtitle/
// action enhancement (brikdesigns/brik-bds#2285) landing + a version bump.
const WHY_BRIK = [
  'When we were kids, we were lego kids — siblings who could take the same pile of pieces and end up somewhere completely different by the end of the afternoon. The kind who followed the instructions just long enough to understand how it was supposed to go, then took the whole thing apart to see what else it could become. A spaceship could become a city. A castle could become something that didn’t have a name yet.',
  'Something about that stuck with us.',
  'A single brick isn’t much on its own. But give two people the same pile of pieces and they’ll build completely different things — and that’s not a flaw in the design. That’s the whole point. The right materials, the right vision, and you can build almost anything.',
  'That’s where the name came from. Brik — with a “k,” no “c.” Four letters hit different: shorter, stickier, harder to shake. We wanted something that felt like ours. A little unexpected. The kind of name you don’t forget.',
  'The word became a way of thinking. Every part of a business — brand, marketing, systems, back office — is its own brik. Each piece matters on its own. But stack them together with intention and you stop putting out fires and start running something that actually holds.',
  'That’s what we’re here to build. Brik by brik.',
];

const HOW_WE_WORK = [
  {
    title: 'We stay small on purpose.',
    body: 'Every client works directly with Abbey and Nick — not an account manager, not a junior team member. That’s not something we mention to sound boutique. It’s how we make sure the work is actually good.',
  },
  {
    title: 'We also tell you what we actually think.',
    body: 'If something isn’t working, we’ll say it. If a plan needs to change, we change it. Nobody benefits from a partner who just nods along.',
  },
];

const BELIEFS = [
  {
    id: 'expertise',
    title: 'You’re the expert on your business. We’re the expert on ours.',
    body: 'We don’t pretend to know your industry better than you do. You bring the context. We bring the marketing and operations knowledge. Together it works.',
  },
  {
    id: 'runs-without-you',
    title: 'The process should run without you in the middle.',
    body: 'Everything we build is designed to operate — not to require you to manage it. That’s the whole point of having a partner.',
  },
  {
    id: 'small-and-focused',
    title: 'Small and focused beats big and scattered.',
    body: 'We take on a limited number of clients so the work stays good. When you work with Brik, you’re not competing for attention.',
  },
  {
    id: 'honest',
    title: 'Honest over comfortable.',
    body: 'Clear communication, real feedback, and no surprises. We’d rather have a hard conversation early than a bigger one later.',
  },
];

export default function AboutPage() {
  return (
    <>
      {/* ═══ Hero ═══ */}
      {/* Figma node 25980:12441 — white band, left-aligned title with "people"
          in brand color, two intro paragraphs, scroll-down affordance. */}
      <section className="page-hero about-hero" data-section="hero">
        <div className="page-hero__container about-hero__container">
          <h1 className="page-hero__title about-hero__title">
            The <span className="about-hero__em">People</span> Behind Brik.
          </h1>
          <p className="about-hero__intro">
            Dental practices, real estate businesses, and small businesses — especially the
            ones doing really good work — are constantly outgunned on marketing and operations.
            They&rsquo;re running on patchwork systems, managing vendors who don&rsquo;t talk to each
            other, and doing it all without anyone who actually understands the full picture.
          </p>
          <p className="about-hero__intro">
            Abbey and Nick built Brik to change that. One team that handles both marketing and
            back office — so small business owners get the kind of support big companies take
            for granted, without the overhead of building it in-house.
          </p>
        </div>
        <ScrollDownCta />
      </section>

      {/* ═══ Team (Meet Abbey / Meet Nick) ═══ */}
      {/* Figma node 25977:8028 — two stacked full-width bordered cards; 304px
          circle headshot left, name + role + social buttons + bio right. */}
      <section className="page-section about-team" data-section="team">
        <div className="container-lg container-lg--comfortable">
          {TEAM.map((member) => (
            <article key={member.name} className="about-team-card">
              <div className="about-team-card__avatar">
                <Image
                  src={member.image}
                  alt={member.fullName}
                  width={304}
                  height={304}
                  style={{ objectFit: 'cover', width: '100%', height: '100%' }}
                />
              </div>
              <div className="about-team-card__body">
                <div className="about-team-card__head">
                  <h2 style={heading.lg}>Meet {member.name}</h2>
                  <p style={{ ...label.smBold, color: color.text.secondary }}>{member.role}</p>
                </div>
                <div className="about-team-card__social">
                  <Button
                    href={member.linkedin}
                    target="_blank"
                    rel="noopener noreferrer"
                    variant="secondary"
                    size="sm"
                    icon={<Icon icon="ph:linkedin-logo" />}
                    label={`${member.name} on LinkedIn`}
                  />
                  <Button
                    href={`mailto:${member.email}`}
                    variant="secondary"
                    size="sm"
                    icon={<Icon icon="ph:envelope-simple" />}
                    label={`Email ${member.name}`}
                  />
                  {member.website && (
                    <Button
                      href={member.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      variant="secondary"
                      size="sm"
                      icon={<Icon icon="ph:globe" />}
                      label={`${member.name}'s website`}
                    />
                  )}
                </div>
                <div className="about-team-card__bio">
                  {member.bio.map((paragraph, i) => (
                    <p key={i} style={{ ...text.body, color: color.text.secondary }}>{paragraph}</p>
                  ))}
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* ═══ Why Brik? ═══ */}
      {/* Figma node 26058:5343 — centered: 3D brik image, heading, origin story.
          Prose for now; accordion treatment pends brik-bds#2285. */}
      <section className="page-section about-why" data-section="why-brik" aria-labelledby="about-why-title">
        <div className="container-lg about-why__inner">
          <div className="about-why__media">
            <Image
              src="/images/brik_designs_4x.webp"
              alt="A single 3D Brik"
              width={267}
              height={267}
              style={{ objectFit: 'contain', width: '100%', height: '100%' }}
            />
          </div>
          <h2 id="about-why-title" style={heading.lg}>Why Brik?</h2>
          <div className="about-why__story">
            {WHY_BRIK.map((paragraph, i) => (
              <p key={i} style={{ ...text.bodyLg, color: color.text.secondary }}>{paragraph}</p>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ How We Work ═══ */}
      {/* Figma node 26058:5518 — centered title over two stacked subhead+body
          blocks. */}
      <section className="page-section about-hww" data-section="how-we-work" aria-labelledby="about-hww-title">
        <div className="container-lg container-lg--comfortable about-hww__inner">
          <h2 id="about-hww-title" style={heading.lg}>How We Work</h2>
          <div className="about-hww__blocks">
            {HOW_WE_WORK.map((block) => (
              <div key={block.title} className="about-hww__block">
                <h3 style={heading.md}>{block.title}</h3>
                <p style={{ ...text.bodyLg, color: color.text.secondary }}>{block.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ What We Believe ═══ */}
      {/* Figma node 25980:12411 — tan band, 2-col: heading left, accordion right.
          Belief items render via the BDS Accordion (title + content). The
          numbered index shown in the frame is the Accordion `action` slot,
          deferred with the subtitle enhancement (brik-bds#2285). */}
      <section className="page-section page-section--accent about-believe" data-section="believe" aria-labelledby="about-believe-title">
        <div className="container-lg about-believe__inner">
          <div className="about-believe__intro">
            <h2 id="about-believe-title" style={heading.lg}>What We Believe</h2>
            <p style={{ ...text.bodyLg, color: color.text.secondary }}>
              The principles behind how we work — and how we decide what stays on your plate
              and what comes off it.
            </p>
          </div>
          <div className="about-believe__list">
            <Accordion
              items={BELIEFS.map((belief) => ({
                id: belief.id,
                title: belief.title,
                content: (
                  <p style={{ ...text.body, color: color.text.secondary }}>{belief.body}</p>
                ),
              }))}
              defaultOpenItems={[BELIEFS[0].id]}
            />
          </div>
        </div>
      </section>

      {/* ═══ CTA ("Ready to see if we're the right fit?") ═══ */}
      {/* Figma node 25980:12466 — Brik-orange panel. Reuses the shared brand CTA
          card (.cta-section-brand / .cta-card-brand, shared-sections.css). */}
      <section className="cta-section-brand about-cta" data-section="cta" aria-labelledby="about-cta-title">
        <div className="cta-card-brand">
          <div className="cta-card-brand__content">
            <h2 id="about-cta-title" className="about-cta__title">Ready to see if we&rsquo;re the right fit?</h2>
            <p className="about-cta__description">
              Start with a free BrikDown Analysis — 60 minutes, no pitch, just clarity on
              what&rsquo;s working and what to fix first.
            </p>
          </div>
          <Button href={BRIKDOWN_HREF} variant="on-color" size="lg">
            Get your free BrikDown
          </Button>
        </div>
      </section>
    </>
  );
}
