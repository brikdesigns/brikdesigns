import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getSupportPlanBySlug, getOtherSupportPlans, mapCategorySlug } from '@/lib/supabase/queries';
import { Card, CardList, LinkButton, PricingCard } from '@brikdesigns/bds';
import { parseFeatures } from '@/lib/parse-features';
import { color, gap, serviceColor } from '@/lib/tokens';
import { heading, text, label } from '@/lib/styles';
import '../../shared-sections.css';
import '../plans.css';

type Props = { params: Promise<{ slug: string }> };

export const revalidate = 3600;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  try {
    const plan = await getSupportPlanBySlug(slug);
    return {
      title: `${plan.name} | Support Plans`,
      description: plan.description ?? undefined,
    };
  } catch {
    return { title: 'Plan Not Found' };
  }
}

export default async function PlanDetailPage({ params }: Props) {
  const { slug } = await params;

  let plan;
  try {
    plan = await getSupportPlanBySlug(slug);
  } catch {
    notFound();
  }

  const sl = plan.service_lines as { slug: string; name: string } | null;
  const audience = mapCategorySlug(sl?.slug ?? '');
  const audienceTokens = serviceColor(audience);

  const whatYouGet = parseFeatures(plan.what_you_get);
  const otherPlans = await getOtherSupportPlans(slug);

  return (
    <div
      style={
        {
          '--text-brand-primary': audienceTokens.text,
          '--background-inverse': audienceTokens.inverse,
        } as React.CSSProperties
      }
    >
      {/* ─── Phase 1: Hero ─────────────────────────────────────── */}
      <section
        className="page-hero"
        style={{ backgroundColor: audienceTokens.surface }}
      >
        <div className="page-hero__container">
          <p className="page-hero__tagline">Support Plan</p>
          <h1 className="page-hero__title">{plan.name}</h1>
          {plan.description && (
            <p className="page-hero__description">{plan.description}</p>
          )}
          {plan.monthly_price_display && (
            <p
              style={{
                ...heading.md,
                marginTop: gap.lg,
                color: audienceTokens.text,
              }}
            >
              {plan.monthly_price_display}
              <span style={{ ...text.bodyLg, color: color.text.secondary }}>
                {' '}
                /month
              </span>
            </p>
          )}
          <div className="button-wrapper" style={{ marginTop: gap.xl }}>
            <LinkButton
              href={`/get-started?plan=${plan.slug}`}
              variant="primary"
              size="lg"
            >
              Get Started
            </LinkButton>
          </div>
        </div>
      </section>

      {/* ─── Phase 2: What You Get ──────────────────────────────── */}
      {whatYouGet && (
        <section className="content-section">
          <div className="container-lg container-lg--comfortable">
            <h2
              style={{
                ...heading.lg,
                alignSelf: 'flex-start',
                marginBottom: gap.xl,
              }}
            >
              What You Get
            </h2>
            <CardList orientation="vertical" gap="sm" style={{ width: '100%' }}>
              {whatYouGet.map((item) => (
                <Card key={item} preset="control" title={item} />
              ))}
            </CardList>
          </div>
        </section>
      )}

      {/* ─── Phase 3: CTA ──────────────────────────────────────── */}
      <section className="cta-section-brand">
        <div
          className="cta-card-brand"
          style={{ backgroundColor: audienceTokens.surface }}
        >
          <h2 style={{ ...heading.lg, textAlign: 'center' }}>
            Get {plan.name}
          </h2>
          {plan.monthly_price_display && (
            <p
              style={{
                ...heading.md,
                color: audienceTokens.text,
                textAlign: 'center',
              }}
            >
              {plan.monthly_price_display}
              <span
                style={{
                  ...label.md,
                  color: color.text.secondary,
                  fontFamily: undefined,
                }}
              >
                {' '}
                /month
              </span>
            </p>
          )}
          <p
            style={{
              ...text.bodyLg,
              textAlign: 'center',
              maxWidth: '560px',
              color: color.text.secondary,
            }}
          >
            Limited spots available — claim yours today.
          </p>
          <LinkButton
            href={`/get-started?plan=${plan.slug}`}
            variant="primary"
            size="lg"
          >
            Get Started
          </LinkButton>
        </div>
      </section>

      {/* ─── Phase 4: Related Plans ─────────────────────────────── */}
      {otherPlans.length > 0 && (
        <section className="content-section content-section--secondary">
          <div className="container-lg container-lg--comfortable">
            <h2
              style={{
                ...heading.lg,
                alignSelf: 'flex-start',
                marginBottom: gap.xl,
              }}
            >
              Other Support Plans
            </h2>
            <div className="grid-3" style={{ width: '100%' }}>
              {otherPlans.map((other) => {
                const otherSl = other.service_lines as unknown as { slug: string } | null;
                const otherTokens = serviceColor(otherSl?.slug ?? '');
                return (
                  <div key={other.slug} className="plans-card-wrapper">
                    {other.image_url && (
                      <div
                        className="plans-card-image"
                        style={{ backgroundColor: otherTokens.surface }}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={other.image_url}
                          alt={other.name}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                      </div>
                    )}
                    <PricingCard
                      title={other.name}
                      price={other.monthly_price_display ?? 'Contact'}
                      period="/month"
                      description={other.description ?? undefined}
                      action={
                        <LinkButton
                          href={`/plans/${other.slug}`}
                          variant="primary"
                          size="md"
                          style={{ width: '100%' }}
                        >
                          Learn More
                        </LinkButton>
                      }
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
