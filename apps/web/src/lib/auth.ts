import 'server-only';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import type { Actor } from '@database/client';
export function demoEnabled() {
  const db = process.env.DATABASE_URL ?? '';
  return (
    process.env.DEMO_MODE === 'true' &&
    process.env.NODE_ENV !== 'production' &&
    /^postgresql:\/\/[^@]+@(localhost|127\.0\.0\.1):/.test(db)
  );
}
export function authConfigured() {
  return !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}
export async function supabase() {
  const jar = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => jar.getAll(),
        setAll: (items) => {
          try {
            items.forEach(({ name, value, options }) => jar.set(name, value, options));
          } catch {
            /* Server Components cannot write cookies; proxy refreshes. */
          }
        },
      },
    },
  );
}
export async function currentActor(): Promise<Actor | null> {
  if (demoEnabled()) {
    const persona = (await cookies()).get('concloud_demo')?.value ?? 'admin';
    return {
      id:
        persona === 'client'
          ? '10000000-0000-4000-8000-000000000003'
          : persona === 'reviewer'
            ? '10000000-0000-4000-8000-000000000002'
            : '10000000-0000-4000-8000-000000000001',
      email: `${persona}@example.invalid`,
      aal: 'aal2',
    };
  }
  if (!authConfigured()) return null;
  const client = await supabase();
  const {
    data: { user },
    error,
  } = await client.auth.getUser();
  if (error || !user || !user.email) return null;
  const { data } = await client.auth.mfa.getAuthenticatorAssuranceLevel();
  return { id: user.id, email: user.email, aal: data?.currentLevel ?? 'aal1' };
}
export async function requireActor() {
  const actor = await currentActor();
  if (!actor) redirect('/login');
  return actor;
}
