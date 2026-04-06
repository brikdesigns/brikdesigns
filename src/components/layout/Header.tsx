import Link from 'next/link';
import { ThemeToggle } from './ThemeToggle';
import './Header.css';

const navLinks = [
  { label: 'Services', href: '/services' },
  { label: 'Plans', href: '/plans' },
  { label: 'Customer Stories', href: '/customer-stories' },
  { label: 'Blog', href: '/blog' },
  { label: 'About', href: '/about' },
];

export function Header() {
  return (
    <header className="site-header">
      <nav className="site-header__nav">
        <Link href="/" className="site-header__logo">
          {/* TODO: Replace with actual Brik logo image */}
          <span className="site-header__logo-text">brik</span>
        </Link>

        <div className="site-header__links">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="site-header__link"
            >
              {link.label}
            </Link>
          ))}
          <ThemeToggle />
          <Link href="/get-started" className="site-header__cta">
            Get Started
          </Link>
        </div>
      </nav>
    </header>
  );
}
