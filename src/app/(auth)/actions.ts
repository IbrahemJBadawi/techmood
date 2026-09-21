'use server';

import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';

import { createClient } from '@/lib/supabase/server';
import { isLocale, LOCALE_COOKIE } from '@/lib/i18n';
import { getT } from '@/lib/i18n.server';

export type AuthState = { error?: string } | undefined;

/**
 * Where a fresh session lands: onboarding first, the app once it is done.
 *
 * Signing in is also where the account's language is copied onto the cookie
 * that every render reads, so the choice follows the person to a new device
 * instead of starting over in Arabic.
 */
async function landingFor(userId: string): Promise<string> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('profiles')
    .select('onboarding_completed_at, language')
    .eq('id', userId)
    .single();

  if (isLocale(data?.language)) {
    const jar = await cookies();
    jar.set(LOCALE_COOKIE, data.language, {
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
    });
  }

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
  const t = await getT();
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
    return {
      error: t('تعذّر بدء الدخول عبر Google — مزوّد Google غير مفعّل بعد على هذا المشروع.',
               'Could not start Google sign-in — the Google provider is not enabled on this project yet.'),
    };
  }

  redirect(data.url);
}

export async function login(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const t = await getT();
  const supabase = await createClient();

  const { data, error } = await supabase.auth.signInWithPassword({
    email: String(formData.get('email') ?? ''),
    password: String(formData.get('password') ?? ''),
  });

  if (error || !data.user) {
    return {
      error: t('تعذّر تسجيل الدخول — تأكد من البريد وكلمة المرور.',
               'Could not sign you in — check the email and password.'),
    };
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
  const t = await getT();
  const supabase = await createClient();

  const fullName = String(formData.get('full_name') ?? '').trim();
  if (fullName.length < 2) {
    return { error: t('الرجاء إدخال الاسم الكامل.', 'Please enter your full name.') };
  }

  const { data, error } = await supabase.auth.signUp({
    email: String(formData.get('email') ?? ''),
    password: String(formData.get('password') ?? ''),
    options: { data: { full_name: fullName } },
  });

  if (error) {
    return {
      error: error.message.includes('already')
        ? t('هذا البريد مسجّل بالفعل.', 'That email is already registered.')
        : t('تعذّر إنشاء الحساب.', 'Could not create the account.'),
    };
  }

  if (!data.session) {
    // Email confirmation is on; there is nothing to redirect into yet.
    return {
      error: t('تم إنشاء الحساب — تحقّق من بريدك لتأكيد التسجيل ثم سجّل الدخول.',
               'Account created — check your email to confirm it, then sign in.'),
    };
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
