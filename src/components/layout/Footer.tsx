'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Icon } from '@iconify/react';
import { ServiceBadge } from '@bds/components/ui/ServiceBadge/ServiceBadge';
import type { ServiceCategory } from '@bds/components/ui/ServiceBadge/ServiceBadge';
import { NewsletterForm } from './NewsletterForm';
import './Footer.css';

const socialLinks = [
  { label: 'LinkedIn', href: 'https://www.linkedin.com/company/designsbybrik/', icon: 'ph:linkedin-logo-fill' },
  { label: 'Facebook', href: 'https://www.facebook.com/designsbybrik', icon: 'ph:facebook-logo-fill' },
  { label: 'Instagram', href: 'https://www.instagram.com/designsbybrik/', icon: 'ph:instagram-logo-fill' },
];

const aboutLinks = [
  { label: 'Who We Are', href: '/about', icon: 'ph:users-fill' },
  { label: 'What We Do', href: '/services', icon: 'ph:globe-fill' },
  { label: 'Support Plans', href: '/plans', icon: 'ph:currency-dollar-fill' },
  { label: 'Blog', href: '/blog', icon: 'ph:article-fill' },
  { label: 'Customer Stories', href: '/customer-stories', icon: 'ph:heart-fill' },
];

const customerLinks = [
  { label: 'Who We Support', href: '/customers', icon: 'ph:globe-hemisphere-west-fill' },
  { label: 'Dental', href: '/industries/dental', icon: 'ph:tooth-fill' },
  { label: 'Real Estate', href: '/industries/real-estate', icon: 'ph:house-fill' },
  { label: 'Small Business', href: '/industries/small-business', icon: 'ph:briefcase-fill' },
];

const serviceLines: { label: string; href: string; category: ServiceCategory }[] = [
  { label: 'Brand Design', href: '/services/brand-design', category: 'brand' },
  { label: 'Information Design', href: '/services/information-design', category: 'information' },
  { label: 'Marketing Design', href: '/services/marketing-design', category: 'marketing' },
  { label: 'Product Design', href: '/services/product-design', category: 'product' },
  { label: 'Back Office Design', href: '/services/back-office-design', category: 'service' },
];

export function Footer() {
  return (
    <footer className="site-footer">
      {/* Newsletter — dark card with stacked form */}
      <div className="footer-newsletter">
        <div className="footer-newsletter__inner">
          <h3 className="footer-newsletter__heading">Join Brik by Brik Newsletter</h3>
          <p className="footer-newsletter__text">
            Enter your name, email, and subscribe for free right now.
          </p>
          <div className="footer-newsletter__form">
            <NewsletterForm />
          </div>
        </div>
      </div>

      {/* Divider */}
      <div className="footer-divider" />

      {/* Main footer content */}
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
                style={{ height: 'auto' }}
              />
              <p className="footer-text">We&apos;re a digital marketing and design agency.</p>
            </div>
            <div className="footer-brand__contact">
              <div className="footer-contact-item">
                <Icon icon="ph:phone-fill" className="footer-icon" width={16} height={16} />
                <span className="footer-text">Office: (561) 490-8714</span>
              </div>
              <a href="mailto:hello@brikdesigns.com" className="footer-contact-item">
                <Icon icon="ph:envelope-simple-fill" className="footer-icon" width={16} height={16} />
                <span className="footer-text">hello@brikdesigns.com</span>
              </a>
              <Link href="/contact" className="footer-contact-item">
                <Icon icon="ph:chat-circle-dots-fill" className="footer-icon" width={16} height={16} />
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
                {socialLinks.map((link) => (
                  <li key={link.href}>
                    <a href={link.href} target="_blank" rel="noopener noreferrer" className="footer-link">
                      <Icon icon={link.icon} className="footer-link__icon" width={16} height={16} />
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            {/* About */}
            <div className="footer-col">
              <h4 className="footer-col__heading">About</h4>
              <ul className="footer-col__list">
                {aboutLinks.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className="footer-link">
                      <Icon icon={link.icon} className="footer-link__icon" width={16} height={16} />
                      {link.label}
                    </Link>
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
                    <Link href={link.href} className="footer-link">
                      <Icon icon={link.icon} className="footer-link__icon" width={16} height={16} />
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Services with colored badge icons */}
            <div className="footer-col">
              <h4 className="footer-col__heading">Services</h4>
              <ul className="footer-col__list">
                {serviceLines.map((line) => (
                  <li key={line.href}>
                    <Link href={line.href} className="footer-link">
                      <ServiceBadge category={line.category} size="sm" serviceName={line.label} />
                      {line.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* Copyright */}
        <div className="footer-copyright">
          <div className="footer-copyright__left">
            <span className="footer-copyright__text">&copy; {new Date().getFullYear()} Brik Designs. All rights reserved.</span>
            <span className="footer-copyright__dot">|</span>
            <Link href="/terms" className="footer-copyright__link">Terms</Link>
            <span className="footer-copyright__dot">|</span>
            <Link href="/privacy-policy" className="footer-copyright__link">Privacy policy</Link>
          </div>
          <span className="footer-copyright__heart">
            <span className="footer-copyright__text">Made with</span>
            <Icon icon="ph:heart-fill" width={12} height={12} style={{ color: 'var(--brand--primary)' }} />
            <span className="footer-copyright__text">in Palm Beach, FL</span>
          </span>
        </div>
      </div>
    </footer>
  );
}
