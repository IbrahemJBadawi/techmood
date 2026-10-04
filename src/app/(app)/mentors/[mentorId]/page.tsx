import Link from 'next/link';
import { notFound } from 'next/navigation';

import { Icon } from '@/components/Icon';
import { Stars } from '@/components/Stars';
import { avatarColor, domainLabel, initialOf } from '@/lib/mentor-look';
import { FollowButton } from '@/components/Social';
import { createClient } from '@/lib/supabase/server';
import { getT } from '@/lib/i18n.server';
import { type Text } from '@/lib/i18n';
import { money } from '@/lib/booking';
import { AiSurface } from '@/components/AiSurface';
import { AskAI } from '@/components/AskAI';
import { FeedbackSummary } from '@/components/FeedbackSummary';
import { mentorLevelLabel } from '@/lib/mentor-levels';

const DAY_NAMES: Text[] = [
  { ar: 'الأحد',    en: 'Sunday' },
  { ar: 'الاثنين',  en: 'Monday' },
  { ar: 'الثلاثاء', en: 'Tuesday' },
  { ar: 'الأربعاء', en: 'Wednesday' },
  { ar: 'الخميس',   en: 'Thursday' },
  { ar: 'الجمعة',   en: 'Friday' },
  { ar: 'السبت',    en: 'Saturday' },
];

