import Link from 'next/link';

export function EditPageShell({
  backHref,
  backLabel,
  title,
  subtitle,
  children,
}: {
  backHref: string;
  backLabel: string;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ maxWidth: '720px', display: 'flex', flexDirection: 'column', gap: 'var(--gap-lg)' }}>
      <div>
        <Link
          href={backHref}
          style={{
            fontFamily: 'var(--font-family-label)',
            fontSize: 'var(--label-sm)',
            color: 'var(--text-secondary)',
            textDecoration: 'none',
          }}
        >
          ← {backLabel}
        </Link>
        <h1
          style={{
            fontFamily: 'var(--font-family-heading)',
            fontSize: 'var(--heading-md)',
            color: 'var(--text-primary)',
            margin: 'var(--gap-xs) 0 0',
          }}
        >
          {title}
        </h1>
        {subtitle && (
          <p
            style={{
              fontFamily: 'var(--font-family-body)',
              fontSize: 'var(--body-sm)',
              color: 'var(--text-secondary)',
              margin: 'var(--gap-xs) 0 0',
            }}
          >
            {subtitle}
          </p>
        )}
      </div>
      {children}
    </div>
  );
}
