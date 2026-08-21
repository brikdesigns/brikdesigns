'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { Icon } from '@/lib/icon';
import { ServiceTag } from '@brikdesigns/bds';
import type { ServiceLine as BdsServiceLine } from '@brikdesigns/bds';
import { composeButtonClasses } from '@/lib/bds-button-classes';
import { routeSlugForServiceLine, SERVICE_LINE_SEGMENTS } from '@/lib/service-line-routes';
import { ThemeToggle } from './ThemeToggle';

import './MegaNav.css';

/* ────────────────────────────────────────────────────────────────
   Types
   ──────────────────────────────────────────────────────────────── */

interface ServiceItem {
  name: string;
  slug: string;
}

interface NavServiceLine {
  name: string;
  slug: string;
  category: BdsServiceLine;
  tagline: string;
  services: ServiceItem[];
  imageUrl: string | null;
}

interface SupportPlan {
  name: string;
  slug: string;
  price: string;
  description: string;
  imageUrl: string | null;
  /** Route segment of the plan's marketing service line, or `null` when the CMS
   *  row has no `display_line_id`. Drives the nav tint on `/plans/{slug}`
   *  (#859) — same column the plan hero tints from. */
  lineSegment: string | null;
}

interface IndustryItem {
  name: string;
  slug: string;
  tagline: string;
  imageUrl: string | null;
}

export interface MegaNavProps {
  serviceLines: NavServiceLine[];
  supportPlans: SupportPlan[];
  industries: IndustryItem[];
}

type DropdownId = 'services' | 'customers' | 'about' | 'plans' | null;

/* Service-line nav tint (#729; all five lines + plan pages since #858/#859).
   On a service-line page — or a plan page whose marketing line is set — the
   sticky nav adopts that line's darkest service surface (e.g.
   `--surface-service-marketing-dark`) with inverted white ink + logo. The route
   segment equals the token suffix for every line, so it doubles as the
   modifier-class key; the background rules live in MegaNav.css.

   Derived from `SERVICE_LINE_SEGMENTS`, not hand-listed: the pilot's hardcoded
   `Set(['marketing'])` is exactly how four lines stayed neutral for two weeks
   with CI green (#860). White ink clears AAA on all five darkest surfaces
   (8.48:1 marketing → 16.34:1 back-office). */
const NAV_TINT_LINES = new Set(SERVICE_LINE_SEGMENTS);

/* Design Services meganav is parked while we explore a new way to surface
   services (service lines now live in the Services/plans panel). Flip to `true`
   to restore the standalone nav item + its 4-col meganav — the markup below is
   kept intact on purpose. */
const SHOW_DESIGN_SERVICES_NAV = false;

/* ────────────────────────────────────────────────────────────────
   Component
   ──────────────────────────────────────────────────────────────── */

