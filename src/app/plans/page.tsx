import type { Metadata } from 'next';
import { PlanTabs } from '@/components/marketing/PlanTabs';

export const metadata: Metadata = {
  title: 'Support Plans',
  description: 'Monthly subscription plans for ongoing marketing, design, and back-office support.',
};

// TODO: Replace with getSupportPlans() from Supabase
const plans = [
  {
    name: 'Marketing Support',
    slug: 'marketing-support',
    monthlyPrice: '$1,250',
    annualPrice: '$13,500',
    description: 'We act as your marketing department — handling everything from campaigns and emails to graphics and strategy.',
    features: ['Web design & updates', 'Email marketing', 'Social media graphics', 'Landing pages', 'Marketing strategy'],
    discount: '10% discount',
  },
  {
    name: 'Back-Office Support',
    slug: 'back-office-support',
    monthlyPrice: '$1,250',
    annualPrice: '$13,500',
    description: 'We handle the behind-the-scenes work — SOPs, file organization, CRM setup, and process automation.',
    features: ['SOP creation', 'File organization', 'CRM setup & cleanup', 'Automation & AI', 'Software audits'],
    discount: '10% discount',
  },
  {
    name: 'Product Support',
    slug: 'product-support',
    monthlyPrice: '$2,500',
    annualPrice: '$27,000',
    description: 'Ongoing product design — UX/UI, design systems, and development for SaaS, apps, and digital products.',
    features: ['UX/UI design', 'Design systems', 'Prototyping', 'Mobile & web apps', 'Content design'],
    discount: '10% discount',
    highlighted: true,
  },
];

export default function PlansPage() {
  return (
    <>
      <section style={{ maxWidth: 1200, margin: '0 auto', padding: 'var(--padding-xl) var(--padding-lg)' }}>
        <div style={{ textAlign: 'center', marginBottom: 'var(--gap-xl)' }}>
          <h1 style={{ fontFamily: 'var(--font-family-heading)', fontSize: 'var(--heading-xl)', color: 'var(--text-primary)', margin: 0 }}>
            Support Plans
          </h1>
          <p style={{ fontFamily: 'var(--font-family-body)', fontSize: 'var(--body-lg)', color: 'var(--text-secondary)', marginTop: 'var(--gap-md)', maxWidth: 700, marginLeft: 'auto', marginRight: 'auto' }}>
            Get an experienced, done-for-you team to manage your marketing, back-office systems, or product design — without the cost of full-time hires. We plug in where you need us most, handling the day-to-day so you can focus on what you do best.
          </p>
        </div>

        <PlanTabs plans={plans} />
      </section>
    </>
  );
}
