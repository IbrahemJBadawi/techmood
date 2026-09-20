import Link from 'next/link';

import { GoogleButton } from '../GoogleButton';
import { LoginForm } from './LoginForm';

export const metadata = { title: 'تسجيل الدخول — TechMood' };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const params = await searchParams;
  const next = params.next && params.next.startsWith('/') ? params.next : undefined;

  return (
    <main className="landing auth-page">
      <h1 style={{ fontSize: '1.4rem', margin: '48px 0 6px' }}>مرحباً بعودتك</h1>
      <p className="muted" style={{ fontSize: '0.9rem', marginBottom: 24 }}>
        سجّل الدخول لمتابعة رحلتك في TechMood.
      </p>

      {params.error && (
        <p className="notice notice-danger" style={{ marginBottom: 14 }}>
          تعذّر إكمال تسجيل الدخول — حاول مرة أخرى.
        </p>
      )}

      <div className="panel">
        <GoogleButton next={next ?? '/home'} label="تابع عبر Google" />

        <div className="auth-divider"><span>أو بالبريد وكلمة المرور</span></div>

        <LoginForm next={next} />
      </div>

      <p className="muted" style={{ fontSize: '0.86rem', marginTop: 16 }}>
        ليس لديك حساب؟ <Link href="/signup" style={{ color: 'var(--royal-dark)' }}>أنشئ حساباً</Link>
      </p>
    </main>
  );
}
