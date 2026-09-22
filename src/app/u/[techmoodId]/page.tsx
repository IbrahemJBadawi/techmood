import Link from 'next/link';
import { Stars } from '@/components/Stars';
import QRCode from 'qrcode';

import { LogoMark } from '@/components/Logo';
import { createClient } from '@/lib/supabase/server';
import { getLocale, getT } from '@/lib/i18n.server';
import { contentText, formatDate, type Text } from '@/lib/i18n';
import type { ExperienceKind, LinkKind, ProfileSection } from '@/lib/database.types';

import { ProfileCard, type Card } from './ProfileCard';

export const metadata = { title: 'A TechMood profile' };

const LINK_LABEL: Record<LinkKind, string> = {
  linkedin: 'LinkedIn', github: 'GitHub', behance: 'Behance', dribbble: 'Dribbble',
  kaggle: 'Kaggle', youtube: 'YouTube', portfolio: 'Portfolio', website: 'Website',
  x: 'X', other: 'Link',
};

const EXPERIENCE_LABEL: Record<ExperienceKind, Text> = {
  job:        { ar: 'وظيفة',    en: 'Job' },
  freelance:  { ar: 'عمل حر',   en: 'Freelance' },
  volunteer:  { ar: 'تطوّع',    en: 'Volunteering' },
  internship: { ar: 'تدريب',    en: 'Internship' },
  techmood:   { ar: 'داخل TechMood', en: 'Inside TechMood' },
};

/**
 * The public side of a TechMood identity.
 *
 * It reads in the order somebody meets a person: who they are, what they can
 * prove, what they have built, where they are going, and only then the things
 * they say about themselves. Everything above the fold was recorded by the
 * platform — approved work, issued certificates, published projects — and the
 * few things that are claims, an external exhibition especially, are marked as
 * verified or not shown at all.
 *
 * What each visitor sees is decided once, in can_see_profile_section(): the
 * owner sees everything, a mentor or team lead or company sees the
 * professional layer, everyone else sees what is public, and a profile
 * switched off publishes nothing at all.
 */
