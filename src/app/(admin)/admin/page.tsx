import Link from 'next/link';
import { Card } from '@brikdesigns/bds';

export default function AdminHomePage() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap-xl)' }}>
      <div>
        <h1
          style={{
            fontFamily: 'var(--font-family-heading)',
            fontSize: 'var(--heading-lg)',
            color: 'var(--text-primary)',
            margin: '0 0 var(--gap-xs)',
          }}
        >
          Marketing CMS
        </h1>
        <p
          style={{
            fontFamily: 'var(--font-family-body)',
            fontSize: 'var(--body-md)',
            color: 'var(--text-secondary)',
            margin: 0,
          }}
        >
          Manage services, customer stories, plans, and blog posts that publish to brikdesigns.com.
        </p>
      </div>

      <section
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 'var(--gap-lg)',
        }}
      >
        <SectionCard
          href="/admin/services"
          title="Services"
          description="Service lines, services, and offerings shown on /services."
          status="live"
        />
        <SectionCard
          href="/admin/stories"
          title="Customer stories"
          description="Portfolio entries shown on /customer-stories."
          status="live"
        />
        <SectionCard
          title="Plans"
          description="Support plans shown on /plans."
          status="coming-soon"
        />
        <SectionCard
          href="/admin/blog"
          title="Blog posts"
          description="Articles shown on /blog. Markdown body, draft / published / archived status."
          status="live"
        />
      </section>
    </div>
  );
}

function SectionCard({
  href,
  title,
  description,
  status,
}: {
  href?: string;
  title: string;
  description: string;
  status: 'live' | 'coming-soon';
}) {
  const isLive = status === 'live';
  const inner = (
    <Card variant="outlined" padding="lg">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap-sm)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2
            style={{
              fontFamily: 'var(--font-family-heading)',
              fontSize: 'var(--heading-sm)',
              color: 'var(--text-primary)',
              margin: 0,
            }}
          >
            {title}
          </h2>
          <span
            style={{
              fontFamily: 'var(--font-family-label)',
              fontSize: 'var(--label-sm)',
              color: isLive ? 'var(--text-positive)' : 'var(--text-secondary)',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
            }}
          >
            {isLive ? 'Live' : 'Soon'}
          </span>
        </div>
        <p
          style={{
            fontFamily: 'var(--font-family-body)',
            fontSize: 'var(--body-sm)',
            color: 'var(--text-secondary)',
            margin: 0,
          }}
        >
          {description}
        </p>
      </div>
    </Card>
  );

  if (!isLive || !href) return <div style={{ opacity: 0.55 }}>{inner}</div>;

  return (
    <Link href={href} style={{ textDecoration: 'none' }}>
      {inner}
    </Link>
  );
}