export default async function MentorProfilePage({
  params,
}: {
  params: Promise<{ mentorId: string }>;
}) {
  const { mentorId } = await params;
  const t = await getT();
  const supabase = await createClient();

  const { data: mentor } = await supabase
    .from('mentor_profiles')
    .select('profile_id, level, headline_ar, bio_ar, domains, session_minutes, is_accepting, sessions_count, rating_avg, pause_reason, paused_until, pause_note_ar')
    .eq('profile_id', mentorId)
    .maybeSingle();

  if (!mentor) notFound();

  const { data: { user } } = await supabase.auth.getUser();

  const [{ data: profile }, { data: prices }, { data: availability }, { data: offered }, { data: followRows }] = await Promise.all([
    supabase.from('profiles').select('full_name, techmood_id, bio, github_url, linkedin_url, avatar_url').eq('id', mentorId).single(),
    supabase.rpc('mentor_price_list', { p_mentor: mentorId }),
    supabase.from('mentor_availability').select('day_of_week, start_time, end_time').eq('mentor_id', mentorId).order('day_of_week'),
    supabase
      .from('mentor_session_types')
      .select('is_active, session_types(id, name_ar, description_ar, duration_minutes)')
      .eq('mentor_id', mentorId)
      .eq('is_active', true),
    supabase.rpc('follow_stats', { p_profile: mentorId }),
  ]);
  const follow = followRows?.[0];

  // The gallery (0115): what this mentor wrote in the studio and TechMood
  // approved — open courses and paths, and the ones announced as coming.
  const [{ data: galleryCourses }, { data: galleryPaths }] = await Promise.all([
    supabase.from('courses')
      .select('id, slug, title_ar, description_ar, status, path_courses(learning_paths(slug, status))')
      .eq('author_id', mentorId).in('status', ['published', 'planned']).order('title_ar'),
    supabase.from('learning_paths')
      .select('id, slug, title_ar, tagline_ar, status')
      .eq('author_id', mentorId).in('status', ['published', 'planned']).order('title_ar'),
  ]);
  const courseHref = (row: { slug: string; path_courses: unknown }) => {
    const paths = ((row.path_courses as { learning_paths: { slug: string; status: string } | null }[] | null) ?? [])
      .map((link) => link.learning_paths).filter((path) => path && path.status !== 'draft' && path.status !== 'archived');
    return `/academy/${paths[0]?.slug ?? 'preview'}/${row.slug}`;
  };
  const hasGallery = (galleryCourses ?? []).length + (galleryPaths ?? []).length > 0;

  const sessionTypes = (offered ?? []).map(
    (row) => row.session_types as unknown as { id: string; name_ar: string; description_ar: string | null; duration_minutes: number },
  );
  // Each mentor prices their own sessions inside their level's band (0077).
  const priceOf = new Map((prices ?? []).map((row) => [row.session_type_id, Number(row.price_usd)]));
  const offeredPrices = sessionTypes.map((type) => priceOf.get(type.id)).filter((value): value is number => value !== undefined);
  const fromPrice = offeredPrices.length ? Math.min(...offeredPrices) : null;

  return (
    <>
      <AiSurface surface="mentor" entityType="mentor" entityId={mentorId} label={profile?.full_name ?? undefined} />

      <Link className="btn btn-ghost btn-sm" href="/mentors">{t('→ رجوع للمنتورز', '← Back to mentors')}</Link>
      <AskAI prompt="جهّز لي خمسة أسئلة محدّدة أطرحها على هذا المنتور في الجلسة القادمة." />

      <section className="section-block pp-card mn-profile" style={{ marginTop: 16 }}>
        <div className="pp-cover mn-cover" aria-hidden="true" style={{ '--hue': avatarColor(mentorId) } as React.CSSProperties} />
        <div className="pp-head">
          <span className="pp-avatar pp-avatar-initial mn-avatar-lg" style={{ background: avatarColor(mentorId) }}>
            {profile?.avatar_url
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={profile.avatar_url} alt="" />
              : initialOf(profile?.full_name)}
          </span>
          <div className="pp-actions">
            {user && user.id !== mentorId && (
              <FollowButton
                profileId={mentorId}
                followers={follow?.followers ?? 0}
                following={follow?.i_follow ?? false}
                signedIn
                path={`/mentors/${mentorId}`}
              />
            )}
          </div>
        </div>

        <div className="pp-identity">
          <h2>{profile?.full_name} <span className="mn-level eng">{mentorLevelLabel(mentor.level)}</span></h2>
          {mentor.headline_ar && <p className="pp-headline">{mentor.headline_ar}</p>}
          <div className="mn-rating">
            <Stars value={mentor.rating_avg ?? 0} />
            <span className="eng">{mentor.rating_avg ? Number(mentor.rating_avg).toFixed(1) : '—'}</span>
            <span className="muted">· {t(`${mentor.sessions_count} جلسة مكتملة`, `${mentor.sessions_count} ${mentor.sessions_count === 1 ? 'session' : 'sessions'} held`)}</span>
            <span className="id-chip">{profile?.techmood_id}</span>
          </div>
          {mentor.bio_ar && <p className="pp-bio">{mentor.bio_ar}</p>}
          {(mentor.domains ?? []).length > 0 && (
            <div className="mn-domains">
              {(mentor.domains ?? []).map((domain) => <span className="mn-domain" key={domain}>{domainLabel(domain)}</span>)}
            </div>
          )}
        </div>

        <div className="mn-book-bar">
          <span className="mn-price">
            {fromPrice !== null
              ? <>{t('من ', 'From ')}<strong className="eng">{money(fromPrice)}</strong>{t(' / جلسة', ' / session')}</>
              : <span className="muted">—</span>}
          </span>
          {mentor.is_accepting && sessionTypes.length > 0 ? (
            <Link className="btn btn-primary btn-lg" href={`/mentors/${mentorId}/book`}>
              <Icon name="calendar" size={18} />{t('احجز جلسة', 'Book a session')}
            </Link>
          ) : (
            <span className="status-pill status-muted">
              {mentor.pause_reason === 'vacation' && mentor.paused_until
                ? t(`في إجازة حتى ${mentor.paused_until}`, `On holiday until ${mentor.paused_until}`)
                : t('لا يستقبل حجوزات حالياً', 'Not taking bookings right now')}
            </span>
          )}
        </div>
        {!mentor.is_accepting && mentor.pause_note_ar && mentor.pause_reason !== 'unresponsive' && (
          <p className="muted" style={{ fontSize: '0.84rem', marginTop: 8 }}>{mentor.pause_note_ar}</p>
        )}
      </section>

      {mentor.is_accepting && sessionTypes.length > 0 && (
        <div className="mn-sticky-book">
          <span className="mn-price">
            {fromPrice !== null && <>{t('من ', 'From ')}<strong className="eng">{money(fromPrice)}</strong></>}
          </span>
          <Link className="btn btn-primary" href={`/mentors/${mentorId}/book`}>{t('احجز جلسة', 'Book a session')}</Link>
        </div>
      )}

      <FeedbackSummary profileId={mentorId} isMentor />

      {(hasGallery || user?.id === mentorId) && (
        <section className="panel section-block">
          <div className="row-between" style={{ flexWrap: 'wrap', gap: 8 }}>
            <h3 style={{ fontSize: '0.98rem' }}>{t('دورات ومسارات من إعداده', 'Courses and paths by this mentor')}</h3>
            {user?.id === mentorId && <Link className="btn btn-ghost btn-sm" href="/studio">{t('استوديو المحتوى', 'Content studio')}</Link>}
          </div>
          {!hasGallery ? (
            <p className="muted" style={{ fontSize: '0.86rem', marginTop: 8 }}>
              {t('لم يُنشر لك محتوى بعد. اكتب دورتك الأولى في الاستوديو، وحين تُعتمد تظهر هنا وفي الأكاديمية باسمك.',
                 'Nothing of yours is published yet. Write your first course in the studio; once approved it shows here and in the academy under your name.')}
            </p>
          ) : (
            <ul className="mn-gallery">
              {(galleryPaths ?? []).map((path) => (
                <li key={path.id}>
                  <Link href={`/academy/${path.slug}`}>
                    <span className="kicker">{t('مسار', 'Path')}</span>
                    <strong>{path.title_ar}</strong>
                    {path.tagline_ar && <span className="muted">{path.tagline_ar}</span>}
                    {path.status === 'planned' && <span className="status-pill status-pending">{t('قريباً', 'Coming soon')}</span>}
                  </Link>
                </li>
              ))}
              {(galleryCourses ?? []).map((course) => (
                <li key={course.id}>
                  <Link href={courseHref(course)}>
                    <span className="kicker">{t('دورة', 'Course')}</span>
                    <strong>{course.title_ar}</strong>
                    {course.description_ar && <span className="muted">{course.description_ar}</span>}
                    {course.status === 'planned' && <span className="status-pill status-pending">{t('قريباً', 'Coming soon')}</span>}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <div className="detail-grid">
        <section className="panel">
          <h3 style={{ fontSize: '0.98rem', marginBottom: 12 }}>{t('أنواع الجلسات', 'Session types')}</h3>
          {sessionTypes.length === 0 ? (
            <p className="muted" style={{ fontSize: '0.86rem' }}>{t('لم يحدد هذا المنتور أنواع جلساته بعد.', 'This mentor has not set up session types yet.')}</p>
          ) : (
            <div className="mn-types">
              {sessionTypes.map((type) => (
                <div className="mn-type" key={type.id}>
                  <div className="mn-type-main">
                    <strong>{type.name_ar}</strong>
                    {type.description_ar && <p className="muted">{type.description_ar}</p>}
                    <span className="mn-type-meta"><Icon name="clock" size={14} />{t(`${type.duration_minutes} دقيقة`, `${type.duration_minutes} min`)}</span>
                  </div>
                  {priceOf.has(type.id) && <span className="mn-type-price eng">{money(priceOf.get(type.id)!)}</span>}
                </div>
              ))}
            </div>
          )}
        </section>

        <aside className="panel">
          <h3 style={{ fontSize: '0.98rem', marginBottom: 12 }}>{t('أوقات التوفر', 'Availability')}</h3>
          {(availability?.length ?? 0) === 0 ? (
            <p className="muted" style={{ fontSize: '0.86rem' }}>{t('لم يُنشر جدول توفر بعد.', 'No availability published yet.')}</p>
          ) : (
            <ul className="mn-days">
              {availability!.map((slot, index) => (
                <li key={`${slot.day_of_week}-${index}`}>
                  <span>{t(DAY_NAMES[slot.day_of_week])}</span>
                  <span className="eng">{slot.start_time.slice(0, 5)}–{slot.end_time.slice(0, 5)}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="muted" style={{ fontSize: '0.76rem', marginTop: 10 }}>
            {t('بحد أقصى 5 ساعات يومياً، والحجز قبل 72 ساعة على الأقل.', 'At most five hours a day, and bookings need 72 hours’ notice.')}
          </p>
        </aside>
      </div>
    </>
  );
}