export default async function PublicProfilePage({
  params,
}: {
  params: Promise<{ techmoodId: string }>;
}) {
  const t = await getT();
  const locale = await getLocale();
  const { techmoodId } = await params;
  const supabase = await createClient();

  const { data: cardRows } = await supabase.rpc('profile_card', { p_techmood_id: techmoodId });
  const card = ((cardRows ?? []) as Card[])[0] ?? null;

  const shell = (children: React.ReactNode) => (
    <main className="landing" style={{ maxWidth: 900 }}>
      <nav className="landing-nav">
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, fontWeight: 700, textDecoration: 'none' }}>
          <LogoMark />
          TechMood
        </Link>
        <Link className="btn btn-ghost btn-sm" href="/exhibition">{t('المعرض', 'The exhibition')}</Link>
      </nav>
      {children}
    </main>
  );

  // A private profile and one that does not exist answer the same, so the page
  // cannot be used to find out which TechMood IDs are taken.
  if (!card) {
    return shell(
      <section className="panel" style={{ marginTop: 32 }}>
        <h1 style={{ fontSize: '1.1rem' }}>{t('لا ملف عام بهذا المعرّف', 'No public profile with that id')}</h1>
        <p className="muted" style={{ fontSize: '0.9rem', marginTop: 8 }}>
          {t('إما أن المعرّف غير صحيح، أو أن صاحبه اختار ألا يكون ملفه عاماً.',
             'Either the id is wrong, or the person chose not to make their profile public.')}
        </p>
      </section>,
    );
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://techmood.io';
  const profileUrl = `${siteUrl}/u/${card.techmood_id}`;
  const qrDataUrl = await QRCode.toDataURL(profileUrl, { margin: 1, width: 300 });

  // One round trip decides the whole page: which sections this visitor may
  // read at all. Everything below is fetched only for the ones that pass.
  const sections: ProfileSection[] = [
    'identity', 'skills', 'achievements', 'certificates', 'learning',
    'projects', 'evaluations', 'teams', 'experience', 'education',
    'links', 'external_exhibitions',
  ];
  const visible = new Map<ProfileSection, boolean>();
  await Promise.all(sections.map(async (section) => {
    const { data } = await supabase.rpc('can_see_profile_section', {
      p_profile: card.profile_id, p_section: section,
    });
    visible.set(section, data === true);
  }));
  const can = (section: ProfileSection) => visible.get(section) === true;

  const [
    { data: roles },
    { data: fields },
    { data: skills },
    { data: certificates },
    { data: projects },
    { data: reputation },
    { data: clientReviews },
    { data: links },
    { data: education },
    { data: experience },
    { data: external },
    { data: achievements },
    { data: learning },
    { data: focusRows },
  ] = await Promise.all([
    can('identity')
      ? supabase.from('profile_roles').select('role, status').eq('profile_id', card.profile_id).eq('status', 'approved')
      : { data: [] },
    can('identity')
      ? supabase.from('profile_fields').select('is_primary, fields(name_ar, name_en)').eq('profile_id', card.profile_id)
      : { data: [] },
    can('skills') ? supabase.rpc('profile_verified_skills', { p_profile: card.profile_id }) : { data: [] },
    can('certificates')
      ? supabase.from('certificates').select('certificate_code, kind, issued_at, snapshot').eq('profile_id', card.profile_id).eq('status', 'active')
      : { data: [] },
    can('projects') ? supabase.rpc('profile_exhibition_entries', { p_profile: card.profile_id }) : { data: [] },
    can('evaluations') ? supabase.rpc('profile_reputation', { p_profile: card.profile_id }) : { data: [] },
    can('evaluations') ? supabase.rpc('client_reviews_for', { p_profile: card.profile_id }) : { data: [] },
    can('links')
      ? supabase.from('profile_links').select('id, kind, label, url').eq('profile_id', card.profile_id).order('sort_order')
      : { data: [] },
    can('education')
      ? supabase.from('profile_education').select('id, institution, degree, field, started_on, ended_on, is_current').eq('profile_id', card.profile_id).order('started_on', { ascending: false })
      : { data: [] },
    can('experience')
      ? supabase.from('profile_experience').select('id, organisation, title, kind, summary, started_on, ended_on, is_current').eq('profile_id', card.profile_id).order('started_on', { ascending: false })
      : { data: [] },
    can('external_exhibitions')
      ? supabase.from('external_exhibitions').select('id, title, organiser, role_ar, result_ar, evidence_url, held_on, status').eq('profile_id', card.profile_id).eq('status', 'approved').order('held_on', { ascending: false })
      : { data: [] },
    can('achievements')
      ? supabase.from('profile_achievements').select('achievement_id, awarded_at').eq('profile_id', card.profile_id).order('awarded_at', { ascending: false })
      : { data: [] },
    can('learning') ? supabase.rpc('profile_learning', { p_profile: card.profile_id }) : { data: [] },
    can('learning') ? supabase.rpc('profile_focus', { p_profile: card.profile_id }) : { data: [] },
  ]);

  const focus = (focusRows ?? [])[0] ?? null;
  const onPaths = (learning ?? []).filter((row) => !row.is_complete);
  const donePaths = (learning ?? []).filter((row) => row.is_complete);

  const achievementIds = (achievements ?? []).map((row) => row.achievement_id);
  const { data: achievementRows } = achievementIds.length
    ? await supabase.from('achievements').select('id, name_ar, description_ar, icon').in('id', achievementIds)
    : { data: [] };

  const year = (value: string | null) => (value ? value.slice(0, 4) : null);
  const span = (from: string | null, to: string | null, current: boolean) =>
    [year(from), current ? t('حتى الآن', 'present') : year(to)].filter(Boolean).join(' — ');

  return shell(
    <>
      <div className="identity-wrap">
        <ProfileCard card={card} qrDataUrl={qrDataUrl} profileUrl={profileUrl} locale={locale} />
        <div className="identity-actions no-print">
          <Link className="btn btn-ghost btn-sm" href={`/u/${card.techmood_id}/card`}>
            {t('بطاقة للمشاركة', 'A card to share')}
          </Link>
        </div>
      </div>

      {card.bio && (
        <section className="panel section-block">
          <h2 className="profile-heading">{t('نبذة', 'About')}</h2>
          <p style={{ fontSize: '0.94rem', marginTop: 8 }}>{card.bio}</p>
        </section>
      )}

      {can('identity') && ((roles ?? []).length > 0 || (fields ?? []).length > 0) && (
        <section className="panel section-block">
          <h2 className="profile-heading">{t('الهوية المهنية', 'Professional identity')}</h2>
          {(fields ?? []).length > 0 && (
            <>
              <p className="profile-label">{t('المجالات', 'Fields')}</p>
              <div className="tags-row">
                {(fields ?? []).map((row, index) => {
                  const field = row.fields as unknown as { name_ar: string; name_en: string } | null;
                  if (!field) return null;
                  return (
                    <span className={`tag${row.is_primary ? ' is-on' : ''}`} key={index}>
                      {contentText(locale, field.name_ar, field.name_en)}
                    </span>
                  );
                })}
              </div>
            </>
          )}
          {(roles ?? []).length > 0 && (
            <>
              <p className="profile-label" style={{ marginTop: 14 }}>{t('الأدوار المعتمدة', 'Approved roles')}</p>
              <div className="tags-row">
                {(roles ?? []).map((row) => (
                  <span className="status-pill status-ok" key={row.role}>✓ {row.role}</span>
                ))}
              </div>
            </>
          )}
        </section>
      )}

      <section className="panel section-block">
        <h2 className="profile-heading">{t('السجل', 'The record')}</h2>
        <dl className="profile-stats">
          {[
            [String(card.points), t('نقاط TechMood', 'TechMood points')],
            [card.stars_avg !== null ? card.stars_avg.toFixed(1) : '—', t('التقييم', 'Rating')],
            [String(card.courses_done), t('دورات مكتملة', 'Courses completed')],
            [String(card.paths_done), t('مسارات مكتملة', 'Paths completed')],
            [String(card.projects), t('مشاريع معروضة', 'Projects exhibited')],
            [String(card.sessions), t('جلسات إرشاد', 'Mentor sessions')],
            [String(card.teams), t('فرق', 'Teams')],
            [String(card.achievements), t('إنجازات', 'Achievements')],
          ].map(([value, label]) => (
            <div key={label}>
              <dt className="eng">{value}</dt>
              <dd>{label}</dd>
            </div>
          ))}
        </dl>
        <p className="muted" style={{ fontSize: '0.74rem', marginTop: 12 }}>
          {t('كل رقم هنا محسوب من سجلّ المنصة: عمل اعتمده منتور، شهادة صدرت، مشروع عُرض، جلسة اكتملت.',
             'Every number here is counted from the platform’s own record: work a mentor approved, a certificate issued, a project exhibited, a session completed.')}
        </p>
      </section>

      {can('skills') && (skills ?? []).length > 0 && (
        <section className="panel section-block">
          <h2 className="profile-heading">{t('مهارات موثّقة', 'Proven skills')}</h2>
          <p className="muted" style={{ fontSize: '0.84rem', marginTop: 6 }}>
            {t('كل مهارة أثبتها عمل اعتمده منتور — لا مهارة مكتوبة عن النفس.',
               'Each one proven by work a mentor approved — none of it self-declared.')}
          </p>
          <div className="tags-row" style={{ marginTop: 12 }}>
            {(skills ?? []).map((skill) => (
              <span className="tag" key={skill.slug}>{contentText(locale, skill.name_ar, skill.name_en)}</span>
            ))}
          </div>
        </section>
      )}

      {can('achievements') && (achievementRows ?? []).length > 0 && (
        <section className="panel section-block">
          <h2 className="profile-heading">{t('الإنجازات', 'Achievements')}</h2>
          <ul className="profile-list">
            {(achievementRows ?? []).map((achievement) => {
              const awarded = (achievements ?? []).find((row) => row.achievement_id === achievement.id);
              return (
                <li key={achievement.id}>
                  <span>{achievement.icon ?? '🏆'} {achievement.name_ar}</span>
                  {achievement.description_ar && <span className="muted">{achievement.description_ar}</span>}
                  {awarded && <span className="muted eng">{formatDate(locale, awarded.awarded_at)}</span>}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {can('certificates') && (certificates ?? []).length > 0 && (
        <section className="panel section-block">
          <h2 className="profile-heading">{t('الشهادات', 'Certificates')}</h2>
          <ul className="profile-list">
            {(certificates ?? []).map((certificate) => {
              const snapshot = certificate.snapshot as { title?: string; title_en?: string } | null;
              return (
                <li key={certificate.certificate_code}>
                  <Link href={`/verify/${certificate.certificate_code}`}>
                    {contentText(locale, snapshot?.title ?? certificate.certificate_code, snapshot?.title_en ?? null)}
                  </Link>
                  <span className="muted eng">{formatDate(locale, certificate.issued_at)}</span>
                  <span className="status-pill status-ok">{t('✓ قابلة للتحقّق', '✓ Verifiable')}</span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {can('learning') && (learning ?? []).length > 0 && (
        <section className="panel section-block">
          <h2 className="profile-heading">{t('رحلة التعلّم', 'Learning journey')}</h2>

          {focus && (
            <p className="muted profile-focus">
              {t('يتعلّم الآن: ', 'Currently learning: ')}
              <strong>{focus.course_title}</strong>
              {' · '}{focus.lesson_title}
              <span className="muted"> — {focus.path_title}</span>
            </p>
          )}

          {onPaths.length > 0 && (
            <div className="profile-journey">
              {onPaths.map((row) => (
                <div key={row.path_slug}>
                  <div className="row-between">
                    <Link href={`/academy/${row.path_slug}`}>{contentText(locale, row.title_ar, row.title_en)}</Link>
                    <span className="eng">{row.percent}%</span>
                  </div>
                  <div
                    className="progress-track"
                    role="progressbar"
                    aria-valuenow={row.percent}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={contentText(locale, row.title_ar, row.title_en)}
                  >
                    <div className="progress-fill" style={{ width: `${row.percent}%` }} />
                  </div>
                  <p className="muted" style={{ fontSize: '0.76rem', marginTop: 4 }}>
                    {t(`${row.courses_done} من ${row.courses_total} دورات`, `${row.courses_done} of ${row.courses_total} courses`)}
                    {row.school_name && ` · ${row.school_name}`}
                  </p>
                </div>
              ))}
            </div>
          )}

          {donePaths.length > 0 && (
            <>
              <p className="profile-label">{t('مسارات مكتملة', 'Paths completed')}</p>
              <ul className="profile-list">
                {donePaths.map((row) => (
                  <li key={row.path_slug}>
                    <Link href={`/academy/${row.path_slug}`}>{contentText(locale, row.title_ar, row.title_en)}</Link>
                    <span className="status-pill status-ok">{t('✓ مكتمل', '✓ Complete')}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      )}

      {can('projects') && (projects ?? []).length > 0 && (
        <section className="panel section-block">
          <h2 className="profile-heading">{t('مشاريع في المعرض', 'Projects in the exhibition')}</h2>
          <ul className="profile-list">
            {(projects ?? []).map((project) => (
              <li key={project.entry_code}>
                <Link href={`/exhibition/${project.entry_code}`}>{project.project_title}</Link>
                {project.team_title && <span className="muted">{project.team_title}</span>}
                <span className="muted eng">{formatDate(locale, project.published_at)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {can('evaluations') && (reputation ?? []).length > 0 && (
        <section className="panel section-block">
          <h2 className="profile-heading">{t('السمعة المهنية', 'Professional standing')}</h2>
          <div className="reputation-bars">
            {(reputation ?? []).map((row) => (
              <div key={row.dimension}>
                <div className="row-between">
                  <span>{row.name_ar}</span>
                  <span className="eng">{Math.round(row.value)}%</span>
                </div>
                <div className="progress-track">
                  <div className="progress-fill" style={{ width: `${row.value}%` }} />
                </div>
              </div>
            ))}
          </div>
          <p className="muted" style={{ fontSize: '0.74rem', marginTop: 12 }}>
            {t('كل مؤشر محسوب من سجلات حقيقية: تقييمات المنتورين، لجان المعرض، جلسات الإرشاد، وعملاء دفعوا فعلاً. ما كُتب لصاحب العمل شخصياً يبقى بينهما.',
               'Every meter is worked out from real records: mentors’ evaluations, exhibition panels, mentoring sessions and clients who actually paid. What was written to the person privately stays between them.')}
          </p>
        </section>
      )}

      {can('evaluations') && (clientReviews ?? []).length > 0 && (
        <section className="panel section-block">
          <h2 className="profile-heading">{t('ما قاله العملاء', 'What clients said')}</h2>
          <ul className="profile-list">
            {(clientReviews ?? []).map((review) => (
              <li key={review.id}>
                <span>
                  <strong>{review.project_title ?? t('عمل', 'Work')}</strong>
                  <span className="muted"> · {review.client_name ?? t('عميل', 'A client')}</span>
                </span>
                <span><Stars value={review.stars} /></span>
                {review.comment_ar && <span className="muted">{review.comment_ar}</span>}
              </li>
            ))}
          </ul>
          <p className="muted" style={{ fontSize: '0.74rem', marginTop: 10 }}>
            {t('لا يُكتب تقييم عميل إلا بعد أن يتحرّك المال فعلاً عبر المنصة.',
               'A client review can only be written once money has actually moved through the platform.')}
          </p>
        </section>
      )}

      {can('experience') && (experience ?? []).length > 0 && (
        <section className="panel section-block">
          <h2 className="profile-heading">{t('الخبرة', 'Experience')}</h2>
          <ul className="profile-list">
            {(experience ?? []).map((row) => (
              <li key={row.id}>
                <span><strong>{row.title}</strong> · {row.organisation}</span>
                <span className="tag">{t(EXPERIENCE_LABEL[row.kind])}</span>
                <span className="muted eng">{span(row.started_on, row.ended_on, row.is_current)}</span>
                {row.summary && <span className="muted">{row.summary}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {can('education') && (education ?? []).length > 0 && (
        <section className="panel section-block">
          <h2 className="profile-heading">{t('التعليم', 'Education')}</h2>
          <ul className="profile-list">
            {(education ?? []).map((row) => (
              <li key={row.id}>
                <span><strong>{row.institution}</strong>{row.degree ? ` · ${row.degree}` : ''}</span>
                {row.field && <span className="muted">{row.field}</span>}
                <span className="muted eng">{span(row.started_on, row.ended_on, row.is_current)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {can('external_exhibitions') && (external ?? []).length > 0 && (
        <section className="panel section-block">
          <h2 className="profile-heading">{t('مشاركات خارج TechMood', 'Outside TechMood')}</h2>
          <ul className="profile-list">
            {(external ?? []).map((row) => (
              <li key={row.id}>
                <span><strong>{row.title}</strong>{row.organiser ? ` · ${row.organiser}` : ''}</span>
                {row.role_ar && <span className="muted">{row.role_ar}</span>}
                {row.result_ar && <span className="muted">{row.result_ar}</span>}
                {row.held_on && <span className="muted eng">{year(row.held_on)}</span>}
                <span className="status-pill status-ok">{t('✓ تحقّقت منها الإدارة', '✓ Checked by TechMood')}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {can('links') && (links ?? []).length > 0 && (
        <section className="panel section-block">
          <h2 className="profile-heading">{t('ملفات أخرى', 'Elsewhere')}</h2>
          <div className="explore-row">
            {(links ?? []).map((link) => (
              <a className="explore-chip" href={link.url} target="_blank" rel="noreferrer" key={link.id}>
                {link.label ?? LINK_LABEL[link.kind]}
              </a>
            ))}
          </div>
        </section>
      )}

      <p className="muted" style={{ fontSize: '0.76rem', textAlign: 'center', margin: '24px 0 48px' }}>
        {t('هوية مهنية واحدة داخل TechMood: حساب واحد، معرّف واحد، سجلّ واحد.',
           'One professional identity inside TechMood: one account, one id, one record.')}
      </p>
    </>,
  );
}
