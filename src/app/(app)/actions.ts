'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';

import { createClient } from '@/lib/supabase/server';
import { ACTIVE_ROLE_COOKIE, ROLE_BY_VALUE } from '@/lib/roles';
import type { UserRole } from '@/lib/database.types';

/**
 * "Browse as" — and the whole point of it is that it is not a costume.
 *
 * The v23 prototype had a persona switcher that only showed a toast. This one
 * asks the database whether the role is actually approved, and refuses
 * otherwise; a pending role is listed in the menu so the person can see where
 * their request stands, but selecting it changes nothing.
 */
export async function switchRole(formData: FormData) {
  const role = String(formData.get('role') ?? '') as UserRole;
  if (!ROLE_BY_VALUE[role]) return;

  const supabase = await createClient();
  const { data: allowed } = await supabase.rpc('can_enter_role', { p_role: role });
  if (!allowed) return;

  const jar = await cookies();
  jar.set(ACTIVE_ROLE_COOKIE, role, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
  });

  revalidatePath('/', 'layout');
  redirect(ROLE_BY_VALUE[role].home);
}
