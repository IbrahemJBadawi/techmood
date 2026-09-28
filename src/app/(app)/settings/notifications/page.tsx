import Link from 'next/link';
import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';
import { getT } from '@/lib/i18n.server';

import { InstallApp } from '@/components/InstallApp';

import { DevicePush } from './DevicePush';

import { PreferencesForm, type Category } from './PreferencesForm';

export const metadata = { title: 'Notification settings — TechMood' };

export default async function NotificationSettingsPage() {
  const t = await getT();
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [{ data: categories }, { data: preferences }, { data: pushKey }] = await Promise.all([
    supabase.from('notification_categories')
      .select('kind, title_ar, detail_ar, in_app_default, email_default, push_default, is_mandatory, sort_order')
      .order('sort_order'),
    supabase.from('notification_preferences')
      .select('kind, in_app, email, push')
      .eq('profile_id', user.id),
    supabase.rpc('push_public_key'),
  ]);

  const chosen = new Map((preferences ?? []).map((row) => [row.kind, row]));

  const rows: Category[] = (categories ?? []).map((row) => ({
    kind: row.kind,
    title_ar: row.title_ar,
    detail_ar: row.detail_ar,
    is_mandatory: row.is_mandatory,
    in_app: chosen.get(row.kind)?.in_app ?? row.in_app_default,
    email: chosen.get(row.kind)?.email ?? row.email_default,
    push: chosen.get(row.kind)?.push ?? row.push_default,
  }));

  return (
    <>
      <section className="section-block">
        <div className="row-between">
          <h2 style={{ fontSize: '1.2rem' }}>{t('إعدادات الإشعارات', 'Notification settings')}</h2>
          <Link className="btn btn-ghost btn-sm" href="/notifications">{t('الإشعارات', 'Notifications')}</Link>
        </div>
        <p className="muted" style={{ fontSize: '0.9rem', marginTop: 6, maxWidth: '68ch' }}>
          {t('البريد ليس الإشعار — هو نسخة منه. ما يظهر داخل TechMood يبقى سجلّاً لما حدث، والبريد يُرسل حين يستحق النوع ذلك وتوافق أنت.',
             'Email is not the notification — it is a copy of one. What appears inside TechMood stays as the record of what happened; mail is sent when the category deserves it and you agree.')}
        </p>
      </section>

      <section className="section-block">
        <h3 style={{ fontSize: '0.98rem', marginBottom: 8 }}>{t('TechMood على هاتفك', 'TechMood on your phone')}</h3>
        <InstallApp variant="inline" />
        <div style={{ marginTop: 10 }}>
          <DevicePush publicKey={pushKey ?? null} />
        </div>
      </section>

      <section className="panel section-block">
        <PreferencesForm categories={rows} />
      </section>
    </>
  );
}
