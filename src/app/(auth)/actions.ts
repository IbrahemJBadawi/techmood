'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';

import { createClient } from '@/lib/supabase/server';
import { isEnglishName, tidyName } from '@/lib/names';
import { siteOrigin } from '@/lib/site';
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

/**
 * A path inside TechMood, or nothing. `//evil.example` and `/\evil.example`
 * start with a slash too, and a browser follows them off the site.
 */
function safeNext(value: unknown): string | null {
  const next = String(value ?? '');
  return next.startsWith('/') && !next.startsWith('//') && !next.startsWith('/\\') ? next : null;
}

/** Where to go after Google, kept in a short-lived cookie so the return address stays exact. */
const AUTH_NEXT_COOKIE = 'tm-auth-next';

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
  const next = safeNext(formData.get('next')) ?? '/onboarding';

  // The return address carries no query string: Supabase only sends people
  // back to an address on its allow list, and an exact path is the one that
  // matches. Where to go afterwards rides in a cookie instead.
  const jar = await cookies();
  jar.set(AUTH_NEXT_COOKIE, next, { httpOnly: true, sameSite: 'lax', secure: true, path: '/', maxAge: 60 * 10 });

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${await siteOrigin()}/auth/callback`,
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
    email: String(formData.get('email') ?? '').trim(),
    password: String(formData.get('password') ?? ''),
  });

  if (error || !data.user) {
    return { error: authError(t, error?.message ?? '', error?.status) };
  }

  const next = safeNext(formData.get('next'));
  const landing = await landingFor(data.user.id);

  revalidatePath('/', 'layout');
  redirect(landing === '/onboarding' ? landing : next ?? '/home');
}

/**
 * Creating the account creates the identity and nothing else. Who you are on
 * the platform — handle, fields, interests, skills, the roles you are asking
 * for — is settled in onboarding, where each of those has room to be explained.
 */
export async function signup(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const t = await getT();
  const supabase = await createClient();

  const fullName = tidyName(String(formData.get('full_name') ?? ''));
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');
  const confirm = String(formData.get('password_confirm') ?? '');

  if (fullName.length < 2) {
    return { error: t('الرجاء إدخال الاسم الكامل.', 'Please enter your full name.') };
  }
  if (!isEnglishName(fullName)) {
    return { error: t('اكتب اسمك الكامل بالحروف الإنجليزية فقط — كما سيظهر على شهاداتك.',
                      'Write your full name in English letters only — as it will appear on your certificates.') };
  }
  if (password.length < 8) {
    return { error: t('كلمة المرور 8 أحرف على الأقل.', 'The password needs at least 8 characters.') };
  }
  if (password !== confirm) {
    return { error: t('كلمتا المرور غير متطابقتين — اكتبها مرة أخرى.', 'The two passwords do not match — type it again.') };
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName },
      // The confirmation email brings the person back here, not to Supabase's
      // default site URL — the callback exchanges the code for a session.
      emailRedirectTo: `${await siteOrigin()}/auth/callback`,
    },
  });

  if (error) {
    return { error: authError(t, error.message, error.status) };
  }

  // No confirmation email step (0107): when the auth server still holds the
  // session back, the account is already confirmed, so sign straight in.
  if (!data.session) {
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError) {
      return { error: authError(t, signInError.message, signInError.status) };
    }
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

/** What the auth server said, in words a person can act on. */
function authError(t: Awaited<ReturnType<typeof getT>>, message: string, status?: number): string {
  const m = message.toLowerCase();
  if (m.includes('invalid login credentials')) {
    return t('البريد أو كلمة المرور غير صحيحة.', 'The email or the password is wrong.');
  }
  if (m.includes('email not confirmed')) {
    return t('هذا الحساب لم يُفعَّل بعد — تواصل معنا لتفعيله.', 'This account is not active yet — contact us to activate it.');
  }
  if (m.includes('already registered') || m.includes('already been registered') || m.includes('already exists')) {
    return t('هذا البريد مسجّل بالفعل — سجّل الدخول بدلاً من ذلك.', 'That email is already registered — sign in instead.');
  }
  if (m.includes('password') && (m.includes('at least') || m.includes('weak') || m.includes('short'))) {
    return t('كلمة المرور ضعيفة — استخدم 8 أحرف على الأقل مع أرقام وحروف.', 'That password is too weak — use at least 8 characters with letters and numbers.');
  }
  if (m.includes('invalid') && m.includes('email')) {
    return t('صيغة البريد الإلكتروني غير صحيحة.', 'That email address is not valid.');
  }
  if (status === 429 || m.includes('rate limit')) {
    return t('محاولات كثيرة في وقت قصير — انتظر قليلاً ثم حاول مجدداً.', 'Too many attempts in a short time — wait a little and try again.');
  }
  if (m.includes('signups not allowed') || m.includes('signup is disabled')) {
    return t('التسجيل الجديد متوقف مؤقتاً.', 'New sign-ups are paused for now.');
  }
  return t('تعذّر إكمال العملية — حاول مرة أخرى.', 'That did not go through — please try again.');
}
