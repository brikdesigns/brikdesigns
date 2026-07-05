/**
 * Server-side icon resolution helpers for the marketing site.
 *
 * BDS's `<ServiceTag>` resolves service-specific icons via
 * `getServiceIconPath(category, serviceName)`. That function lives in a
 * `'use client'` module and can't be called from Server Components — and
 * when a predicted icon file doesn't exist, the rendered `<img>` leaks the
 * native broken-image glyph through SSR before React hydrates.
 *
 * This module mirrors BDS's resolution logic just enough to PRE-CHECK
 * whether a predicted icon exists on disk, so Server Components can pass
 * `serviceName` only when an icon is guaranteed to render.
 *
 * Source of truth for the override map: `serviceIconOverrides` in
 * brik-bds/src/components/ui/ServiceBadge/ServiceBadge.tsx. Keep this list
 * in sync when BDS adds entries. (TODO: extract to a server-safe BDS
 * subpackage so this duplication can go away.)
 */

import fs from 'node:fs';
import path from 'node:path';
import type { ServiceLine } from '@brikdesigns/bds';

type IconManifest = Record<ServiceLine, Set<string>>;

const CATEGORIES: readonly ServiceLine[] = ['brand', 'marketing', 'information', 'product', 'back-office'];

function loadIconManifest(): IconManifest {
  const map = {} as IconManifest;
  for (const cat of CATEGORIES) {
    try {
      const files = fs.readdirSync(path.join(process.cwd(), 'public/icons', cat));
      map[cat] = new Set(files.filter((f) => f.endsWith('.svg')).map((f) => f.replace(/\.svg$/, '')));
    } catch (err) {
      // Empty manifest = `hasIconFor()` returns false for every name in this
      // category, which silently degrades icons to empty colored boxes (no
      // broken-image glyph leaks, but no service icons render either). The
      // common cause is a Netlify ISR Lambda env where `public/` isn't
      // present under `process.cwd()`. Surface the failure to logs so we
      // notice — silent degradation hid the original bug in this PR for days.
      const reason = err instanceof Error ? err.message : String(err);
      console.warn(`[service-icons] icon manifest unavailable for category=${cat} cwd=${process.cwd()} — ${reason}. All ServiceTag icons in this category will render without glyphs.`);
      map[cat] = new Set();
    }
  }
  return map;
}

const ICON_MANIFEST: IconManifest = loadIconManifest();

/**
 * Authoritative service-name → icon-basename map.
 *
 * Sourced from the Webflow CMS export's `Primary Badge` URL filenames
 * (Brik Designs - Services.csv) — those URLs encode the icon slug the
 * marketing team chose for each service. Some services share icons by
 * design (e.g., Presentation Design uses information-design.svg because
 * BDS has no dedicated presentation icon yet — confirmed 2026-05-11).
 *
 * Naming drift you'll see here vs the service name:
 * - "Mobile App Design" → product-design (no app-design icon, falls back
 *   to product line default)
 * - "Sales Resources" → info-sales-materials (CMS renamed; icon file kept
 *   original "materials" naming)
 * - "Software Automation Setup" → back-office-automated-workflow (category
 *   rename in BDS from "service" → "back-office" preserved file names)
 * - "Presentation Design" → information-design (line-level icon reused
 *   intentionally — no dedicated presentation icon shipped)
 *
 * Long-term TODO: this list lives here because BDS's canonical
 * `serviceIconOverrides` map (in a 'use client' module) can't be imported
 * server-side AND doesn't yet cover all the brikdesigns service variants.
 * Open follow-up: sync these entries into BDS, then delete this map.
 */
