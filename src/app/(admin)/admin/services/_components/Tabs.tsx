'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';

const TABS = [
  { id: 'lines', label: 'Service lines' },
  { id: 'services', label: 'Services' },
  { id: 'offerings', label: 'Offerings' },
] as const;

type TabId = (typeof TABS)[number]['id'];

export function ServicesTabs({ active }: { active: TabId }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function hrefFor(id: TabId) {
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', id);
    return `${pathname}?${params.toString()}`;
  }

  return (
    <div
      role="tablist"
      style={{
        display: 'flex',
        gap: 'var(--gap-md)',
        borderBottom: 'var(--border-width-md) solid var(--border-primary)',
        marginBottom: 'var(--gap-lg)',
      }}
    >
      {TABS.map((tab) => {
        const isActive = tab.id === active;
        return (
          <Link
            key={tab.id}
            href={hrefFor(tab.id)}
            role="tab"
            aria-selected={isActive}
            style={{
              fontFamily: 'var(--font-family-label)',
              fontSize: 'var(--label-md)',
              color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
              padding: 'var(--padding-sm) var(--padding-md)',
              borderBottom: isActive
                ? 'var(--border-width-lg) solid var(--text-link)'
                : 'var(--border-width-lg) solid transparent',
              marginBottom: 'calc(var(--border-width-md) * -1)',
              textDecoration: 'none',
            }}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
