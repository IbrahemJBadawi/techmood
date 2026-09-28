import Link from 'next/link';

import { getT } from '@/lib/i18n.server';

import { AuthShell } from '../AuthShell';
import { GoogleButton } from '../GoogleButton';
import { isGoogleEnabled } from '@/lib/auth-providers';
import { LoginForm } from './LoginForm';

export const metadata = { title: 'Sign in — TechMood' };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const t = await getT();
  const google = await isGoogleEnabled();
  const params = await searchParams;
  const next = params.next && params.next.startsWith('/') ? params.next : undefined;

  return (
    <AuthShell
      variant="login"
      title={t('مرحباً بعودتك', 'Welcome back')}
      lede={t('سجّل الدخول لمتابعة رحلتك في TechMood.', 'Sign in to carry on where you left off.')}
      footer={<>
        {t('ليس لديك حساب؟ ', 'No account yet? ')}
        <Link href="/signup">{t('أنشئ حساباً مجاناً', 'Create one — it is free')}</Link>
      </>}
    >
      {params.error && (
        <p className="notice notice-danger" style={{ marginBottom: 14 }}>
          {t('تعذّر إكمال تسجيل الدخول — حاول مرة أخرى.', 'Sign-in could not be completed — please try again.')}
        </p>
      )}

      <div className="au-card">
        {google && (
          <>
            <GoogleButton next={next ?? '/home'} label={t('تابع عبر Google', 'Continue with Google')} />
            <div className="auth-divider">
              <span>{t('أو بالبريد وكلمة المرور', 'or with email and password')}</span>
            </div>
          </>
        )}
        <LoginForm next={next} />
      </div>
    </AuthShell>
  );
}
