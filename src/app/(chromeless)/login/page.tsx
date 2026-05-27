import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { LoginForm } from '@/components/auth/LoginForm';
import { getAuthUser, isBrikAdmin } from '@/lib/auth';

export const metadata: Metadata = {
  title: 'Sign In',
  robots: { index: false, follow: false },
};

export default async function LoginPage() {
  const authUser = await getAuthUser();
  if (isBrikAdmin(authUser)) {
    redirect('/admin');
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--surface-secondary)',
        padding: 'var(--padding-lg)',
      }}
    >
      <div
        style={{
          backgroundColor: 'var(--surface-primary)',
          borderRadius: 'var(--border-radius-lg)',
          padding: 'var(--padding-huge)',
          width: '100%',
          maxWidth: '420px',
          boxShadow: 'var(--shadow-md)',
        }}
      >
        <h1
          style={{
            fontFamily: 'var(--font-family-heading)',
            fontSize: 'var(--heading-md)',
            color: 'var(--text-primary)',
            margin: '0 0 var(--gap-xs)',
          }}
        >
          Brik Admin
        </h1>
        <p
          style={{
            fontFamily: 'var(--font-family-body)',
            fontSize: 'var(--body-md)',
            color: 'var(--text-secondary)',
            margin: '0 0 var(--gap-xl)',
          }}
        >
          Sign in to manage marketing content.
        </p>

        <Suspense fallback={null}>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
