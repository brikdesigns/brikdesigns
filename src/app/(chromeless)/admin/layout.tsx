import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getAuthUser, isBrikAdmin } from '@/lib/auth';
import { SignOutButton } from '@/components/auth/SignOutButton';

export const metadata = {
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const authUser = await getAuthUser();

  if (!authUser) {
    redirect('/login');
  }

  if (!isBrikAdmin(authUser)) {
    redirect('/');
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: 'var(--page-secondary)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: 'var(--padding-md) var(--padding-xl)',
          backgroundColor: 'var(--surface-primary)',
          borderBottom: 'var(--border-width-md) solid var(--border-primary)',
        }}
      >
        <Link
          href="/admin"
          style={{
            fontFamily: 'var(--font-family-heading)',
            fontSize: 'var(--heading-tiny)',
            color: 'var(--text-primary)',
            textDecoration: 'none',
          }}
        >
          Brik Admin
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--gap-md)' }}>
          <span
            style={{
              fontFamily: 'var(--font-family-body)',
              fontSize: 'var(--body-sm)',
              color: 'var(--text-secondary)',
            }}
          >
            {authUser.profile.email}
          </span>
          <SignOutButton />
        </div>
      </header>
      <main
        style={{
          flex: 1,
          padding: 'var(--padding-xl)',
          maxWidth: '1280px',
          width: '100%',
          margin: '0 auto',
        }}
      >
        {children}
      </main>
    </div>
  );
}
