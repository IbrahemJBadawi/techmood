import Link from 'next/link';
import { redirect } from 'next/navigation';

import { Stars } from '@/components/Stars';
import { createClient } from '@/lib/supabase/server';
import { getT } from '@/lib/i18n.server';
import { type Text } from '@/lib/i18n';
import { levelInfo } from '@/lib/xp';

const ROLE_LABELS: Record<string, Text> = {
  student:     { ar: 'طالب',       en: 'Student' },
  freelancer:  { ar: 'فريلانسر',   en: 'Freelancer' },
  mentor:      { ar: 'منتور',      en: 'Mentor' },
  team_leader: { ar: 'قائد فريق',  en: 'Team lead' },
  founder:     { ar: 'مؤسس',       en: 'Founder' },
  company:     { ar: 'مؤسسة',      en: 'Organisation' },
  admin:       { ar: 'مشرف',       en: 'Admin' },
};

const STATUS_LABELS: Record<string, { text: Text; className: string }> = {
  approved:        { text: { ar: 'مفعّل',                en: 'Active' },     className: 'status-ok' },
  pending_review:  { text: { ar: 'قيد المراجعة',        en: 'Pending' },    className: 'status-pending' },
  needs_more_info: { text: { ar: 'بانتظار معلومات منك', en: 'Needs info' }, className: 'status-pending' },
  rejected:        { text: { ar: 'مرفوض',               en: 'Rejected' },   className: 'status-danger' },
  suspended:       { text: { ar: 'موقوف',               en: 'Suspended' },  className: 'status-danger' },
};

const XP_SOURCE_LABELS: Record<string, Text> = {
  lesson_completed:         { ar: 'إكمال درس',            en: 'Lesson completed' },
  assignment_evaluated:     { ar: 'تكليف مُقيَّم',          en: 'Assignment evaluated' },
  course_project_evaluated: { ar: 'مشروع دورة مُقيَّم',     en: 'Course project evaluated' },
  course_completed:         { ar: 'إكمال دورة',           en: 'Course completed' },
  path_project_evaluated:   { ar: 'مشروع مسار مُقيَّم',     en: 'Path project evaluated' },
  path_completed:           { ar: 'إكمال مسار',           en: 'Path completed' },
  mentor_session_attended:  { ar: 'حضور جلسة إرشاد',      en: 'Mentor session attended' },
  team_contribution:        { ar: 'مساهمة في فريق',       en: 'Team contribution' },
  achievement_awarded:      { ar: 'إنجاز',                en: 'Achievement' },
};

