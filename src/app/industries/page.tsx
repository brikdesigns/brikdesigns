import type { Metadata } from 'next';
import Link from 'next/link';
import { getIndustryPages } from '@/lib/supabase/queries';
import '../shared-sections.css';
import './industries.css';

export const metadata: Metadata = {
  title: 'Industries | Who We Support',
  description: 'Brik Designs serves dental practices, real estate, SaaS companies, and small businesses with senior-level design and strategic support.',
};

export const revalidate = 86400;

export default async function IndustriesPage() {
  const industries = await getIndustryPages();

  return (
    <>
      <section className="page-hero">
        <div className="page-hero__container">
          <h1 className="page-hero__title">Who We Support</h1>
          <p className="page-hero__description">
            We specialize in industries where trust, credibility, and clear communication matter most.
          </p>
        </div>
      </section>

      <section className="content-section industries-section">
        <div className="container-lg container-lg--comfortable">
          <div className="industries-grid">
            {industries.map((ind) => (
              <Link key={ind.slug} href={`/industries/${ind.slug}`} className="industries-card">
                <h3 className="text-heading-md">{ind.name}</h3>
                {ind.tagline && (
                  <p className="text-body-md text--secondary">{ind.tagline}</p>
                )}
                <span className="bds-button bds-button--secondary bds-button--sm" style={{ alignSelf: 'flex-start', marginTop: 'auto' }}>
                  Learn More
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
