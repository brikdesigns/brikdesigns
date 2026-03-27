import Link from 'next/link';
import Image from 'next/image';
import { NewsletterForm } from './NewsletterForm';
import './Footer.css';

const aboutLinks = [
  { label: 'Who We Are', href: '/about' },
  { label: 'What We Do', href: '/services' },
  { label: 'Support Plans', href: '/plans' },
  { label: 'Blog', href: '/blog' },
  { label: 'Customer Stories', href: '/customer-stories' },
];

const customerLinks = [
  { label: 'Who We Support', href: '/customers' },
  { label: 'Dental', href: '/industries/dental' },
  { label: 'Real Estate', href: '/industries/real-estate' },
  { label: 'Small Business', href: '/industries/small-business' },
];

const serviceLines = [
  { label: 'Brand Design', href: '/services/brand-design', category: 'brand' as const },
  { label: 'Information Design', href: '/services/information-design', category: 'information' as const },
  { label: 'Marketing Design', href: '/services/marketing-design', category: 'marketing' as const },
  { label: 'Product Design', href: '/services/product-design', category: 'product' as const },
  { label: 'Back Office Design', href: '/services/back-office-design', category: 'service' as const },
];

/**
 * Footer — matches Webflow .footer structure:
 * 1. Newsletter section (border-bottom separated)
 * 2. Multi-column nav (logo + contact, social, about, customers, services with badges)
 * 3. Copyright bar
 */
export function Footer() {
  return (
    <footer className="site-footer">
      {/* Newsletter section — Webflow: .container-newsletter */}
      <div className="footer-newsletter">
        <div className="footer-newsletter__inner">
          <div className="footer-newsletter__content">
            <h3 className="footer-newsletter__heading">Join Brik by Brik Newsletter</h3>
            <p className="footer-newsletter__text">
              Enter your name, email, and subscribe for free right now.
            </p>
          </div>
          <div className="footer-newsletter__form">
            <NewsletterForm />
          </div>
        </div>
      </div>

      {/* Main footer content — Webflow: .container-footer */}
      <div className="footer-main">
        <div className="footer-main__content">
          {/* Brand column */}
          <div className="footer-brand">
            <div className="footer-brand__logo">
              <Image
                src="/images/Brik-logo.svg"
                alt="Brik Designs logo"
                width={100}
                height={40}
                className="site-logo"
              />
              <p className="footer-text">We&apos;re a digital marketing and design agency.</p>
            </div>
            <div className="footer-brand__contact">
              <div className="footer-contact-item">
                <span className="footer-icon">phone</span>
                <span className="footer-text">Office: (561) 490-8714</span>
              </div>
              <a href="mailto:hello@brikdesigns.com" className="footer-contact-item">
                <span className="footer-icon">envelope</span>
                <span className="footer-text">hello@brikdesigns.com</span>
              </a>
              <Link href="/contact" className="footer-contact-item">
                <span className="footer-icon">message</span>
                <span className="footer-text">Send us a message</span>
              </Link>
            </div>
          </div>

          {/* Nav columns */}
          <div className="footer-nav">
            {/* Social */}
            <div className="footer-col">
              <h4 className="footer-col__heading">Follow Us Online</h4>
              <ul className="footer-col__list">
                <li><a href="https://www.linkedin.com/company/designsbybrik/" target="_blank" rel="noopener noreferrer" className="footer-link">LinkedIn</a></li>
                <li><a href="https://www.facebook.com/designsbybrik" target="_blank" rel="noopener noreferrer" className="footer-link">Facebook</a></li>
                <li><a href="https://www.instagram.com/designsbybrik/" target="_blank" rel="noopener noreferrer" className="footer-link">Instagram</a></li>
              </ul>
            </div>

            {/* About */}
            <div className="footer-col">
              <h4 className="footer-col__heading">About</h4>
              <ul className="footer-col__list">
                {aboutLinks.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className="footer-link">{link.label}</Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Customers */}
            <div className="footer-col">
              <h4 className="footer-col__heading">Customers</h4>
              <ul className="footer-col__list">
                {customerLinks.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className="footer-link">{link.label}</Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Services with badges */}
            <div className="footer-col">
              <h4 className="footer-col__heading">Services</h4>
              <ul className="footer-col__list">
                {serviceLines.map((line) => (
                  <li key={line.href}>
                    <Link href={line.href} className="footer-link footer-link--badge">
                      <span className={`footer-badge footer-badge--${line.category}`} />
                      {line.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* Copyright — Webflow: .footer-content-copyright */}
        <div className="footer-copyright">
          <div className="footer-copyright__left">
            <span className="footer-copyright__text">&copy; {new Date().getFullYear()} Brik Designs. All rights reserved.</span>
            <span className="footer-copyright__dot">&bull;</span>
            <Link href="/terms" className="footer-copyright__link">Terms</Link>
            <span className="footer-copyright__dot">&bull;</span>
            <Link href="/privacy-policy" className="footer-copyright__link">Privacy policy</Link>
          </div>
          <span className="footer-copyright__text">Made with ❤️ in Palm Beach, FL</span>
        </div>
      </div>
    </footer>
  );
}