export default async function PassportPage() {
  const t = await getT();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [{ data: profile }, { data: roles }, { data: xp }, { data: stars }, { data: xpEvents }, { data: certificates }] =
    await Promise.all([
      supabase.from('profiles').select('*').eq('id', user.id).single(),
      supabase.from('profile_roles').select('id, role, status, review_note').eq('profile_id', user.id),
      supabase.from('profile_xp').select('total_xp').eq('profile_id', user.id).maybeSingle(),
      supabase.from('profile_stars').select('stars_avg, rated_count').eq('profile_id', user.id).maybeSingle(),
      supabase.from('xp_events').select('id, source, xp, created_at').eq('profile_id', user.id).order('created_at', { ascending: false }).limit(12),
      supabase.from('certificates').select('certificate_code, kind, issued_at, snapshot').eq('profile_id', user.id).eq('status', 'active'),
    ]);

  const { data: exhibition } = await supabase.rpc('profile_exhibition_entries', { p_profile: user.id });

  const totalXp = xp?.total_xp ?? 0;
  const level = levelInfo(totalXp);

  return (
    <>
      <section className="panel section-block">
        <div className="row-between" style={{ alignItems: 'flex-start' }}>
          <div>
            <h2 style={{ fontSize: '1.3rem' }}>{profile?.full_name}</h2>
            <div className="tags-row" style={{ marginTop: 8 }}>
              <span className="id-chip">{profile?.techmood_id}</span>
              {(roles ?? [])
                .filter((role) => role.status === 'approved')
                .map((role) => (
                  <span className="badge-pill" key={role.id}>{ROLE_LABELS[role.role] ? t(ROLE_LABELS[role.role]) : role.role}</span>
                ))}
            </div>
          </div>
        </div>

        {profile?.bio && <p className="muted" style={{ fontSize: '0.9rem', marginTop: 14 }}>{profile.bio}</p>}

        <div className="tags-row" style={{ marginTop: 16, alignItems: 'center' }}>
          <Stars value={stars?.stars_avg ?? 0} />
          <span className="muted" style={{ fontSize: '0.8rem' }}>
            {stars?.rated_count
              ? t(`من ${stars.rated_count} عمل مُقيَّم`, `from ${stars.rated_count} rated ${stars.rated_count === 1 ? 'piece' : 'pieces'}`)
              : t('لا تقييمات بعد', 'No ratings yet')}
          </span>
          <span className="xp-badge eng">{totalXp} XP</span>
          <span className="badge-pill">{t(level.current.title)}</span>
        </div>

        {level.next && (
          <div style={{ marginTop: 12, maxWidth: 380 }}>
            <div className="progress-track">
              <div className="progress-fill" style={{ width: `${level.percent}%` }} />
            </div>
            <p className="muted" style={{ fontSize: '0.76rem', marginTop: 5 }}>
              {t(`${level.percent}% نحو «${t(level.next.title)}»`, `${level.percent}% towards “${t(level.next.title)}”`)}
            </p>
          </div>
        )}
      </section>

      <div className="detail-grid">
        <section>
          <div className="panel section-block">
            <h3 style={{ fontSize: '0.98rem', marginBottom: 12 }}>{t('سجل النقاط (XP)', 'Points history (XP)')}</h3>
            {(xpEvents?.length ?? 0) === 0 ? (
              <p className="muted" style={{ fontSize: '0.86rem' }}>
                {t('لم تكسب نقاطاً بعد — أكمل درساً أو سلّم عملاً ليُراجَع.', 'No points yet — finish a lesson or hand in work to be reviewed.')}
              </p>
            ) : (
              <table className="data">
                <thead>
                  <tr><th>{t('المصدر', 'Source')}</th><th>{t('النقاط', 'Points')}</th><th>{t('التاريخ', 'Date')}</th></tr>
                </thead>
                <tbody>
                  {xpEvents!.map((event) => (
                    <tr key={event.id}>
                      <td>{XP_SOURCE_LABELS[event.source] ? t(XP_SOURCE_LABELS[event.source]) : event.source}</td>
                      <td className="eng">+{event.xp}</td>
                      <td className="eng">{new Date(event.created_at).toLocaleDateString('ar-EG')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="panel section-block">
            <h3 style={{ fontSize: '0.98rem', marginBottom: 12 }}>{t('🏛️ أعمال منشورة في المعرض', '🏛️ Published in the exhibition')}</h3>
            {(exhibition?.length ?? 0) === 0 ? (
              <p className="muted" style={{ fontSize: '0.86rem' }}>
                {t('لا أعمال منشورة بعد — أكمل مشروعاً مع فريقك وقدّمه للمعرض ليظهر هنا كدليل مهني.', 'Nothing published yet — finish a project with your team and submit it to the exhibition, and it will show here as professional evidence.')}
              </p>
            ) : (
              <table className="data">
                <thead><tr><th>{t('المشروع', 'Project')}</th><th>{t('الفريق', 'Team')}</th><th>{t('مهامك', 'Your tasks')}</th><th></th></tr></thead>
                <tbody>
                  {exhibition!.map((entry) => (
                    <tr key={entry.entry_code}>
                      <td>{entry.project_title}</td>
                      <td>{entry.team_title ?? '—'}</td>
                      <td className="eng">{entry.tasks_done}</td>
                      <td>
                        <Link className="btn btn-ghost btn-sm" href={`/exhibition/${entry.entry_code}`}>{t('عرض', 'View')}</Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="panel">
            <h3 style={{ fontSize: '0.98rem', marginBottom: 12 }}>{t('🎓 الشهادات', '🎓 Certificates')}</h3>
            {(certificates?.length ?? 0) === 0 ? (
              <p className="muted" style={{ fontSize: '0.86rem' }}>
                {t('لا شهادات بعد — تُصدَر بعد اعتماد كل الأعمال المطلوبة في الدورة أو المسار.', 'No certificates yet — one is issued once all the required work in a course or path has been approved.')}
              </p>
            ) : (
              <ul style={{ margin: 0, paddingInlineStart: 18, fontSize: '0.88rem' }}>
                {certificates!.map((certificate) => (
                  <li key={certificate.certificate_code} style={{ marginBottom: 6 }}>
                    {certificate.snapshot?.title}{' '}
                    <span className="id-chip">{certificate.certificate_code}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <aside>
          <div className="panel section-block">
            <h3 style={{ fontSize: '0.98rem', marginBottom: 12 }}>{t('الأدوار', 'Roles')}</h3>
            {(roles ?? []).map((role) => {
              const status = STATUS_LABELS[role.status] ?? STATUS_LABELS.pending_review;
              return (
                <div className="row-between" key={role.id} style={{ marginBottom: 10 }}>
                  <span style={{ fontSize: '0.88rem' }}>{ROLE_LABELS[role.role] ? t(ROLE_LABELS[role.role]) : role.role}</span>
                  <span className={`status-pill ${status.className}`}>{t(status.text)}</span>
                </div>
              );
            })}
            <p className="muted" style={{ fontSize: '0.78rem', marginTop: 10 }}>
              {t('رفض أي دور لا يؤثر على حسابك — تبقى طالباً في TechMood.', 'Turning a role down does not affect your account — you stay a student on TechMood.')}
            </p>
          </div>

          <div className="panel section-block">
            <h3 style={{ fontSize: '0.98rem', marginBottom: 8 }}>{t('تريد دوراً آخر؟', 'Want another role?')}</h3>
            <p className="muted" style={{ fontSize: '0.84rem', marginBottom: 12 }}>
              {t('طلب الدور، والردّ عليه، وسجلّ مراجعته — كلّها في مكان واحد.', 'Asking for a role, answering questions about it and its review history — all in one place.')}
            </p>
            <Link className="btn btn-ghost btn-sm" href="/settings/roles">{t('أدواري', 'My roles')}</Link>
          </div>
        </aside>
      </div>
    </>
  );
}
