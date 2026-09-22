import Link from 'next/link';
import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';
import { getT } from '@/lib/i18n.server';

import { PreferencesForm, type Category } from './PreferencesForm';

export const metadata = { title: 'Notification settings — TechMood' };

export default async function NotificationSettingsPage() {
  const t = await getT();
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [{ data: categories }, { data: preferences }] = await Promise.all([
    supabase.from('notification_categories')
      .select('kind, title_ar, detail_ar, in_app_default, email_default, is_mandatory, sort_order')
      .order('sort_order'),
    supabase.from('notification_preferences')
      .select('kind, in_app, email')
      .eq('profile_id', user.id),
  ]);

  const chosen = new Map((preferences ?? []).map((row) => [row.kind, row]));

  const rows: Category[] = (categories ?? []).map((row) => ({
    kind: row.kind,
    title_ar: row.title_ar,
    detail_ar: row.detail_ar,
    is_mandatory: row.is_mandatory,
    in_app: chosen.get(row.kind)?.in_app ?? row.in_app_default,
    email: chosen.get(row.kind)?.email ?? row.email_default,
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

      <section className="panel section-block">
        <PreferencesForm categories={rows} />
      </section>
    </>
  );
}
