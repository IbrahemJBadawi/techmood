import Link from 'next/link';

import { getT } from '@/lib/i18n.server';
import { LanguagePicker } from '@/components/LanguagePicker';

import { GoogleButton } from '../GoogleButton';
import { SignupForm } from './SignupForm';

export const metadata = { title: 'Create an account — TechMood' };

export default async function SignupPage() {
  const t = await getT();

  return (
    <main className="landing auth-page">
      <div className="row-between" style={{ paddingTop: 20 }}>
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, fontWeight: 700, textDecoration: 'none' }}>
          <span className="logo-mark" />
          TechMood
        </Link>
        <LanguagePicker current={t.locale} />
      </div>

      <h1 style={{ fontSize: '1.4rem', margin: '40px 0 6px' }}>
        {t('أنشئ حسابك في TechMood', 'Create your TechMood account')}
      </h1>
      <p className="muted" style={{ fontSize: '0.9rem', marginBottom: 24 }}>
        {t('حساب واحد → معرّف TechMood واحد → هوية مهنية واحدة. الأدوار والمجالات والمهارات تأتي في الخطوة التالية، وليس الآن.',
           'One account → one TechMood ID → one professional identity. Roles, fields and skills come in the next step, not here.')}
      </p>

      <div className="panel">
        <GoogleButton next="/onboarding" label={t('أنشئ حسابك عبر Google', 'Sign up with Google')} />

        <div className="auth-divider">
          <span>{t('أو بالبريد وكلمة المرور', 'or with email and password')}</span>
        </div>

        <SignupForm />
      </div>

      <p className="muted" style={{ fontSize: '0.86rem', marginTop: 16 }}>
        {t('لديك حساب؟ ', 'Already have an account? ')}
        <Link href="/login" style={{ color: 'var(--royal-dark)' }}>{t('سجّل الدخول', 'Sign in')}</Link>
      </p>
    </main>
  );
}