export function MegaNav({ serviceLines, supportPlans, industries }: MegaNavProps) {
  const [open, setOpen] = useState<DropdownId>(null);
  // Plans panel view: false = Support Plans cards, true = the full standalone
  // services menu (services grouped by line). The two service streams — plans
  // and standalone services — share the one panel via this toggle.
  const [servicesView, setServicesView] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [hidden, setHidden] = useState(false);
  const navRef = useRef<HTMLElement>(null);
  const lastYRef = useRef(0);
  const pathname = usePathname();

  // Service-line tint. Two route families resolve to a line:
  //
  //   /services/{segment}   — the segment IS the line. Sub-routes like
  //                           /services/marketing/seo still match the parent
  //                           segment, so the tint persists on detail pages.
  //   /plans/{slug}         — the line comes from the plan's display_line
  //                           (#859), the same CMS column the plan hero tints
  //                           from, so nav and hero can't disagree. A plan with
  //                           no marketing line set stays untinted rather than
  //                           guessing — the fallback that hid three NULL rows
  //                           for weeks (see mapServiceLineSlug).
  //
  // The `NAV_TINT_LINES` check is what keeps an unknown segment from emitting a
  // modifier class with no CSS rule behind it.
  const tintedLine = (() => {
    const serviceSegment = pathname?.match(/^\/services\/([^/]+)/)?.[1];
    if (serviceSegment) {
      return NAV_TINT_LINES.has(serviceSegment) ? serviceSegment : null;
    }
    const planSlug = pathname?.match(/^\/plans\/([^/]+)/)?.[1];
    if (planSlug) {
      const line = supportPlans.find((p) => p.slug === planSlug)?.lineSegment;
      return line && NAV_TINT_LINES.has(line) ? line : null;
    }
    return null;
  })();

  // Click-only toggle (matches Webflow data-hover="false")
  const toggle = useCallback((id: DropdownId) => {
    setOpen((prev) => (prev === id ? null : id));
  }, []);

  // Hide-on-scroll-down / reveal-on-scroll-up + subtle shadow once scrolled.
  // rAF-throttled; never hides while a dropdown or the mobile menu is open so
  // the open panel (anchored to the nav) can't be scrolled off-screen.
  useEffect(() => {
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const y = window.scrollY;
        const navH = navRef.current?.offsetHeight ?? 0;
        setScrolled(y > 8);
        const last = lastYRef.current;
        if (open !== null || mobileOpen) {
          setHidden(false);
        } else if (y > navH && y > last) {
          setHidden(true);
        } else if (y < last) {
          setHidden(false);
        }
        lastYRef.current = y;
        ticking = false;
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [open, mobileOpen]);

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
    <header
      className={`mega-nav${scrolled ? ' mega-nav--scrolled' : ''}${hidden ? ' mega-nav--hidden' : ''}${tintedLine ? ` mega-nav--service mega-nav--service-${tintedLine}` : ''}`}
      ref={navRef}
    >
      {/* Utility bar — Webflow: .utility-navigation → .layout-utility-nav.right → .top-nav-item */}
      <div className="mega-nav__utility">
        <div className="mega-nav__container mega-nav__utility-inner">
          {/* Webflow: .customer-login-wrapper — hidden via CSS (display: none) on live site.
              Kept in markup for future portal integration but not rendered. */}
          {/* Webflow: .label-wrapper — phone icon + label + number */}
          <div className="mega-nav__utility-group">
            <span className="mega-nav__utility-icon-wrap">
              <Icon icon="ph:phone" width={12} height={12} aria-hidden={true} />
            </span>
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
          <Link href="/" className="mega-nav__logo">
            <Image
              src={tintedLine ? '/images/Brik-logo_1-inverse.svg' : '/images/Brik-logo_1.svg'}
              alt="Brik Designs"
              width={124}
              height={50}
              className="site-logo"
              priority
              style={{ width: 'auto', height: 'auto' }}
            />
          </Link>

          {/* Menu + CTA grouped right so items sit right-aligned */}
          <div className="mega-nav__right-group">
          <div className="mega-nav__menu-wrapper">
            <div className="mega-nav__menu">
            {/* Support Plans */}
            <div
              className="mega-nav__dropdown"
            >
              <button
                className={`mega-nav__toggle ${open === 'plans' ? 'mega-nav__toggle--active' : ''}`}
                // Reset to the Support Plans view each time the panel opens, so a
                // prior "All Services" selection never re-opens mid-toggle.
                onClick={() => { if (open !== 'plans') setServicesView(false); toggle('plans'); }}
                aria-expanded={open === 'plans'}
              >
                Services
                <ChevronDown />
              </button>

              {open === 'plans' && (
                <div className="mega-nav__panel mega-nav__panel--plans">
                  <div className="mega-nav__panel-inner">
                    {/* The panel serves two service streams — Support Plans
                        (retainers) and standalone Services (grouped by line) —
                        swapped in place. A full-width banner under the grid
                        cross-links to the other stream (replaces the former
                        segmented view toggle). */}
                    {!servicesView ? (
                      <>
                      <div className="mega-nav__panel-row">
                        {/* Col 1: intro — heading + description. Placing the copy
                            in the first column narrows the plan cards to 3 of 4
                            columns, which keeps the panel short. */}
                        <div className="mega-nav__panel-intro">
                          <h3 className="mega-nav__panel-title">Support Plans</h3>
                          <p className="mega-nav__panel-desc">
                            Get an experienced, done-for-you team to manage your
                            marketing, back-office systems, or product design —
                            without the cost of full-time hires.
                          </p>
                        </div>
                        {/* Cols 2–4: plan cards. Product Support is excluded — it
                            has its own dedicated section on /plans. Card image is
                            the plan's service-line card_image_url (single CMS
                            source, #467). */}
                        <div className="mega-nav__plans-grid">
                          {supportPlans
                            .filter((plan) => plan.slug !== 'product-support')
                            .map((plan) => {
                              const image = plan.imageUrl;
                              if (!image) return null;
                              return (
                                <AboutNavCard
                                  key={plan.slug}
                                  href={`/plans/${plan.slug}`}
                                  image={image}
                                  title={plan.name}
                                  desc={plan.description}
                                  cta="Learn More"
                                  onClick={() => setOpen(null)}
                                />
                              );
                            })}
                        </div>
                      </div>
                      {/* Full-width cross-link to the standalone-services view. */}
                      <div className="mega-nav__panel-banner">
                        <p className="mega-nav__panel-banner-text">
                          <strong>Interested in individual services?</strong> View our standalone services.
                        </p>
                        <button
                          type="button"
                          className={composeButtonClasses({ variant: 'secondary', size: 'sm' })}
                          onClick={() => setServicesView(true)}
                        >
                          View Services <ArrowRight />
                        </button>
                      </div>
                      </>
                    ) : (
                      <>
                      {/* All Services view — every standalone service grouped by
                         line (the previous services menu). Lines with no public
                         services drop out rather than render an empty column. */}
                      <div className="mega-nav__services-grid">
                        {serviceLines
                          .filter((line) => line.services.length > 0)
                          .map((line) => (
                            <div key={line.slug} className="mega-nav__service-col">
                              <Link
                                href={`/services/${routeSlugForServiceLine(line.slug)}`}
                                className="mega-nav__service-title"
                                onClick={() => setOpen(null)}
                              >
                                {line.name}
                              </Link>
                              <p className="mega-nav__service-tagline">{line.tagline}</p>
                              <ul className="mega-nav__service-list">
                                {line.services.map((svc) => (
                                  <li key={svc.slug}>
                                    <Link
                                      href={`/services/${routeSlugForServiceLine(line.slug)}/${svc.slug}`}
                                      className="mega-nav__service-link"
                                      onClick={() => setOpen(null)}
                                    >
                                      <ServiceTag
                                        category={line.category}
                                        variant="icon"
                                        size="sm"
                                        serviceName={svc.name}
                                      />
                                      <span>{svc.name}</span>
                                    </Link>
                                  </li>
                                ))}
                              </ul>
                              <Link
                                href={`/services/${routeSlugForServiceLine(line.slug)}`}
                                className="mega-nav__view-all"
                                onClick={() => setOpen(null)}
                              >
                                View All
                              </Link>
                            </div>
                          ))}
                      </div>
                      {/* Full-width cross-link back to the support-plan view. */}
                      <div className="mega-nav__panel-banner">
                        <p className="mega-nav__panel-banner-text">
                          <strong>Interested in a monthly support plan?</strong> View our support plans.
                        </p>
                        <button
                          type="button"
                          className={composeButtonClasses({ variant: 'secondary', size: 'sm' })}
                          onClick={() => setServicesView(false)}
                        >
                          View Service Plan <ArrowRight />
                        </button>
                      </div>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Design Services — parked (SHOW_DESIGN_SERVICES_NAV). Kept intact
                so it can be restored once we settle the new services surface. */}
            {SHOW_DESIGN_SERVICES_NAV && (
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
                            <Link href={`/services/${routeSlugForServiceLine(line.slug)}`} className="mega-nav__service-title" onClick={() => setOpen(null)}>
                              {line.name}
                            </Link>
                            <p className="mega-nav__service-tagline">{line.tagline}</p>
                            <ul className="mega-nav__service-list">
                              {line.services.map((svc) => (
                                <li key={svc.slug}>
                                  <Link
                                    href={`/services/${routeSlugForServiceLine(line.slug)}/${svc.slug}`}
                                    className="mega-nav__service-link"
                                    onClick={() => setOpen(null)}
                                  >
                                    <ServiceTag
                                      category={line.category}
                                      variant="icon"
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
                              href={`/services/${routeSlugForServiceLine(line.slug)}`}
                              className="mega-nav__view-all"
                              onClick={() => setOpen(null)}
                            >
                              View All
                            </Link>
                          </div>
                        ))}
                    </div>

                    {/* Webflow: .inner-wrapper.auto — Product promo card (5th column) */}
                    {(() => {
                      const productLine = serviceLines.find((l) => l.category === 'product');
                      return productLine?.imageUrl ? (
                      <div className="mega-nav__product-promo">
                        <div className="mega-nav__product-promo-media">
                          <Image
                            src={productLine.imageUrl}
                            alt="Product design"
                            width={200}
                            height={200}
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          />
                        </div>
                        <p className="mega-nav__product-promo-title">Need product design support?</p>
                        <p className="mega-nav__product-promo-desc">
                          From mobile apps to enterprise solutions, we create experiences that are
                          well-crafted, intuitive, and aligned with your business goals.
                        </p>
                        <Link
                          href="/services/product"
                          className={composeButtonClasses({ variant: 'primary', size: 'sm' })}
                          onClick={() => setOpen(null)}
                        >
                          Learn More
                        </Link>
                      </div>
                      ) : null;
                    })()}
                  </div>
                </div>
              )}
            </div>
            )}

            {/* Customers */}
            <div
              className="mega-nav__dropdown"
            >
              <button
                className={`mega-nav__toggle ${open === 'customers' ? 'mega-nav__toggle--active' : ''}`}
                onClick={() => toggle('customers')}
                aria-expanded={open === 'customers'}
              >
                Industries
                <ChevronDown />
              </button>

              {open === 'customers' && (
                <div className="mega-nav__panel mega-nav__panel--customers">
                  <div className="mega-nav__panel-inner mega-nav__panel-row">
                    {/* Webflow: .inner-wrapper.narrow — left intro */}
                    <div className="mega-nav__panel-intro">
                      <h3 className="mega-nav__panel-title">Industries We Serve</h3>
                      <p className="mega-nav__panel-desc">
                        Brik gives you access to senior-level design and strategic
                        support—without the full-time overhead.
                      </p>
                      <Link href="/customers" className={composeButtonClasses({ variant: 'primary', size: 'sm' })} onClick={() => setOpen(null)}>
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
                            href={`/customers/${ind.slug}`}
                            className="mega-nav__industry-card"
                            onClick={() => setOpen(null)}
                          >
                            <div className="mega-nav__industry-media">
                              {ind.imageUrl ? (
                                <Image src={ind.imageUrl} alt={ind.name} width={200} height={200} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              ) : (
                                <div style={{ width: '100%', height: '100%', backgroundColor: 'var(--surface-accent)' }} />
                              )}
                            </div>
                            <span className="mega-nav__industry-name">{ind.name}</span>
                            <span className="mega-nav__industry-tagline">{ind.tagline}</span>
                            <span className={composeButtonClasses({ variant: 'secondary', size: 'sm' })}>View Details <ArrowRight /></span>
                          </Link>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Results — plain link to customer stories */}
            <Link href="/customer-stories" className="mega-nav__toggle" onClick={() => setOpen(null)}>
              Results
            </Link>

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
                      <h3 className="mega-nav__panel-title">About</h3>
                      <p className="mega-nav__panel-desc">
                        Brik gives you access to senior-level design and strategic
                        support—without the full-time overhead.
                      </p>
                    </div>
                    {/* Webflow: .layout-nav-4-col-about — 3 cards with images */}
                    <div className="mega-nav__about-grid">
                      <AboutNavCard href="/about" image="/images/brik_designs_4x.webp" title="Meet Brik" desc="Learn about the company and the Brik team" cta="Learn More" onClick={() => setOpen(null)} />
                      <AboutNavCard href="/value" image="/images/value_of_design_4x.webp" title="The Value of Design" desc="Learn the value of design in four steps" cta="Learn More" onClick={() => setOpen(null)} />
                      <AboutNavCard href="/blog" image="/images/blogs_4x.webp" title="Blog" desc="Stories, insights, and lessons learned from building our business" cta="View Posts" onClick={() => setOpen(null)} />
                    </div>
                  </div>
                </div>
              )}
            </div>
            </div>
          </div>

          {/* Webflow: .nav-button-wrapper — CTA + mobile toggle, far right */}
          <div className="mega-nav__actions">
            <Link
              href="/contact"
              className={composeButtonClasses({ variant: 'primary', size: 'sm' })}
            >
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
          </div>{/* end mega-nav__right-group */}
        </div>
      </nav>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="mega-nav__mobile-menu">
          <Link href="/plans" className="mega-nav__mobile-link" onClick={() => setMobileOpen(false)}>Services</Link>
          {SHOW_DESIGN_SERVICES_NAV && (
            <Link href="/services" className="mega-nav__mobile-link" onClick={() => setMobileOpen(false)}>Design Services</Link>
          )}
          {serviceLines.map((line) => (
            <Link
              key={line.slug}
              href={`/services/${routeSlugForServiceLine(line.slug)}`}
              className="mega-nav__mobile-link mega-nav__mobile-link--indent"
              onClick={() => setMobileOpen(false)}
            >
              <ServiceTag category={line.category} variant="icon" size="sm" />
              {line.name}
            </Link>
          ))}
          <Link href="/industries" className="mega-nav__mobile-link" onClick={() => setMobileOpen(false)}>Industries</Link>
          <Link href="/customer-stories" className="mega-nav__mobile-link" onClick={() => setMobileOpen(false)}>Results</Link>
          <Link href="/about" className="mega-nav__mobile-link" onClick={() => setMobileOpen(false)}>About</Link>
          <Link href="/blog" className="mega-nav__mobile-link" onClick={() => setMobileOpen(false)}>Blog</Link>
          <Link
            href="/contact"
            className="mega-nav__mobile-link mega-nav__mobile-link--cta"
            onClick={() => setMobileOpen(false)}
          >
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
      <div className="mega-nav__about-card-media">
        <Image src={image} alt={title} width={400} height={400} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </div>
      <span className="mega-nav__about-card-title">{title}</span>
      <span className="mega-nav__about-card-desc">{desc}</span>
      <span className={composeButtonClasses({ variant: 'secondary', size: 'sm' })}>{cta} <ArrowRight /></span>
    </Link>
  );
}

/* Webflow: .dropdown-icon — exact SVG from source: 20x20 viewBox, strokeWidth 2.5 */
function ChevronDown() {
  return (
    <span className="mega-nav__chevron">
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path d="M5 7.5L10 12.5L15 7.5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
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
