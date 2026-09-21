import { cookies } from 'next/headers';
import { NextResponse, type NextRequest } from 'next/server';

import { createClient } from '@/lib/supabase/server';
import { isLocale, LOCALE_COOKIE } from '@/lib/i18n';

/**
 * Exchanges an auth code for a session — used by email confirmation and by
 * Continue with Google alike.
 *
 * A first-time Google account arrives here with a profile the database trigger
 * has just created and nothing filled in, so it goes to onboarding; a returning
 * one goes wherever it was headed.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/home';

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=auth`);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user) {
    return NextResponse.redirect(`${origin}/login?error=auth`);
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('onboarding_completed_at, language')
    .eq('id', data.user.id)
    .single();

  if (isLocale(profile?.language)) {
    const jar = await cookies();
    jar.set(LOCALE_COOKIE, profile.language, {
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
    });
  }

  if (!profile?.onboarding_completed_at) {
    return NextResponse.redirect(`${origin}/onboarding`);
  }

  return NextResponse.redirect(`${origin}${next.startsWith('/') ? next : '/home'}`);
}
