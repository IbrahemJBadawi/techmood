import Link from 'next/link';
import { redirect } from 'next/navigation';

import { Icon } from '@/components/Icon';
import { Stars } from '@/components/Stars';
import { createClient } from '@/lib/supabase/server';
import { getT, localizedTitle } from '@/lib/i18n.server';
import { type Text } from '@/lib/i18n';
import { levelInfo } from '@/lib/xp';
import { AiSurface } from '@/components/AiSurface';
import { PLATFORM_TIME_ZONE } from '@/lib/zoned';

export const generateMetadata = localizedTitle('جواز المهارات — TechMood', 'Skills passport — TechMood');

const ROLE_LABELS: Record<string, Text> = {
  student:     { ar: 'طالب',       en: 'Student' },
  freelancer:  { ar: 'فريلانسر',   en: 'Freelancer' },
  mentor:      { ar: 'منتور',      en: 'Mentor' },
  mentee:      { ar: 'Mentee',     en: 'Mentee' },
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
  mentor_session_booked:    { ar: 'تأكيد حجز جلسة',       en: 'Mentor session booked' },
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
      <AiSurface surface="profile" scope="profile" />

      <section className="section-block pp-card">
        <div className="pp-cover" aria-hidden="true" />
        <div className="pp-head">
          {profile?.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="pp-avatar" src={profile.avatar_url} alt="" width={96} height={96} />
          ) : (
            <span className="pp-avatar pp-avatar-initial">{(profile?.display_name ?? profile?.full_name ?? '?').trim().charAt(0)}</span>
          )}
          <div className="pp-actions">
            {profile?.techmood_id && (
              <Link className="btn btn-ghost btn-sm" href={`/u/${profile.techmood_id}`}>
                <Icon name="globe" size={16} />{t('صفحتي العامة', 'My public page')}
              </Link>
            )}
            <Link className="btn btn-primary btn-sm" href="/settings/profile">{t('تعديل الملف', 'Edit profile')}</Link>
          </div>
        </div>

        <div className="pp-identity">
          <h2>{profile?.display_name ?? profile?.full_name}</h2>
          {profile?.headline && <p className="pp-headline">{profile.headline}</p>}
          <div className="tags-row">
            <span className="id-chip">{profile?.techmood_id}</span>
            {profile?.username
              ? <span className="id-chip eng">@{profile.username}</span>
              : <Link className="id-chip" href="/settings/profile#username">{t('+ احجز اسم مستخدم', '+ Reserve a username')}</Link>}
            {(roles ?? [])
              .filter((role) => role.status === 'approved')
              .map((role) => (
                <span className="badge-pill" key={role.id}>{ROLE_LABELS[role.role] ? t(ROLE_LABELS[role.role]) : role.role}</span>
              ))}
          </div>
          {profile?.bio && <p className="pp-bio">{profile.bio}</p>}
        </div>

        <dl className="pp-stats">
          <div><dd className="eng">{totalXp}</dd><dt>XP</dt></div>
          <div>
            <dd><Stars value={stars?.stars_avg ?? 0} /></dd>
            <dt>{stars?.rated_count ? t(`${stars.rated_count} عمل مُقيَّم`, `${stars.rated_count} rated`) : t('لا تقييمات بعد', 'No ratings yet')}</dt>
          </div>
          <div><dd className="eng">{exhibition?.length ?? 0}</dd><dt>{t('أعمال منشورة', 'Published works')}</dt></div>
          <div><dd className="eng">{certificates?.length ?? 0}</dd><dt>{t('شهادات', 'Certificates')}</dt></div>
        </dl>

        <div className="pp-level">
          <div className="pp-level-row">
            <span className="pp-level-badge">{t(level.current.title)}</span>
            {level.next && <span className="muted">{t(`${level.percent}% نحو «${t(level.next.title)}»`, `${level.percent}% to “${t(level.next.title)}”`)}</span>}
          </div>
          {level.next && (
            <div className="progress-track"><div className="progress-fill" style={{ width: `${level.percent}%` }} /></div>
          )}
        </div>
      </section>

      <div className="detail-grid">
        <section>
          <div className="section-block">
            <div className="row-between pp-section-head">
              <h3>{t('أعمالي في المعرض', 'My work in the gallery')}</h3>
              <Link className="btn btn-ghost btn-sm" href="/gallery">{t('المعرض', 'Gallery')}</Link>
            </div>
            {(exhibition?.length ?? 0) === 0 ? (
              <div className="panel pp-empty">
                <Icon name="gallery" size={26} />
                <p>{t('لا أعمال منشورة بعد — أكمل مشروعاً مع فريقك وقدّمه للمعرض ليظهر هنا كدليل مهني.', 'Nothing published yet — finish a project with your team and submit it to the exhibition, and it will show here as professional evidence.')}</p>
              </div>
            ) : (
              <div className="pp-works">
                {exhibition!.map((entry, index) => (
                  <Link className="pp-work" key={entry.entry_code} href={`/exhibition/${entry.entry_code}`}
                        style={{ '--hue': ['#2F6BFF', '#7C5CFF', '#0E9F6E', '#E8590C', '#D6336C', '#0B8FB3'][index % 6] } as React.CSSProperties}>
                    <span className="pp-work-cover" aria-hidden="true">{entry.project_title.trim().charAt(0)}</span>
                    <span className="pp-work-body">
                      <strong>{entry.project_title}</strong>
                      <span className="muted">{entry.team_title ?? t('عمل فردي', 'Solo work')}</span>
                      <span className="pp-work-meta">{t(`${entry.tasks_done} مهام أنجزتها`, `${entry.tasks_done} tasks you did`)}</span>
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>

          <div className="section-block">
            <div className="row-between pp-section-head">
              <h3>{t('الشهادات', 'Certificates')}</h3>
              <Link className="btn btn-ghost btn-sm" href="/certificates">{t('كل الشهادات', 'All certificates')}</Link>
            </div>
            {(certificates?.length ?? 0) === 0 ? (
              <div className="panel pp-empty">
                <Icon name="certificate" size={26} />
                <p>{t('لا شهادات بعد — تُصدَر بعد اعتماد كل الأعمال المطلوبة في الدورة أو المسار.', 'No certificates yet — one is issued once all the required work in a course or path has been approved.')}</p>
              </div>
            ) : (
              <div className="pp-certs">
                {certificates!.map((certificate) => (
                  <Link className="pp-cert" key={certificate.certificate_code} href={`/verify/${certificate.certificate_code}`}>
                    <span className="pp-cert-seal"><Icon name="shield" size={22} /></span>
                    <span className="pp-cert-body">
                      <strong>{certificate.snapshot?.title}</strong>
                      <span className="id-chip">{certificate.certificate_code}</span>
                    </span>
                    <Icon name="arrow" size={16} />
                  </Link>
                ))}
              </div>
            )}
          </div>

          <div className="section-block">
            <h3 className="pp-section-title">{t('آخر النقاط', 'Recent points')}</h3>
            {(xpEvents?.length ?? 0) === 0 ? (
              <p className="muted" style={{ fontSize: '0.86rem' }}>
                {t('لم تكسب نقاطاً بعد — أكمل درساً أو سلّم عملاً ليُراجَع.', 'No points yet — finish a lesson or hand in work to be reviewed.')}
              </p>
            ) : (
              <ul className="txn-list">
                {xpEvents!.slice(0, 8).map((event) => (
                  <li key={event.id}>
                    <div className="txn">
                      <span className="txn-icon is-in" aria-hidden="true"><Icon name="star" size={18} /></span>
                      <span className="txn-main">
                        <strong>{XP_SOURCE_LABELS[event.source] ? t(XP_SOURCE_LABELS[event.source]) : event.source}</strong>
                        <span className="txn-meta">{new Date(event.created_at).toLocaleDateString(t.locale === 'ar' ? 'ar-EG-u-nu-latn' : 'en-GB', { timeZone: PLATFORM_TIME_ZONE })}</span>
                      </span>
                      <span className="txn-side"><span className="eng txn-amount is-in">+{event.xp} XP</span></span>
                    </div>
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