const SERVICE_ICON_OVERRIDES: Record<string, string> = {
  // ── Brand ────────────────────────────────────────────────────────────────
  'Brand Guidelines': 'brand-guidelines',
  'Brand Identity': 'brand-design',
  'Brand Identity Bundle': 'brand-design',
  'Email Signature': 'brand-email-signature',
  'Letterhead Stationary': 'brand-stationary',
  'Logo Design': 'brand-logo',
  'Logo Update': 'brand-logo',         // also in BDS canonical map
  'Online Business Listings': 'brand-listings',
  'Premium Logo Design': 'brand-logo', // also in BDS canonical map
  'Print Materials': 'info-print-design', // also in BDS canonical map
  'Standard Logo Design': 'brand-logo', // also in BDS canonical map

  // ── Marketing ────────────────────────────────────────────────────────────
  // BDS canonical names (& variants) — both must be here for SSR prediction
  // to match what BDS's getServiceIconPath() generates server-side.
  'Comprehensive Marketing Audit & Consultation': 'marketing-consulting',
  'Custom Large E-Commerce Web Development and Design': 'marketing-web-design',
  'Custom Large Web Development and Design': 'marketing-web-design',
  'Custom Standard E-Commerce Web Development and Design': 'marketing-web-design',
  'Custom Standard Web Development and Design': 'marketing-web-design',
  'Email Drip Campaign (Up to 6 Emails)': 'marketing-email',
  'Email Marketing': 'marketing-email',
  'Landing Pages': 'marketing-landing-pages',
  'Marketing Consulting': 'marketing-consulting',
  'Patient Experience Mapping': 'patient-experience',
  'Social Media Graphic Designs': 'marketing-social-graphics',
  'Social Media Graphics': 'marketing-social-graphics',
  'Swag and Merchandise Design': 'marketing-swag',
  'Swag & Merchandise Design': 'marketing-swag',
  'Web Design and Development': 'marketing-web-design',
  'Web Design & Development': 'marketing-web-design',
  'Website Experience Mapping': 'website-experience',

  // ── Information ──────────────────────────────────────────────────────────
  'Information Design': 'information-design',
  Infographics: 'info-infographics',
  'Intake Forms': 'info-intake-form',
  'Layout Design': 'info-layout-design',
  'Presentation Design': 'information-design',
  'Sales Resources': 'info-sales-materials',
  'Signage Design': 'info-signage',
  'Welcome Onboarding Kit': 'info-welcome-kit',

  // ── Product ──────────────────────────────────────────────────────────────
  'Content Design': 'product-content-design',
  'Design Systems': 'product-design-systems',
  'Mobile App Design': 'product-design',
  'SaaS and Enterprise Design': 'product-enterprise-design',

  // ── Back Office (service) ────────────────────────────────────────────────
  'Automated Workflow and AI Integration': 'back-office-automation-ai',
  'Automated Workflow & AI Integration': 'back-office-automation-ai',
  'CRM Setup and Data Cleanup': 'back-office-crm-data',
  'CRM Setup & Data Cleanup': 'back-office-crm-data',
  'Customer Journey Mapping': 'back-office-journey-mapping',
  'Digital File Organization': 'back-office-digital-file-organization',
  'Software Automation Setup': 'back-office-automated-workflow',
  'Software and Subscription Audit': 'back-office-audit',
  'Software & Subscription Audit': 'back-office-audit',
  'SOP Creation': 'back-office-sop-creation',
  'Standard Operating Procedures (SOP) Creation': 'back-office-sop-creation',
  'Training Setup & Organization': 'back-office-training-setup',
};

function predictedIconBasename(category: ServiceLine, serviceName: string): string {
  if (SERVICE_ICON_OVERRIDES[serviceName]) return SERVICE_ICON_OVERRIDES[serviceName];
  const normalized = serviceName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  if (category === 'information') {
    return `info-${normalized.replace('information-', '')}`;
  }
  return `${category}-${normalized.replace(`${category}-`, '')}`;
}

/** True iff a matching icon file exists on disk for the predicted BDS path. */
export function hasIconFor(category: ServiceLine, serviceName: string): boolean {
  return ICON_MANIFEST[category]?.has(predictedIconBasename(category, serviceName)) ?? false;
}

/** Service-line default icon (5 entries) — for places where BDS's per-service
 *  resolver can't run (e.g., a Server Component passing iconUrl to a blueprint).
 */
export const SERVICE_LINE_ICON: Record<ServiceLine, string> = {
  brand: '/icons/brand/brand-design.svg',
  marketing: '/icons/marketing/marketing-design.svg',
  information: '/icons/information/information-design.svg',
  product: '/icons/product/product-design.svg',
  'back-office': '/icons/service/back-office-design.svg',
  // @deprecated alias of 'back-office'. Icon dir is still `service/` until the
  // icon-asset dir rename follow-up.
  service: '/icons/service/back-office-design.svg',
};
