import Link from 'next/link';

import { GoogleButton } from '../GoogleButton';
import { SignupForm } from './SignupForm';

export const metadata = { title: 'إنشاء حساب — TechMood' };

export default function SignupPage() {
  return (
    <main className="landing auth-page">
      <h1 style={{ fontSize: '1.4rem', margin: '48px 0 6px' }}>أنشئ حسابك في TechMood</h1>
      <p className="muted" style={{ fontSize: '0.9rem', marginBottom: 24 }}>
        حساب واحد → معرّف TechMood واحد → هوية مهنية واحدة. الأدوار والمجالات
        والمهارات تأتي في الخطوة التالية، وليس الآن.
      </p>

      <div className="panel">
        <GoogleButton next="/onboarding" label="أنشئ حسابك عبر Google" />

        <div className="auth-divider"><span>أو بالبريد وكلمة المرور</span></div>

        <SignupForm />
      </div>

      <p className="muted" style={{ fontSize: '0.86rem', marginTop: 16 }}>
        لديك حساب؟ <Link href="/login" style={{ color: 'var(--royal-dark)' }}>سجّل الدخول</Link>
      </p>
    </main>
  );
}
