import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';
import { ROLE_STATUS_LABEL, ROLE_STATUS_TONE, roleLabel } from '@/lib/roles';
import type { RoleStatus, UserRole } from '@/lib/database.types';

import { RequestReview } from './RequestReview';

export const metadata = { title: 'طلبات الأدوار — TechMood' };

const OPEN: RoleStatus[] = ['pending_review', 'needs_more_info'];

export default async function RoleRequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: isAdmin } = await supabase.rpc('can_enter_role', { p_role: 'admin' });
  if (!isAdmin) redirect('/home');

  const params = await searchParams;
  const filter = params.status === 'all' ? null : (params.status as RoleStatus | undefined) ?? null;

  let query = supabase
    .from('profile_roles')
    .select('id, profile_id, role, status, application_note, evidence_url, review_note, created_at')
    .neq('role', 'student')
    .order('created_at', { ascending: false });

  if (filter) {
    query = query.eq('status', filter);
  } else if (params.status !== 'all') {
    query = query.in('status', OPEN);
  }

  const { data: requests } = await query;
  const rows = requests ?? [];

  const profileIds = [...new Set(rows.map((row) => row.profile_id))];
  const { data: profiles } = profileIds.length
    ? await supabase
        .from('profiles')
        .select('id, techmood_id, full_name, display_name, username, country, city, headline')
        .in('id', profileIds)
    : { data: [] };

  const mentorIds = rows.filter((row) => row.role === 'mentor').map((row) => row.profile_id);
  const { data: mentorApplications } = mentorIds.length
    ? await supabase
        .from('mentor_profiles')
        .select('profile_id, domains, years_experience, weekly_hours, motivation_ar, experience_ar, linkedin_url, portfolio_url, languages')
        .in('profile_id', mentorIds)
    : { data: [] };

  const byProfile = new Map((profiles ?? []).map((row) => [row.id, row]));
  const byMentor = new Map((mentorApplications ?? []).map((row) => [row.profile_id, row]));

  return (
    <>
      <section className="section-block row-between">
        <div>
          <h1 style={{ fontSize: '1.2rem', marginBottom: 4 }}>طلبات الأدوار</h1>
          <p className="muted" style={{ fontSize: '0.88rem' }}>
            رفض الطلب لا يُلغي الحساب — الشخص يبقى طالباً ويستطيع التقدّم مرة أخرى.
          </p>
        </div>
        <nav className="tags-row">
          {[
            { key: undefined, label: 'المفتوحة' },
            { key: 'pending_review', label: 'قيد المراجعة' },
            { key: 'needs_more_info', label: 'بانتظار المتقدّم' },
            { key: 'all', label: 'الكل' },
          ].map((tab) => (
            <a
              key={tab.label}
              className={`tag${(params.status ?? undefined) === tab.key ? ' is-on' : ''}`}
              href={tab.key ? `/admin/role-requests?status=${tab.key}` : '/admin/role-requests'}
            >
              {tab.label}
            </a>
          ))}
        </nav>
      </section>

      {rows.length === 0 && <p className="panel muted">لا طلبات في هذه القائمة.</p>}

      <div className="stack">
        {rows.map((row) => {
          const applicant = byProfile.get(row.profile_id);
          const mentor = row.role === 'mentor' ? byMentor.get(row.profile_id) : undefined;
          const status = row.status as RoleStatus;

          return (
            <article className="panel" key={row.id}>
              <div className="row-between">
                <div>
                  <h2 style={{ fontSize: '1rem' }}>
                    {applicant?.display_name ?? applicant?.full_name ?? '—'}
                    <span className="muted" style={{ fontWeight: 400 }}>
                      {' '}يطلب دور {roleLabel(row.role as UserRole)}
                    </span>
                  </h2>
                  <p className="muted" style={{ fontSize: '0.82rem' }}>
                    <span className="id-chip">{applicant?.techmood_id}</span>
                    {applicant?.username ? ` @${applicant.username}` : ''}
                    {applicant?.city ? ` — ${applicant.city}` : ''}
                    {applicant?.country ? `، ${applicant.country}` : ''}
                  </p>
                </div>
                <span className={`pill pill-${ROLE_STATUS_TONE[status]}`}>
                  {ROLE_STATUS_LABEL[status]}
                </span>
              </div>

              {applicant?.headline && <p className="muted">{applicant.headline}</p>}

              {row.application_note && (
                <blockquote className="quote">{row.application_note}</blockquote>
              )}

              {row.evidence_url && (
                <p>
                  <a href={row.evidence_url} target="_blank" rel="noreferrer noopener" dir="ltr">
                    {row.evidence_url}
                  </a>
                </p>
              )}

              {mentor && (
                <dl className="summary-list">
                  <div><dt>سنوات الخبرة</dt><dd>{mentor.years_experience ?? '—'}</dd></div>
                  <div><dt>ساعات أسبوعية</dt><dd>{mentor.weekly_hours ?? '—'}</dd></div>
                  <div><dt>مجالات الإرشاد</dt><dd>{mentor.domains?.join('، ') || '—'}</dd></div>
                  <div><dt>لغات الجلسات</dt><dd>{mentor.languages?.join('، ') || '—'}</dd></div>
                  <div><dt>الخبرة</dt><dd>{mentor.experience_ar ?? '—'}</dd></div>
                  <div><dt>الدافع</dt><dd>{mentor.motivation_ar ?? '—'}</dd></div>
                  {mentor.linkedin_url && (
                    <div><dt>LinkedIn</dt><dd dir="ltr">{mentor.linkedin_url}</dd></div>
                  )}
                  {mentor.portfolio_url && (
                    <div><dt>أعمال</dt><dd dir="ltr">{mentor.portfolio_url}</dd></div>
                  )}
                </dl>
              )}

              {row.review_note && status === 'needs_more_info' && (
                <p className="notice">طُلب منه: {row.review_note}</p>
              )}

              <RequestReview requestId={row.id} status={status} />
            </article>
          );
        })}
      </div>
    </>
  );
}
