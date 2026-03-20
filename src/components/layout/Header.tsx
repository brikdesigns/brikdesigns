import Link from 'next/link';
import { ThemeToggle } from './ThemeToggle';

const navLinks = [
  { label: 'Services', href: '/services' },
  { label: 'Plans', href: '/plans' },
  { label: 'Customer Stories', href: '/customer-stories' },
  { label: 'Blog', href: '/blog' },
  { label: 'About', href: '/about' },
];

export function Header() {
  return (
    <header
      style={{
        backgroundColor: 'var(--surface-primary)',
        borderBottom: '1px solid var(--border-secondary)',
        position: 'sticky',
        top: 0,
        zIndex: 100,
      }}
    >
      <nav
        style={{
          maxWidth: 1200,
          margin: '0 auto',
          padding: 'var(--padding-md) var(--padding-lg)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Link href="/" style={{ textDecoration: 'none' }}>
          {/* TODO: Replace with actual Brik logo image */}
          <span
            style={{
              fontFamily: 'var(--font-family-heading)',
              fontSize: 'var(--heading-md)',
              fontWeight: 'bold',
              color: 'var(--text-brand-primary)',
            }}
          >
            brik
          </span>
        </Link>

        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--gap-lg)' }}>
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              style={{
                fontFamily: 'var(--font-family-label)',
                fontSize: 'var(--label-md)',
                color: 'var(--text-primary)',
                textDecoration: 'none',
              }}
            >
              {link.label}
            </Link>
          ))}
          <ThemeToggle />
          <Link
            href="/get-started"
            style={{
              fontFamily: 'var(--font-family-label)',
              fontSize: 'var(--label-md)',
              backgroundColor: 'var(--background-brand-primary)',
              color: 'var(--text-on-color-dark)',
              padding: 'var(--padding-xs) var(--padding-md)',
              borderRadius: 'var(--border-radius-md)',
              textDecoration: 'none',
            }}
          >
            Get Started
          </Link>
        </div>
      </nav>
    </header>
  );
}
