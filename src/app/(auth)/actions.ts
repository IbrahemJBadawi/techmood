'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';

import { createClient } from '@/lib/supabase/server';
import { SELECTABLE_ROLES } from '@/lib/roles';
import type { UserRole } from '@/lib/database.types';

export type AuthState = { error?: string } | undefined;

export async function login(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({
    email: String(formData.get('email') ?? ''),
    password: String(formData.get('password') ?? ''),
  });

  if (error) {
    return { error: 'تعذّر تسجيل الدخول — تأكد من البريد وكلمة المرور.' };
  }

  revalidatePath('/', 'layout');
  redirect('/home');
}

export async function signup(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const supabase = await createClient();

  const fullName = String(formData.get('full_name') ?? '').trim();
  if (fullName.length < 2) {
    return { error: 'الرجاء إدخال الاسم الكامل.' };
  }

  const { data, error } = await supabase.auth.signUp({
    email: String(formData.get('email') ?? ''),
    password: String(formData.get('password') ?? ''),
    options: { data: { full_name: fullName } },
  });

  if (error) {
    return { error: error.message.includes('already') ? 'هذا البريد مسجّل بالفعل.' : 'تعذّر إنشاء الحساب.' };
  }

  // The database trigger already created the profile and the approved student
  // role. Anything else the person asked for is filed for review.
  const extraRoles = formData
    .getAll('roles')
    .map(String)
    .filter((role): role is UserRole => role !== 'student' && SELECTABLE_ROLES.some((r) => r.value === role));

  if (data.user && extraRoles.length > 0) {
    await supabase
      .from('profile_roles')
      .insert(extraRoles.map((role) => ({ profile_id: data.user!.id, role, status: 'pending_review' as const })));
  }

  if (!data.session) {
    // Email confirmation is on; there is nothing to redirect into yet.
    return { error: 'تم إنشاء الحساب — تحقّق من بريدك لتأكيد التسجيل ثم سجّل الدخول.' };
  }

  revalidatePath('/', 'layout');
  redirect('/home');
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath('/', 'layout');
  redirect('/');
}

/** Ask for an additional role on an existing account. */
export async function requestRole(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const role = String(formData.get('role') ?? '') as UserRole;
  if (role === 'admin' || !SELECTABLE_ROLES.some((r) => r.value === role)) return;

  await supabase.from('profile_roles').insert({
    profile_id: user.id,
    role,
    status: 'pending_review',
    application_note: String(formData.get('note') ?? '').slice(0, 1000) || null,
    evidence_url: String(formData.get('evidence_url') ?? '').slice(0, 500) || null,
  });

  revalidatePath('/passport');
}
