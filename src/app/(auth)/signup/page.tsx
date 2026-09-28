import Link from 'next/link';

import { getT, localizedTitle } from '@/lib/i18n.server';

import { AuthShell } from '../AuthShell';
import { GoogleButton } from '../GoogleButton';
import { isGoogleEnabled } from '@/lib/auth-providers';
import { SignupForm } from './SignupForm';

export const generateMetadata = localizedTitle('إنشاء حساب — TechMood', 'Create an account — TechMood');

export default async function SignupPage() {
  const t = await getT();
  const google = await isGoogleEnabled();

  return (
    <AuthShell
      variant="signup"
      title={t('أنشئ حسابك في TechMood', 'Create your TechMood account')}
      lede={t('مجاني. بعدها تضيف صورتك (اختيارية) ومجالاتك واهتماماتك في دقيقتين.',
              'Free. Then you add your photo (optional), fields and interests in two minutes.')}
      footer={<>
        {t('لديك حساب؟ ', 'Already have an account? ')}
        <Link href="/login">{t('سجّل الدخول', 'Sign in')}</Link>
      </>}
    >
      <div className="au-card">
        {google && (
          <>
            <GoogleButton next="/onboarding" label={t('أنشئ حسابك عبر Google', 'Sign up with Google')} />
            <div className="auth-divider">
              <span>{t('أو بالبريد وكلمة المرور', 'or with email and password')}</span>
            </div>
          </>
        )}
        <SignupForm />
      </div>
    </AuthShell>
  );
}
