'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';

import { createClient } from '@/lib/supabase/server';

export type AuthState = { error?: string } | undefined;

/** Where a fresh session lands: onboarding first, the app once it is done. */
async function landingFor(userId: string): Promise<string> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('profiles')
    .select('onboarding_completed_at')
    .eq('id', userId)
    .single();

  return data?.onboarding_completed_at ? '/home' : '/onboarding';
}

async function siteOrigin(): Promise<string> {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return explicit.replace(/\/$/, '');

  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host');
  const proto = h.get('x-forwarded-proto') ?? 'https';
  return `${proto}://${host}`;
}

/**
 * Continue with Google.
 *
 * Google is used to sign in, nothing more: TechMood never asks it for contacts,
 * calendars or drive, and the profile it creates is TechMood's own.
 *
 * This needs the Google provider switched on in the Supabase dashboard with an
 * OAuth client from Google Cloud. Until that is done the call comes back with a
 * provider error, and the message below says so rather than pretending.
 */
export async function signInWithGoogle(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const supabase = await createClient();
  const next = String(formData.get('next') ?? '') || '/onboarding';

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${await siteOrigin()}/auth/callback?next=${encodeURIComponent(next)}`,
      queryParams: { prompt: 'select_account' },
    },
  });

  if (error || !data?.url) {
    return { error: 'تعذّر بدء الدخول عبر Google — مزوّد Google غير مفعّل بعد على هذا المشروع.' };
  }

  redirect(data.url);
}

export async function login(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const supabase = await createClient();

  const { data, error } = await supabase.auth.signInWithPassword({
    email: String(formData.get('email') ?? ''),
    password: String(formData.get('password') ?? ''),
  });

  if (error || !data.user) {
    return { error: 'تعذّر تسجيل الدخول — تأكد من البريد وكلمة المرور.' };
  }

  const next = String(formData.get('next') ?? '');
  const landing = await landingFor(data.user.id);

  revalidatePath('/', 'layout');
  redirect(landing === '/onboarding' ? landing : next || '/home');
}

/**
 * Creating the account creates the identity and nothing else. Who you are on
 * the platform — handle, fields, interests, skills, the roles you are asking
 * for — is settled in onboarding, where each of those has room to be explained.
 */
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

  if (!data.session) {
    // Email confirmation is on; there is nothing to redirect into yet.
    return { error: 'تم إنشاء الحساب — تحقّق من بريدك لتأكيد التسجيل ثم سجّل الدخول.' };
  }

  revalidatePath('/', 'layout');
  redirect('/onboarding');
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath('/', 'layout');
  redirect('/');
}
