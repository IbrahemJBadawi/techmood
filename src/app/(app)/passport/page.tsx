import Link from 'next/link';
import { redirect } from 'next/navigation';

import { Stars } from '@/components/Stars';
import { createClient } from '@/lib/supabase/server';
import { levelInfo } from '@/lib/xp';


const ROLE_LABELS: Record<string, string> = {
  student: 'طالب', freelancer: 'فريلانسر', mentor: 'منتور',
  team_leader: 'قائد فريق', founder: 'مؤسس', company: 'مؤسسة', admin: 'مشرف',
};

const STATUS_LABELS: Record<string, { text: string; className: string }> = {
  approved: { text: 'مفعّل', className: 'status-ok' },
  pending_review: { text: 'قيد المراجعة', className: 'status-pending' },
  rejected: { text: 'مرفوض', className: 'status-danger' },
  suspended: { text: 'موقوف', className: 'status-danger' },
};

const XP_SOURCE_LABELS: Record<string, string> = {
  lesson_completed: 'إكمال درس',
  assignment_evaluated: 'تكليف مُقيَّم',
  course_project_evaluated: 'مشروع دورة مُقيَّم',
  course_completed: 'إكمال دورة',
  path_project_evaluated: 'مشروع مسار مُقيَّم',
  path_completed: 'إكمال مسار',
  mentor_session_attended: 'حضور جلسة إرشاد',
  team_contribution: 'مساهمة في فريق',
  achievement_awarded: 'إنجاز',
};

export default async function PassportPage() {
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
                  <span className="badge-pill" key={role.id}>{ROLE_LABELS[role.role] ?? role.role}</span>
                ))}
            </div>
          </div>
        </div>

        {profile?.bio && <p className="muted" style={{ fontSize: '0.9rem', marginTop: 14 }}>{profile.bio}</p>}

        <div className="tags-row" style={{ marginTop: 16, alignItems: 'center' }}>
          <Stars value={stars?.stars_avg ?? 0} />
          <span className="muted" style={{ fontSize: '0.8rem' }}>
            {stars?.rated_count ? `من ${stars.rated_count} عمل مُقيَّم` : 'لا تقييمات بعد'}
          </span>
          <span className="xp-badge eng">{totalXp} XP</span>
          <span className="badge-pill">{level.current.title}</span>
        </div>

        {level.next && (
          <div style={{ marginTop: 12, maxWidth: 380 }}>
            <div className="progress-track">
              <div className="progress-fill" style={{ width: `${level.percent}%` }} />
            </div>
            <p className="muted" style={{ fontSize: '0.76rem', marginTop: 5 }}>
              {level.percent}% نحو «{level.next.title}»
            </p>
          </div>
        )}
      </section>

      <div className="detail-grid">
        <section>
          <div className="panel section-block">
            <h3 style={{ fontSize: '0.98rem', marginBottom: 12 }}>سجل النقاط (XP)</h3>
            {(xpEvents?.length ?? 0) === 0 ? (
              <p className="muted" style={{ fontSize: '0.86rem' }}>
                لم تكسب نقاطاً بعد — أكمل درساً أو سلّم عملاً ليُراجَع.
              </p>
            ) : (
              <table className="data">
                <thead>
                  <tr><th>المصدر</th><th>النقاط</th><th>التاريخ</th></tr>
                </thead>
                <tbody>
                  {xpEvents!.map((event) => (
                    <tr key={event.id}>
                      <td>{XP_SOURCE_LABELS[event.source] ?? event.source}</td>
                      <td className="eng">+{event.xp}</td>
                      <td className="eng">{new Date(event.created_at).toLocaleDateString('ar-EG')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="panel section-block">
            <h3 style={{ fontSize: '0.98rem', marginBottom: 12 }}>🏛️ أعمال منشورة في المعرض</h3>
            {(exhibition?.length ?? 0) === 0 ? (
              <p className="muted" style={{ fontSize: '0.86rem' }}>
                لا أعمال منشورة بعد — أكمل مشروعاً مع فريقك وقدّمه للمعرض ليظهر هنا كدليل مهني.
              </p>
            ) : (
              <table className="data">
                <thead><tr><th>المشروع</th><th>الفريق</th><th>مهامك</th><th></th></tr></thead>
                <tbody>
                  {exhibition!.map((entry) => (
                    <tr key={entry.entry_code}>
                      <td>{entry.project_title}</td>
                      <td>{entry.team_title ?? '—'}</td>
                      <td className="eng">{entry.tasks_done}</td>
                      <td>
                        <Link className="btn btn-ghost btn-sm" href={`/exhibition/${entry.entry_code}`}>عرض</Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="panel">
            <h3 style={{ fontSize: '0.98rem', marginBottom: 12 }}>🎓 الشهادات</h3>
            {(certificates?.length ?? 0) === 0 ? (
              <p className="muted" style={{ fontSize: '0.86rem' }}>
                لا شهادات بعد — تُصدَر بعد اعتماد كل الأعمال المطلوبة في الدورة أو المسار.
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
            <h3 style={{ fontSize: '0.98rem', marginBottom: 12 }}>الأدوار</h3>
            {(roles ?? []).map((role) => {
              const status = STATUS_LABELS[role.status] ?? STATUS_LABELS.pending_review;
              return (
                <div className="row-between" key={role.id} style={{ marginBottom: 10 }}>
                  <span style={{ fontSize: '0.88rem' }}>{ROLE_LABELS[role.role] ?? role.role}</span>
                  <span className={`status-pill ${status.className}`}>{status.text}</span>
                </div>
              );
            })}
            <p className="muted" style={{ fontSize: '0.78rem', marginTop: 10 }}>
              رفض أي دور لا يؤثر على حسابك — تبقى طالباً في TechMood.
            </p>
          </div>

          <div className="panel section-block">
            <h3 style={{ fontSize: '0.98rem', marginBottom: 8 }}>تريد دوراً آخر؟</h3>
            <p className="muted" style={{ fontSize: '0.84rem', marginBottom: 12 }}>
              طلب الدور، والردّ عليه، وسجلّ مراجعته — كلّها في مكان واحد.
            </p>
            <Link className="btn btn-ghost btn-sm" href="/settings/roles">أدواري</Link>
          </div>
        </aside>
      </div>
    </>
  );
}
