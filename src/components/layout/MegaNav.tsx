'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ServiceBadge } from '@bds/components/ui/ServiceBadge/ServiceBadge';
import type { ServiceCategory } from '@bds/components/ui/ServiceBadge/ServiceBadge';
import { ThemeToggle } from './ThemeToggle';
import '@bds/components/ui/Button/Button.css';
import './MegaNav.css';

/* ────────────────────────────────────────────────────────────────
   Types
   ──────────────────────────────────────────────────────────────── */

interface ServiceItem {
  name: string;
  slug: string;
}

interface ServiceLine {
  name: string;
  slug: string;
  category: ServiceCategory;
  tagline: string;
  services: ServiceItem[];
}

interface SupportPlan {
  name: string;
  slug: string;
  price: string;
  description: string;
}

interface IndustryItem {
  name: string;
  slug: string;
  tagline: string;
  imageUrl: string | null;
}

export interface MegaNavProps {
  serviceLines: ServiceLine[];
  supportPlans: SupportPlan[];
  industries: IndustryItem[];
}

type DropdownId = 'services' | 'customers' | 'about' | 'plans' | null;

/* ────────────────────────────────────────────────────────────────
   Component
   ──────────────────────────────────────────────────────────────── */

export function MegaNav({ serviceLines, supportPlans, industries }: MegaNavProps) {
  const [open, setOpen] = useState<DropdownId>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const navRef = useRef<HTMLElement>(null);

  // Click-only toggle (matches Webflow data-hover="false")
  const toggle = useCallback((id: DropdownId) => {
    setOpen((prev) => (prev === id ? null : id));
  }, []);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (navRef.current && !navRef.current.contains(e.target as Node)) {
        setOpen(null);
        setMobileOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Close on Escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setOpen(null);
        setMobileOpen(false);
      }
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, []);

  return (
    <header className="mega-nav" ref={navRef}>
      {/* Utility bar — Webflow: .utility-navigation → .layout-utility-nav.right → .top-nav-item */}
      <div className="mega-nav__utility">
        <div className="mega-nav__container mega-nav__utility-inner">
          {/* Webflow: .customer-login-wrapper — hidden via CSS (display: none) on live site.
              Kept in markup for future portal integration but not rendered. */}
          {/* Webflow: .label-wrapper — phone icon + label + number */}
          <div className="mega-nav__utility-group">
            <PhoneIcon />
            <span className="mega-nav__utility-label">Talk to sales:</span>
            <a href="tel:+15614908714" className="mega-nav__utility-link">(561) 490-8714</a>
          </div>
          {/* Webflow: .toggle-wrapper.right — theme toggle with border-left */}
          <div className="mega-nav__utility-toggle">
            <ThemeToggle />
          </div>
        </div>
      </div>

      {/* Main nav — Webflow: .top-navigation → .container-nav → .nav-wrapper (space-between) */}
      <nav className="mega-nav__main">
        <div className="mega-nav__container mega-nav__main-inner">
          {/* Webflow: .logo-wrapper + .nav_menu-wrapper grouped together on the left */}
          <Link href="/" className="mega-nav__logo">
            <Image
              src="/images/Brik-logo_1.svg"
              alt="Brik Designs"
              width={124}
              height={50}
              className="site-logo"
              priority
            />
          </Link>

          {/* Webflow: .nav_menu-wrapper → .nav_menu-list — sits right after logo, NOT centered */}
          <div className="mega-nav__menu-wrapper">
            <div className="mega-nav__menu">
            {/* Design Services */}
            <div
              className="mega-nav__dropdown"
            >
              <button
                className={`mega-nav__toggle ${open === 'services' ? 'mega-nav__toggle--active' : ''}`}
                onClick={() => toggle('services')}
                aria-expanded={open === 'services'}
              >
                Design Services
                <ChevronDown />
              </button>

              {open === 'services' && (
                <div className="mega-nav__panel mega-nav__panel--services">
                  {/* Webflow: .layout-submenu (flex row: 4-col grid + product promo) */}
                  <div className="mega-nav__panel-inner mega-nav__services-layout">
                    {/* Webflow: .inner-wrapper > .layout-nav-services-grid */}
                    <div className="mega-nav__services-grid">
                      {serviceLines
                        .filter((l) => l.category !== 'product')
                        .map((line) => (
                          <div key={line.slug} className="mega-nav__service-col">
                            {/* Webflow: .text_label-md.link + .text_body-sm.secondary (NO badge on header) */}
                            <Link href={`/services/${line.slug}`} className="mega-nav__service-title" onClick={() => setOpen(null)}>
                              {line.name}
                            </Link>
                            <p className="mega-nav__service-tagline">{line.tagline}</p>
                            <ul className="mega-nav__service-list">
                              {line.services.map((svc) => (
                                <li key={svc.slug}>
                                  <Link
                                    href={`/services/${line.slug}/${svc.slug}`}
                                    className="mega-nav__service-link"
                                    onClick={() => setOpen(null)}
                                  >
                                    <ServiceBadge
                                      category={line.category}
                                      size="sm"
                                      serviceName={svc.name}
                                    />
                                    <span>{svc.name}</span>
                                  </Link>
                                </li>
                              ))}
                            </ul>
                            {/* Webflow: .nav-view-all — "View All" link at bottom of each column */}
                            <Link
                              href={`/services/${line.slug}`}
                              className="mega-nav__view-all"
                              onClick={() => setOpen(null)}
                            >
                              View All
                            </Link>
                          </div>
                        ))}
                    </div>

                    {/* Webflow: .inner-wrapper.auto — Product promo card (5th column) */}
                    {serviceLines.find((l) => l.category === 'product') && (
                      <div className="mega-nav__product-promo">
                        <div className="mega-nav__product-promo-img">
                          <Image
                            src="/images/product_mobile_app_2x.webp"
                            alt="Product design"
                            width={200}
                            height={200}
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          />
                        </div>
                        <h5 className="mega-nav__product-promo-title">Need product design support?</h5>
                        <p className="mega-nav__product-promo-desc">
                          From mobile apps to enterprise solutions, we create experiences that are
                          well-crafted, intuitive, and aligned with your business goals.
                        </p>
                        <Link
                          href="/services/product-design"
                          className="bds-button bds-button--primary bds-button--sm"
                          onClick={() => setOpen(null)}
                        >
                          Learn More
                        </Link>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Customers */}
            <div
              className="mega-nav__dropdown"
            >
              <button
                className={`mega-nav__toggle ${open === 'customers' ? 'mega-nav__toggle--active' : ''}`}
                onClick={() => toggle('customers')}
                aria-expanded={open === 'customers'}
              >
                Customers
                <ChevronDown />
              </button>

              {open === 'customers' && (
                <div className="mega-nav__panel mega-nav__panel--customers">
                  <div className="mega-nav__panel-inner mega-nav__panel-row">
                    {/* Webflow: .inner-wrapper.narrow — left intro */}
                    <div className="mega-nav__panel-intro">
                      <h3 className="mega-nav__panel-heading">Who We Support</h3>
                      <p className="mega-nav__panel-desc">
                        Brik gives you access to senior-level design and strategic
                        support—without the full-time overhead.
                      </p>
                      <Link href="/customers" className="bds-button bds-button--primary bds-button--sm" onClick={() => setOpen(null)}>
                        Learn More
                      </Link>
                    </div>

                    {/* Webflow: .inner-wrapper — right: industry cards + stories promo */}
                    <div className="mega-nav__customers-content">
                      {/* Webflow: .cms-nav-layout — industry type cards */}
                      <div className="mega-nav__customers-grid">
                        {industries.map((ind) => (
                          <Link
                            key={ind.slug}
                            href={`/industries/${ind.slug}`}
                            className="mega-nav__industry-card"
                            onClick={() => setOpen(null)}
                          >
                            <div className="mega-nav__industry-img">
                              {ind.imageUrl ? (
                                <Image src={ind.imageUrl} alt={ind.name} width={200} height={200} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              ) : (
                                <div style={{ width: '100%', height: '100%', backgroundColor: 'var(--surface-accent)' }} />
                              )}
                            </div>
                            <span className="mega-nav__industry-name">{ind.name}</span>
                            <span className="mega-nav__industry-tagline">{ind.tagline}</span>
                            <span className="bds-button bds-button--secondary bds-button--sm">View Details <ArrowRight /></span>
                          </Link>
                        ))}
                      </div>

                      {/* Webflow: .mega-nav-item-story.accent — Customer Stories promo */}
                      <Link
                        href="/customer-stories"
                        className="mega-nav__stories-promo"
                        onClick={() => setOpen(null)}
                      >
                        <span className="mega-nav__stories-promo-title">Customer Stories</span>
                        <span className="mega-nav__stories-promo-desc">Real stories, real results. See what we&apos;ve built together.</span>
                        <span className="bds-button bds-button--primary bds-button--sm">View Stories</span>
                      </Link>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* About */}
            <div
              className="mega-nav__dropdown"
            >
              <button
                className={`mega-nav__toggle ${open === 'about' ? 'mega-nav__toggle--active' : ''}`}
                onClick={() => toggle('about')}
                aria-expanded={open === 'about'}
              >
                About
                <ChevronDown />
              </button>

              {open === 'about' && (
                <div className="mega-nav__panel mega-nav__panel--about">
                  <div className="mega-nav__panel-inner mega-nav__panel-row">
                    {/* Webflow: .inner-wrapper.narrow — left intro */}
                    <div className="mega-nav__panel-intro">
                      <h3 className="mega-nav__panel-heading">About</h3>
                      <p className="mega-nav__panel-desc">
                        Brik gives you access to senior-level design and strategic
                        support—without the full-time overhead.
                      </p>
                    </div>
                    {/* Webflow: .layout-nav-4-col-about — 4 cards with images */}
                    <div className="mega-nav__about-grid">
                      <AboutNavCard href="/about" image="/images/brik_designs_4x.webp" title="Meet Brik" desc="Learn about the company and the Brik team" cta="Learn More" onClick={() => setOpen(null)} />
                      <AboutNavCard href="/value" image="/images/value_of_design_4x.webp" title="The Value of Design" desc="Learn the value of design in four steps" cta="Learn More" onClick={() => setOpen(null)} />
                      <AboutNavCard href="/blog" image="/images/blogs_4x.webp" title="Blog" desc="Stories, insights, and lessons learned from building our business" cta="View Posts" onClick={() => setOpen(null)} />
                      <AboutNavCard href="/customer-stories" image="/images/customer_stories_2x.webp" title="Customer Stories" desc="Stories, insights, and lessons learned from building our business" cta="View Stories" onClick={() => setOpen(null)} />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Support Plans */}
            <div
              className="mega-nav__dropdown"
            >
              <button
                className={`mega-nav__toggle ${open === 'plans' ? 'mega-nav__toggle--active' : ''}`}
                onClick={() => toggle('plans')}
                aria-expanded={open === 'plans'}
              >
                Support Plans
                <ChevronDown />
              </button>

              {open === 'plans' && (
                <div className="mega-nav__panel mega-nav__panel--plans">
                  <div className="mega-nav__panel-inner mega-nav__panel-row">
                    {/* Webflow: .inner-wrapper.narrow.stacked — left intro */}
                    <div className="mega-nav__panel-intro">
                      <h3 className="mega-nav__panel-heading">Support Plans</h3>
                      <p className="mega-nav__panel-desc">
                        Brik gives you access to senior-level design and strategic
                        support—without the full-time overhead.
                      </p>
                      <Link href="/plans" className="bds-button bds-button--primary bds-button--sm" onClick={() => setOpen(null)}>
                        Learn More
                      </Link>
                    </div>
                    {/* Webflow: .layout-nav-support — 3 plan cards with images */}
                    <div className="mega-nav__plans-grid">
                      <AboutNavCard
                        href="/plans#marketing-support"
                        image="/images/marketing_social_media_2x.webp"
                        title="Marketing Support"
                        desc="We act as your marketing department—handling everything from campaigns and emails to graphics and strategy. One monthly fee. No juggling freelancers or doing it yourself."
                        cta="Learn More"
                        onClick={() => setOpen(null)}
                      />
                      <AboutNavCard
                        href="/plans#back-office-support"
                        image="/images/service_automated_workflow_2x.webp"
                        title="Back Office Support"
                        desc="We streamline your behind-the-scenes operations—from workflows and automations to system cleanups and SOPs—so your team can focus on what matters."
                        cta="Learn More"
                        onClick={() => setOpen(null)}
                      />
                      <AboutNavCard
                        href="/plans#product-support"
                        image="/images/product_mobile_app_2x.webp"
                        title="Product Support"
                        desc="Whether you're launching new features or improving your UX, we handle your product interface design from end to end—without slowing down your dev team."
                        cta="Learn More"
                        onClick={() => setOpen(null)}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
            </div>
          </div>

          {/* Webflow: .nav-button-wrapper — CTA + mobile toggle, far right */}
          <div className="mega-nav__actions">
            <Link href="/contact" className="bds-button bds-button--primary bds-button--sm">
              Let&apos;s Talk
            </Link>
            <button
              className="mega-nav__mobile-toggle"
              onClick={() => setMobileOpen(!mobileOpen)}
              aria-label="Toggle menu"
            >
              <span className={`mega-nav__hamburger ${mobileOpen ? 'mega-nav__hamburger--open' : ''}`} />
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="mega-nav__mobile-menu">
          <Link href="/services" className="mega-nav__mobile-link" onClick={() => setMobileOpen(false)}>Design Services</Link>
          {serviceLines.map((line) => (
            <Link
              key={line.slug}
              href={`/services/${line.slug}`}
              className="mega-nav__mobile-link mega-nav__mobile-link--indent"
              onClick={() => setMobileOpen(false)}
            >
              <ServiceBadge category={line.category} size="sm" />
              {line.name}
            </Link>
          ))}
          <Link href="/industries" className="mega-nav__mobile-link" onClick={() => setMobileOpen(false)}>Industries</Link>
          <Link href="/customer-stories" className="mega-nav__mobile-link" onClick={() => setMobileOpen(false)}>Customer Stories</Link>
          <Link href="/about" className="mega-nav__mobile-link" onClick={() => setMobileOpen(false)}>About</Link>
          <Link href="/blog" className="mega-nav__mobile-link" onClick={() => setMobileOpen(false)}>Blog</Link>
          <Link href="/plans" className="mega-nav__mobile-link" onClick={() => setMobileOpen(false)}>Support Plans</Link>
          <Link href="/contact" className="mega-nav__mobile-link mega-nav__mobile-link--cta" onClick={() => setMobileOpen(false)}>
            Let&apos;s Talk
          </Link>
        </div>
      )}
    </header>
  );
}

/* ────────────────────────────────────────────────────────────────
   Sub-components
   ──────────────────────────────────────────────────────────────── */

/**
 * AboutNavCard — matches Webflow .list-item.comfortable structure:
 * image frame (accent bg) + title + description + "Learn More →" button
 * Used in About and Support Plans dropdowns.
 */
function AboutNavCard({ href, image, title, desc, cta, onClick }: {
  href: string; image: string; title: string; desc: string; cta: string; onClick: () => void;
}) {
  return (
    <Link href={href} className="mega-nav__about-card" onClick={onClick}>
      <div className="mega-nav__about-card-img">
        <Image src={image} alt={title} width={400} height={400} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </div>
      <span className="mega-nav__about-card-title">{title}</span>
      <span className="mega-nav__about-card-desc">{desc}</span>
      <span className="bds-button bds-button--secondary bds-button--sm">{cta} <ArrowRight /></span>
    </Link>
  );
}

/* Webflow: .dropdown-icon — exact SVG from source: 20x20 viewBox, strokeWidth 2.5 */
function ChevronDown() {
  return (
    <div className="mega-nav__chevron">
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path d="M5 7.5L10 12.5L15 7.5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

/* Webflow: .icon-xs with text "user" — FA 6 Pro Solid user icon */
function UserIcon() {
  return (
    <svg className="mega-nav__utility-icon" width="12" height="12" viewBox="0 0 448 512" fill="currentColor" aria-hidden="true">
      <path d="M224 256A128 128 0 1 0 224 0a128 128 0 1 0 0 256zm-45.7 48C79.8 304 0 383.8 0 482.3C0 498.7 13.3 512 29.7 512H418.3c16.4 0 29.7-13.3 29.7-29.7C448 383.8 368.2 304 269.7 304H178.3z" />
    </svg>
  );
}

/* Webflow: .icon-xs with text "phone" — FA 6 Pro Solid phone icon */
function PhoneIcon() {
  return (
    <svg className="mega-nav__utility-icon" width="12" height="12" viewBox="0 0 512 512" fill="currentColor" aria-hidden="true">
      <path d="M164.9 24.6c-7.7-18.6-28-28.5-47.4-23.2l-88 24C12.1 30.2 0 46 0 64C0 311.4 200.6 512 448 512c18 0 33.8-12.1 38.6-29.5l24-88c5.3-19.4-4.6-39.7-23.2-47.4l-96-40c-16.3-6.8-35.2-2.1-46.3 11.6L304.7 368C234.3 334.7 177.3 277.7 144 207.3L193.3 167c13.7-11.2 18.4-30 11.6-46.3l-40-96z" />
    </svg>
  );
}

/* Webflow: .icon_1x1-sm.brand with text "arrow-right" — FA 6 Pro Solid arrow.
   Used in .button-secondary-sm throughout nav dropdown cards. */
function ArrowRight() {
  return (
    <svg className="mega-nav__arrow-icon" width="12" height="12" viewBox="0 0 448 512" fill="currentColor" aria-hidden="true">
      <path d="M438.6 278.6c12.5-12.5 12.5-32.8 0-45.3l-160-160c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3L338.8 224 32 224c-17.7 0-32 14.3-32 32s14.3 32 32 32l306.7 0L233.4 393.4c-12.5 12.5-12.5 32.8 0 45.3s32.8 12.5 45.3 0l160-160z" />
    </svg>
  );
}
