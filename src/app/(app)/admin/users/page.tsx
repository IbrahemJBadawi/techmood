import Link from 'next/link';
import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';
import { getT, localizedTitle } from '@/lib/i18n.server';
import { ROLES, ROLE_BY_VALUE } from '@/lib/roles';
import type { UserRole } from '@/lib/database.types';

export const generateMetadata = localizedTitle('المستخدمون — إدارة TechMood', 'Users — TechMood admin');

/** Everyone, findable by name, username or TechMood ID, and by role. */
export default async function AdminUsersPage({ searchParams }: { searchParams: Promise<{ role?: string; q?: string }> }) {
  const params = await searchParams;
  const role = ROLES.some((item) => item.value === params.role) ? params.role as UserRole : null;
  const t = await getT();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: isAdmin } = await supabase.rpc('is_admin');
  if (!isAdmin) redirect('/home');

  const { data: users } = await supabase.rpc('admin_users', { p_role: role, p_query: params.q ?? null, p_limit: 200 });
  const date = new Intl.DateTimeFormat(t.locale === 'ar' ? 'ar-u-nu-latn' : 'en', { dateStyle: 'medium' });

  return (
    <>
      <section className="section-block">
        <h2 style={{ fontSize: '1.2rem' }}>{t('المستخدمون', 'Users')}</h2>
      </section>

      <form className="admin-inline-form section-block" action="/admin/users">
        {role && <input type="hidden" name="role" value={role} />}
        <input name="q" defaultValue={params.q ?? ''} placeholder={t('اسم، اسم مستخدم أو TechMood ID', 'Name, username or TechMood ID')} />
        <button className="btn btn-primary btn-sm" type="submit">{t('ابحث', 'Search')}</button>
      </form>

      <div className="tags-row section-block">
        <Link className={`chip${!role ? ' is-active' : ''}`} href="/admin/users">{t('الكل', 'All')}</Link>
        {ROLES.map((item) => (
          <Link key={item.value} className={`chip${role === item.value ? ' is-active' : ''}`} href={`/admin/users?role=${item.value}`}>
            {t(item.label)}
          </Link>
        ))}
      </div>

      <table className="data">
        <thead>
          <tr><th>{t('الشخص', 'Person')}</th><th>{t('الأدوار', 'Roles')}</th><th>{t('البلاغات عنه', 'Open reports')}</th><th>{t('انضم', 'Joined')}</th></tr>
        </thead>
        <tbody>
          {(users ?? []).map((row) => (
            <tr key={row.id}>
              <td>
                <Link href={`/admin/users/${row.id}`}>{row.full_name}</Link> <span className="id-chip">{row.techmood_id}</span>
                {row.restricted && <span className="status-pill status-danger" style={{ marginInlineStart: 6 }}>{t('مقيّد', 'Restricted')}</span>}
              </td>
              <td style={{ fontSize: '0.8rem' }}>{row.roles.map((value) => t(ROLE_BY_VALUE[value].label)).join(' · ')}</td>
              <td className="eng">{row.open_reports || '—'}</td>
              <td className="muted" style={{ fontSize: '0.8rem' }}>{date.format(new Date(row.created_at))}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
