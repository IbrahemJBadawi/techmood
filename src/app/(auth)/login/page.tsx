import Link from 'next/link';

import { getT } from '@/lib/i18n.server';
import { LanguagePicker } from '@/components/LanguagePicker';

import { GoogleButton } from '../GoogleButton';
import { LoginForm } from './LoginForm';
import { LogoMark } from '@/components/Logo';

export const metadata = { title: 'Sign in — TechMood' };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const t = await getT();
  const params = await searchParams;
  const next = params.next && params.next.startsWith('/') ? params.next : undefined;

  return (
    <main className="landing auth-page">
      <div className="row-between" style={{ paddingTop: 20 }}>
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, fontWeight: 700, textDecoration: 'none' }}>
          <LogoMark />
          TechMood
        </Link>
        <LanguagePicker current={t.locale} />
      </div>

      <h1 style={{ fontSize: '1.4rem', margin: '40px 0 6px' }}>
        {t('مرحباً بعودتك', 'Welcome back')}
      </h1>
      <p className="muted" style={{ fontSize: '0.9rem', marginBottom: 24 }}>
        {t('سجّل الدخول لمتابعة رحلتك في TechMood.', 'Sign in to carry on where you left off.')}
      </p>

      {params.error && (
        <p className="notice notice-danger" style={{ marginBottom: 14 }}>
          {t('تعذّر إكمال تسجيل الدخول — حاول مرة أخرى.', 'Sign-in could not be completed — please try again.')}
        </p>
      )}

      <div className="panel">
        <GoogleButton next={next ?? '/home'} label={t('تابع عبر Google', 'Continue with Google')} />

        <div className="auth-divider">
          <span>{t('أو بالبريد وكلمة المرور', 'or with email and password')}</span>
        </div>

        <LoginForm next={next} />
      </div>

      <p className="muted" style={{ fontSize: '0.86rem', marginTop: 16 }}>
        {t('ليس لديك حساب؟ ', 'No account yet? ')}
        <Link href="/signup" style={{ color: 'var(--royal-dark)' }}>
          {t('أنشئ حساباً', 'Create one')}
        </Link>
      </p>
    </main>
  );
}
