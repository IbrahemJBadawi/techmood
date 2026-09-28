import Link from 'next/link';
import { redirect } from 'next/navigation';

import { ActionForm } from '@/components/ActionForm';
import { createClient } from '@/lib/supabase/server';
import { getT, localizedTitle } from '@/lib/i18n.server';

import { setAdmin } from '../sections-actions';

export const generateMetadata = localizedTitle('المشرفون والصلاحيات — إدارة TechMood', 'Admins & permissions — TechMood admin');

const AUDIT_FILTERS = [
  { key: '', label: { ar: 'الكل', en: 'All' } },
  { key: 'case_action:', label: { ar: 'إجراءات القضايا', en: 'Case actions' } },
  { key: 'admin_', label: { ar: 'صلاحيات الإدارة', en: 'Admin grants' } },
  { key: 'ai_thread_read', label: { ar: 'الاطلاع على محادثات المساعد', en: 'AI conversations read' } },
  { key: 'update', label: { ar: 'تعديلات الصفوف', en: 'Row changes' } },
] as const;

/**
 * Who administers TechMood, and everything they did. Admins are made by
 * admins, with a reason; nobody removes their own role, so the platform is
 * never left without one (0087).
 */
export default async function AdminPermissionsPage({ searchParams }: { searchParams: Promise<{ audit?: string }> }) {
  const { audit: raw } = await searchParams;
  const audit = AUDIT_FILTERS.some((item) => item.key === raw) ? raw! : '';
  const t = await getT();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: isAdmin } = await supabase.rpc('is_admin');
  if (!isAdmin) redirect('/home');

  const [{ data: team }, { data: trail }] = await Promise.all([
    supabase.rpc('admin_team'),
    supabase.rpc('admin_audit_trail', { p_action: audit || null, p_limit: 200 }),
  ]);
  const date = new Intl.DateTimeFormat(t.locale === 'ar' ? 'ar-u-nu-latn' : 'en', { dateStyle: 'medium' });
  const time = new Intl.DateTimeFormat(t.locale === 'ar' ? 'ar-u-nu-latn' : 'en', { dateStyle: 'short', timeStyle: 'short' });

  return (
    <>
      <section className="section-block">
        <h2 style={{ fontSize: '1.2rem' }}>{t('الإدارة والصلاحيات', 'Admins & permissions')}</h2>
        <p className="muted" style={{ fontSize: '0.86rem', marginTop: 6, maxWidth: '72ch' }}>
          {t('صلاحية الإدارة تُمنح وتُسحب من مدير آخر، بسبب مكتوب يُحفظ في سجل التدقيق. لا يسحب أحد صلاحيته بنفسه، فلا تبقى المنصة بلا مدير. الصلاحية اليوم واحدة لكل المديرين — لا أدوار إدارية جزئية بعد.',
             'Admin is granted and removed by another admin, with a written reason kept in the audit log. Nobody removes their own role, so the platform is never left without an admin. Today it is one permission for every admin — there are no partial admin roles yet.')}
        </p>
      </section>

      <section className="detail-grid section-block">
        <div className="panel">
          <h3 style={{ fontSize: '0.98rem', marginBottom: 10 }}>{t('فريق الإدارة', 'The admin team')}</h3>
          <table className="data">
            <tbody>
              {(team ?? []).map((row) => (
                <tr key={row.profile_id}>
                  <td>
                    <Link href={`/admin/users/${row.profile_id}`}>{row.full_name}</Link> <span className="id-chip">{row.techmood_id}</span>
                    <div className="muted" style={{ fontSize: '0.76rem' }}>
                      {t('منذ ', 'Since ')}{date.format(new Date(row.since))}{row.granted_by && <>{t(' — منحها ', ' — granted by ')}{row.granted_by}</>}
                    </div>
                  </td>
                  <td><span className={`status-pill ${row.status === 'approved' ? 'status-ok' : 'status-muted'}`}>{row.status === 'approved' ? t('مدير', 'Admin') : t('موقوف', 'Suspended')}</span></td>
                  <td>
                    {row.profile_id !== user.id && (
                      <ActionForm
                        action={setAdmin}
                        className="admin-inline-form"
                        variant="ghost"
                        submitLabel={row.status === 'approved' ? t('اسحب الصلاحية', 'Remove admin') : t('أعد الصلاحية', 'Restore admin')}
                        confirm={row.status === 'approved' ? t('سحب صلاحية الإدارة من هذا الحساب؟', 'Remove admin from this account?') : undefined}
                      >
                        <input type="hidden" name="profile_id" value={row.profile_id} />
                        <input type="hidden" name="grant" value={row.status === 'approved' ? 'no' : 'yes'} />
                        <input name="reason" required placeholder={t('السبب', 'Reason')} />
                      </ActionForm>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="panel">
          <h3 style={{ fontSize: '0.98rem', marginBottom: 10 }}>{t('منح صلاحية الإدارة', 'Grant admin')}</h3>
          <ActionForm action={setAdmin} className="stack" submitLabel={t('امنح الصلاحية', 'Grant admin')} confirm={t('منح صلاحية الإدارة الكاملة لهذا الحساب؟', 'Give this account full admin rights?')}>
            <input type="hidden" name="grant" value="yes" />
            <input name="techmood_id" required placeholder="TechMood ID" className="eng" />
            <input name="reason" required placeholder={t('السبب', 'Reason')} />
          </ActionForm>
        </div>
      </section>

      <section className="section-block">
        <h3 className="academy-heading">{t('سجل التدقيق', 'Audit log')}</h3>
        <div className="tags-row" style={{ marginBottom: 10 }}>
          {AUDIT_FILTERS.map((item) => (
            <Link key={item.key} className={`chip${item.key === audit ? ' is-active' : ''}`} href={`/admin/permissions${item.key ? `?audit=${item.key}` : ''}`}>{t(item.label)}</Link>
          ))}
        </div>
        <table className="data">
          <thead><tr><th>{t('الوقت', 'When')}</th><th>{t('من', 'Who')}</th><th>{t('ماذا', 'What')}</th><th>{t('على', 'On')}</th></tr></thead>
          <tbody>
            {(trail ?? []).map((row, index) => (
              <tr key={index}>
                <td className="muted" style={{ fontSize: '0.8rem' }}>{time.format(new Date(row.at))}</td>
                <td>{row.actor_name ?? t('النظام', 'System')}</td>
                <td>
                  <span className="eng" style={{ fontSize: '0.82rem' }}>{row.action}</span>
                  {row.detail && typeof row.detail.reason === 'string' && <div className="muted" style={{ fontSize: '0.76rem' }}>{row.detail.reason}</div>}
                </td>
                <td className="eng muted" style={{ fontSize: '0.78rem' }}>{row.entity_table}{row.entity_id ? ` · ${row.entity_id.slice(0, 8)}` : ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}
