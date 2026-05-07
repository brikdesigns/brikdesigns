import { cache } from 'react';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';

export type SystemRole = 'super_admin' | 'client';

export interface AuthUser {
  user: User;
  profile: {
    id: string;
    role: SystemRole;
    email: string | null;
    full_name: string | null;
  };
}

async function getAuthUserUncached(supabase?: SupabaseClient): Promise<AuthUser | null> {
  const client = supabase ?? (await createClient());
  const {
    data: { user },
  } = await client.auth.getUser();

  if (!user) return null;

  const { data: profile } = await client
    .from('profiles')
    .select('id, role, email, full_name')
    .eq('id', user.id)
    .single();

  if (!profile) return null;

  return { user, profile: profile as AuthUser['profile'] };
}

export const getAuthUser = cache(getAuthUserUncached);

export function isBrikAdmin(authUser: AuthUser | null): boolean {
  return authUser?.profile.role === 'super_admin';
}
