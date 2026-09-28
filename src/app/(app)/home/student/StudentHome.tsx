import Link from 'next/link';

import { Icon } from '@/components/Icon';
import { Stars } from '@/components/Stars';
import { avatarColor, initialOf } from '@/lib/mentor-look';
import { createClient } from '@/lib/supabase/server';
import { getT } from '@/lib/i18n.server';
import { contentText, formatDate, formatDateTime, type Text } from '@/lib/i18n';
import { IS_MVP } from '@/lib/scope';

import { Avatar } from '../../shell/ProfileMenu';
import { ContinueLearning, type Resume } from './ContinueLearning';
import { DailyBoard, type AgendaEntry } from './DailyBoard';
import { Leaderboard, type Boards, type WindowKey } from './Leaderboard';
import { Pomodoro } from './Pomodoro';
import { StudentHero, StreakCard, type ActivityDay } from './StudentHero';
import { ProgressRing } from '../../academy/ProgressRing';

const KIND_LABEL: Record<string, Text> = {
  freelance:  { ar: 'عمل حر',        en: 'Freelance' },
  job:        { ar: 'وظيفة',         en: 'Job' },
  team_seat:  { ar: 'مقعد في فريق',  en: 'Team seat' },
  cofounder:  { ar: 'شريك مؤسس',     en: 'Co-founder' },
  internship: { ar: 'تدريب',         en: 'Internship' },
  remote:     { ar: 'عن بُعد',       en: 'Remote' },
};

function since(windowKey: WindowKey): string | null {
  const now = new Date();
  if (windowKey === 'month') return new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  if (windowKey === 'year') return new Date(now.getFullYear(), 0, 1).toISOString();
  return null;
}

/**
 * The student command centre.
 *
 * Read it top to bottom and it answers, in order: where do I stand, what do I
 * do now, what am I on, who am I seeing, who am I with, what is open to me,
 * what have I earned, how far have I come, what is my standing, where am I
 * ranked, who could help, and what else is here.
 *
 * Sections that belong to data the person does not have — a team, a booked
 * session — are not rendered as empty boxes; they are replaced by the one
 * action that would fill them.
 */
export async function StudentHome({
  userId,
  profile,
  windowKey,
}: {
  userId: string;
  profile: {
    full_name: string;
    display_name: string | null;
    techmood_id: string;
    avatar_url: string | null;
  };
  windowKey: WindowKey;
}) {
  const t = await getT();
  const supabase = await createClient();
  const today = new Date();
  const from = new Date(today);
  from.setDate(from.getDate() - 6);
  const asDate = (value: Date) => value.toISOString().slice(0, 10);

  const [
    { data: xp },
    { data: stars },
    { data: week },
    { data: streak },
    { data: resumeRows },
    { data: agenda },
    { data: progressRows },
    { data: primaryField },
    { data: sessions },
    { data: membership },
    { data: suggestions },
    { data: mentors },
    { data: achievements },
    { data: reputation },
    { data: myRank },
  ] = await Promise.all([
    supabase.from('profile_xp').select('total_xp').eq('profile_id', userId).maybeSingle(),
    supabase.from('profile_stars').select('stars_avg, rated_count').eq('profile_id', userId).maybeSingle(),
    supabase.rpc('activity_days', { p_from: asDate(from), p_to: asDate(today) }),
    supabase.rpc('current_streak'),
    supabase.rpc('continue_learning'),
    supabase.rpc('student_agenda', { p_horizon_days: 14 }),
    supabase.rpc('student_progress'),
    supabase.from('profile_fields').select('field_id').eq('profile_id', userId).eq('is_primary', true).maybeSingle(),
    supabase
      .from('bookings')
      .select('id, topic_ar, scheduled_start, scheduled_end, status, mentor_id')
      .eq('student_id', userId)
      .in('status', ['confirmed', 'payment_verified', 'mentor_pending'])
      .gte('scheduled_start', new Date().toISOString())
      .order('scheduled_start')
      .limit(3),
    supabase.from('team_members').select('team_id, role, title_ar').eq('profile_id', userId).eq('is_active', true).limit(1),
    supabase.rpc('suggested_opportunities', { p_limit: 4 }),
    supabase.rpc('suggested_mentors', { p_limit: 3 }),
    supabase
      .from('profile_achievements')
      .select('achievement_id, awarded_at')
      .eq('profile_id', userId)
      .order('awarded_at', { ascending: false })
      .limit(6),
    supabase.from('reputation_scores').select('dimension, value').eq('profile_id', userId),
    supabase.rpc('my_leaderboard_rank', { p_since: since(windowKey) }),
  ]);

  const resume = ((resumeRows as Resume[] | null) ?? [])[0] ?? null;
  const progress = (progressRows ?? [])[0] ?? null;
  const entries = (agenda ?? []) as AgendaEntry[];

  // Paths, mentors of the upcoming sessions, and the team are looked up only
  // when there is something to look up.
  const mentorIds = [...new Set((sessions ?? []).map((row) => row.mentor_id))];
  const teamId = membership?.[0]?.team_id ?? null;
  const achievementIds = (achievements ?? []).map((row) => row.achievement_id);
  const dimensionKeys = (reputation ?? []).map((row) => row.dimension);

  // Lookups are separate queries rather than PostgREST embeds: the hand-written
  // schema types declare no relationships, so an embed would typecheck as an
  // error object. Separate reads are also easier to reason about under RLS.
  const [{ data: paths }, { data: mentorNames }, { data: badges }, { data: dimensions }, team] = await Promise.all([
    supabase
      .from('enrollments')
      .select('path_id, enrolled_at, completed_at')
      .eq('profile_id', userId)
      .not('path_id', 'is', null)
      .order('enrolled_at', { ascending: false }),
    mentorIds.length
      ? supabase.from('profiles').select('id, full_name, display_name, avatar_url').in('id', mentorIds)
      : Promise.resolve({ data: [] as { id: string; full_name: string; display_name: string | null; avatar_url: string | null }[] }),
    achievementIds.length
      ? supabase.from('achievements').select('id, name_ar, icon').in('id', achievementIds)
      : Promise.resolve({ data: [] as { id: string; name_ar: string; icon: string | null }[] }),
    dimensionKeys.length
      ? supabase.from('reputation_dimensions').select('slug, name_ar').in('slug', dimensionKeys)
      : Promise.resolve({ data: [] as { slug: string; name_ar: string }[] }),
    teamId ? loadTeam(teamId) : Promise.resolve(null),
  ]);

  const badgeById = new Map((badges ?? []).map((row) => [row.id, row]));
  const dimensionName = new Map((dimensions ?? []).map((row) => [row.slug, row.name_ar]));

  const boards = await loadBoards(since(windowKey));

  const nameOf = new Map((mentorNames ?? []).map((row) => [row.id, row.display_name ?? row.full_name]));

  // A confirmed booking has a room of its own; the card links into it rather
  // than to a link somebody could forward.
  const bookingIds = (sessions ?? []).map((row) => row.id);
  const { data: rooms } = bookingIds.length
    ? await supabase.from('video_sessions').select('id, booking_id').in('booking_id', bookingIds)
    : { data: [] as { id: string; booking_id: string | null }[] };
  const roomOf = new Map((rooms ?? []).map((room) => [room.booking_id ?? '', room.id]));
  const displayName = profile.display_name ?? profile.full_name;
  const { data: primaryFieldRow } = primaryField?.field_id
    ? await supabase.from('fields').select('name_ar').eq('id', primaryField.field_id).maybeSingle()
    : { data: null };
  const fieldName = primaryFieldRow?.name_ar ?? null;

  const pathIds = (paths ?? []).map((row) => row.path_id).filter(Boolean) as string[];
  const { data: pathDetails } = pathIds.length
    ? await supabase
        .from('learning_paths')
        .select('id, slug, title_ar, title_en, description_ar, tags')
        .in('id', pathIds)
    : { data: [] };
  const pathById = new Map((pathDetails ?? []).map((row) => [row.id, row]));

  const pathRows = (paths ?? [])
    .map((row) => ({
      enrolledAt: row.enrolled_at,
      completedAt: row.completed_at,
      path: row.path_id ? pathById.get(row.path_id) ?? null : null,
    }))
    .filter((row) => row.path !== null);

  const statTiles = [
    { icon: '📘', value: progress?.courses_completed ?? 0, label: t('دورات مكتملة', 'Courses completed'), href: '/academy' },
    { icon: '✅', value: progress?.assessments_passed ?? 0, label: t('اختبارات مجتازة', 'Assessments passed'), href: '/academy' },
    { icon: '🎓', value: progress?.certificates ?? 0, label: t('شهادات موثّقة', 'Verified certificates'), href: '/certificates' },
    { icon: '🏅', value: progress?.achievements ?? 0, label: t('أوسمة', 'Badges'), href: '/passport' },
  ];

  const progressItems = [
    { label: t('دروس أُكملت', 'Lessons completed'), value: progress?.lessons_completed ?? 0 },
    { label: t('أعمال معتمدة', 'Work approved'), value: progress?.work_approved ?? 0 },
    { label: t('جلسات حضرتها', 'Sessions attended'), value: progress?.sessions_attended ?? 0 },
    { label: t('مهام فريق أنجزتها', 'Team tasks closed'), value: progress?.team_tasks_done ?? 0 },
  ];
  const skillsTotal = progress?.skills_total ?? 0;
  const skillsVerified = progress?.skills_verified ?? 0;
  const topReputation = [...(reputation ?? [])].sort((a, b) => b.value - a.value).slice(0, 4);

  return (
    <>
      <StudentHero
        name={displayName}
        avatarUrl={profile.avatar_url}
        primaryField={fieldName}
        currentPath={resume ? { slug: resume.path_slug, title: resume.path_title, percent: resume.path_percent } : null}
        totalXp={xp?.total_xp ?? 0}
        stars={stars?.stars_avg ?? 0}
        streak={typeof streak === 'number' ? streak : 0}
      />

      <div className="hm-layout">
        <div className="hm-main">
          <section className="section-block">
            <ContinueLearning resume={resume} />
          </section>

          <DailyBoard entries={entries} />

          {/* upcoming mentor sessions */}
          <section className="section-block">
            <div className="hm-head">
              <h2>{t('جلساتي القادمة', 'My next sessions')}</h2>
              <Link href="/bookings">{t('كل حجوزاتي', 'All my bookings')}</Link>
            </div>
            {(sessions ?? []).length === 0 ? (
              <div className="hm-card hm-empty">
                <span className="hm-empty-icon" aria-hidden="true"><Icon name="mentor" size={22} /></span>
                <div>
                  <strong>{t('لا جلسات قادمة', 'No sessions coming up')}</strong>
                  <p className="muted">{t('جلسة واحدة مع منتور قد توفّر عليك أسابيع.', 'One session with a mentor can save you weeks.')}</p>
                </div>
                <Link className="btn btn-primary btn-sm" href="/mentors">{t('ابحث عن منتور', 'Find a mentor')}</Link>
              </div>
            ) : (
              <ul className="hm-card hm-list">
                {(sessions ?? []).map((session) => {
                  const mentorName = nameOf.get(session.mentor_id) ?? t('منتور', 'Mentor');
                  const minutes = Math.round((new Date(session.scheduled_end).getTime() - new Date(session.scheduled_start).getTime()) / 60000);
                  const room = !IS_MVP ? roomOf.get(session.id) : undefined;
                  return (
                    <li key={session.id}>
                      <Link className="hm-row" href={room ? `/sessions/${room}` : `/bookings/${session.id}`}>
                        <span className="hm-row-avatar" style={{ background: avatarColor(session.mentor_id) }} aria-hidden="true">
                          {initialOf(mentorName)}
                        </span>
                        <span className="hm-row-main">
                          <strong>{session.topic_ar ?? t('جلسة إرشاد', 'Mentoring session')}</strong>
                          <span className="muted">
                            {mentorName} · <span className="date">{formatDateTime(t.locale, session.scheduled_start)}</span>
                            {' · '}{t(`${minutes} دقيقة`, `${minutes} min`)}
                          </span>
                        </span>
                        <span className={`pill pill-${session.status === 'confirmed' ? 'ok' : 'wait'}`}>
                          {session.status === 'confirmed' ? t('مؤكّدة', 'Confirmed') : t('بانتظار التأكيد', 'Awaiting confirmation')}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {/* my paths */}
          <section className="section-block">
            <div className="hm-head">
              <h2>{t('مساراتي', 'My paths')}</h2>
              <Link href="/academy">{t('كل المسارات', 'All paths')}</Link>
            </div>
            {pathRows.length === 0 ? (
              <div className="hm-card hm-empty">
                <span className="hm-empty-icon" aria-hidden="true"><Icon name="academy" size={22} /></span>
                <div>
                  <strong>{t('لم تنضم إلى مسار بعد', 'No path yet')}</strong>
                  <p className="muted">{t('المسارات مفتوحة دائماً.', 'Paths are always open.')}</p>
                </div>
                <Link className="btn btn-primary btn-sm" href="/academy">{t('ابدأ', 'Start')}</Link>
              </div>
            ) : (
              <ul className="hm-card hm-list">
                {pathRows.map((row) => {
                  const percent = row.completedAt ? 100 : resume?.path_slug === row.path!.slug ? resume.path_percent : null;
                  return (
                    <li key={row.path!.id}>
                      <Link className="hm-row" href={`/academy/${row.path!.slug}`}>
                        {percent !== null
                          ? <ProgressRing percent={percent} size={44} stroke={4} label={t('تقدّم المسار', 'Path progress')} />
                          : <span className="hm-row-icon" style={{ background: 'var(--royal)' }}><Icon name="academy" size={16} /></span>}
                        <span className="hm-row-main">
                          <strong>{contentText(t.locale, row.path!.title_ar, row.path!.title_en)}</strong>
                          <span className="muted">
                            {(row.path!.tags ?? []).slice(0, 3).join(' · ')}
                            {(row.path!.tags ?? []).length > 0 && ' · '}
                            {t('انضممت ', 'Joined ')}<span className="date">{formatDate(t.locale, row.enrolledAt)}</span>
                          </span>
                        </span>
                        <span className={`pill pill-${row.completedAt ? 'ok' : 'ask'}`}>
                          {row.completedAt ? t('مكتمل', 'Completed') : t('نشِط', 'Active')}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {/* my team */}
          <section className="section-block">
            <div className="hm-head">
              <h2>{t('فريقي', 'My team')}</h2>
              <Link href="/teams">{t('الفرق', 'Teams')}</Link>
            </div>
            {team ? (
              <Link className="hm-card hm-team" href={`/teams/${team.id}`}>
                <Avatar name={team.title_ar} url={team.avatar_url} size={48} />
                <span className="hm-row-main">
                  <strong>{team.title_ar}</strong>
                  <span className="muted">
                    {t('يقوده ', 'Led by ')}{team.leaderName}
                    {t(' · دورك: ', ' · your role: ')}
                    {membership?.[0]?.title_ar
                      ?? (membership?.[0]?.role === 'leader' ? t('قائد', 'Leader') : t('عضو', 'Member'))}
                  </span>
                </span>
                <span className="hm-team-stats">
                  <span className="hm-count">{t(`${team.openTasks} مهمة مفتوحة`, `${team.openTasks} open`)}</span>
                  {team.stars > 0 && <Stars value={team.stars} />}
                </span>
              </Link>
            ) : (
              <div className="hm-card hm-empty">
                <span className="hm-empty-icon" aria-hidden="true"><Icon name="team" size={22} /></span>
                <div>
                  <strong>{t('لست في فريق بعد', 'Not in a team yet')}</strong>
                  <p className="muted">{t('أغلب العمل الحقيقي يحدث ضمن فريق.', 'Most real work happens in a team.')}</p>
                </div>
                <Link className="btn btn-primary btn-sm" href="/teams">{t('انضم أو أنشئ', 'Join or start one')}</Link>
              </div>
            )}
          </section>

          {/* openings that fit */}
          <section className="section-block">
            <div className="hm-head">
              <h2>{t('فرص تناسبك', 'Openings that fit you')}</h2>
              <Link href="/marketplace">{t('كل الفرص', 'All openings')}</Link>
            </div>
            {(suggestions ?? []).length === 0 ? (
              <p className="hm-card muted" style={{ fontSize: '0.88rem' }}>
                {t('لا فرص مفتوحة تطابق مجالاتك الآن.', 'No open postings match your fields right now.')}
              </p>
            ) : (
              <div className="hm-opps">
                {(suggestions ?? []).map((item) => {
                  const need = item.required_skills?.length ?? 0;
                  const have = item.matched_skills?.length ?? 0;
                  return (
                    <Link className="hm-card hm-opp" href={`/marketplace/${item.id}`} key={item.id}>
                      <span className="hm-opp-top">
                        <span className="tag">{KIND_LABEL[item.kind] ? t(KIND_LABEL[item.kind]) : item.kind}</span>
                        {!item.is_eligible && <span className="pill pill-wait">{t('لم تستوفِ الشروط', 'Not eligible yet')}</span>}
                      </span>
                      <strong>{item.title_ar}</strong>
                      {item.organization_ar && <span className="muted">{item.organization_ar}</span>}
                      {need > 0 && (
                        <span className="hm-opp-match">
                          <span className="hm-resume-track is-soft"><span style={{ width: `${Math.round((have / need) * 100)}%` }} /></span>
                          <span className="muted">{t(`${have} من ${need} مهارات`, `${have} of ${need} skills`)}</span>
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            )}
          </section>
        </div>

        <aside className="hm-rail" aria-label={t('إحصائياتي', 'My stats')}>
          <StreakCard
            streak={typeof streak === 'number' ? streak : 0}
            week={(week ?? []) as ActivityDay[]}
            totalXp={xp?.total_xp ?? 0}
          />

          <Pomodoro suggestion={resume?.lesson_title ?? null} />

          <Leaderboard boards={boards} myRank={typeof myRank === 'number' ? myRank : null} windowKey={windowKey} />

          {/* achievements */}
          <article className="hm-card">
            <div className="hm-card-head">
              <h3>{t('إنجازاتي', 'My achievements')}</h3>
              <Link href="/passport">{t('الجواز', 'Passport')}</Link>
            </div>
            <div className="hm-tiles">
              {statTiles.map((tile) => (
                <Link className="hm-tile" href={tile.href} key={tile.label}>
                  <span aria-hidden="true">{tile.icon}</span>
                  <strong>{tile.value}</strong>
                  <span className="muted">{tile.label}</span>
                </Link>
              ))}
            </div>
            {(achievements ?? []).length > 0 && (
              <div className="hm-badges">
                {(achievements ?? []).map((row) => {
                  const badge = badgeById.get(row.achievement_id);
                  return (
                    <span className="hm-badge" key={row.achievement_id} title={badge?.name_ar}>
                      <span aria-hidden="true">{badge?.icon ?? '🏅'}</span> {badge?.name_ar}
                    </span>
                  );
                })}
              </div>
            )}
          </article>

          {/* progress and reputation */}
          <article className="hm-card">
            <div className="hm-card-head">
              <h3>{t('تقدّمي وسمعتي', 'Progress & reputation')}</h3>
              <Link href="/passport">{t('التفاصيل', 'Details')}</Link>
            </div>
            <ul className="hm-kv">
              {progressItems.map((row) => (
                <li key={row.label}><span className="muted">{row.label}</span><strong>{row.value}</strong></li>
              ))}
            </ul>
            <div className="hm-meter">
              <div className="row-between">
                <span className="muted">{t('مهارات موثّقة', 'Verified skills')}</span>
                <strong>{skillsVerified} / {skillsTotal}</strong>
              </div>
              <div className="progress-track">
                <div className="progress-fill" style={{ width: `${skillsTotal ? Math.round((skillsVerified / skillsTotal) * 100) : 0}%` }} />
              </div>
            </div>
            {topReputation.length === 0 ? (
              <p className="muted" style={{ fontSize: '0.8rem', marginTop: 10 }}>
                {t('مقاييس السمعة تُحسب من مراجعات المنتورز وتقييمات الفرق. لم يُسجَّل لك تقييم بعد.',
                   'Reputation meters come from mentor reviews and team ratings. Nothing has been recorded for you yet.')}
              </p>
            ) : (
              topReputation.map((row) => (
                <div className="hm-meter" key={row.dimension}>
                  <div className="row-between">
                    <span className="muted">{dimensionName.get(row.dimension) ?? row.dimension}</span>
                    <strong>{Math.round(row.value)}</strong>
                  </div>
                  <div className="progress-track">
                    <div className="progress-fill is-green" style={{ width: `${Math.min(100, row.value)}%` }} />
                  </div>
                </div>
              ))
            )}
            <p className="muted" style={{ fontSize: '0.74rem', marginTop: 10 }}>
              {t('النجوم جودة، والنقاط كمّية. لا يُجمعان في رقم واحد.', 'Stars are quality, points are quantity. They are never added into one figure.')}
            </p>
          </article>

          {/* mentors who might suit you */}
          <article className="hm-card">
            <div className="hm-card-head">
              <h3>{t('منتورز قد يناسبونك', 'Mentors for you')}</h3>
              <Link href="/mentors">{t('الكل', 'All')}</Link>
            </div>
            {(mentors ?? []).length === 0 ? (
              <p className="muted" style={{ fontSize: '0.84rem' }}>
                {t('لا منتورز متاحين في مجالاتك الآن.', 'No mentors available in your fields right now.')}
              </p>
            ) : (
              <ul className="hm-list is-flush">
                {(mentors ?? []).map((mentor) => {
                  const name = mentor.display_name ?? mentor.full_name;
                  return (
                    <li key={mentor.profile_id}>
                      <Link className="hm-row" href={`/mentors/${mentor.profile_id}`}>
                        <span className="hm-row-avatar" style={{ background: avatarColor(mentor.profile_id) }} aria-hidden="true">
                          {initialOf(name)}
                        </span>
                        <span className="hm-row-main">
                          <strong>{name}</strong>
                          <span className="muted">{mentor.headline_ar}</span>
                        </span>
                        <span className="hm-price">${mentor.price_usd}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </article>
        </aside>
      </div>
    </>
  );
}

async function loadTeam(teamId: string) {
  const supabase = await createClient();
  const [{ data: team }, { count: openTasks }, { data: rating }] = await Promise.all([
    supabase.from('teams').select('id, title_ar, avatar_url, leader_id').eq('id', teamId).single(),
    supabase.from('team_tasks').select('*', { count: 'exact', head: true }).eq('team_id', teamId).neq('column_key', 'done'),
    supabase.from('team_stars').select('stars_avg').eq('team_id', teamId).maybeSingle(),
  ]);
  if (!team) return null;

  const { data: leader } = await supabase
    .from('profiles').select('full_name, display_name').eq('id', team.leader_id).maybeSingle();

  return {
    id: team.id,
    title_ar: team.title_ar,
    avatar_url: team.avatar_url,
    leaderName: leader?.display_name ?? leader?.full_name ?? '—',
    openTasks: openTasks ?? 0,
    stars: rating?.stars_avg ?? 0,
  };
}

async function loadBoards(p_since: string | null): Promise<Boards> {
  const supabase = await createClient();
  const [students, mentors, teams, companies] = await Promise.all([
    supabase.rpc('leaderboard_students_ranked', { p_since, p_limit: 10 }),
    supabase.rpc('leaderboard_mentors_ranked', { p_since, p_limit: 10 }),
    supabase.rpc('leaderboard_teams_ranked', { p_since, p_limit: 10 }),
    supabase.rpc('leaderboard_companies_ranked', { p_since, p_limit: 10 }),
  ]);

  return {
    students: (students.data ?? []).map((row) => ({
      rank: row.rank, id: row.profile_id, name: row.name, avatarUrl: row.avatar_url,
      points: row.points, stars: row.stars, extra: row.achievements,
    })),
    mentors: (mentors.data ?? []).map((row) => ({
      rank: row.rank, id: row.profile_id, name: row.name, avatarUrl: row.avatar_url,
      points: row.points, stars: row.stars, extra: row.sessions,
    })),
    teams: (teams.data ?? []).map((row) => ({
      rank: row.rank, id: row.team_id, name: row.name, avatarUrl: row.avatar_url,
      points: row.points, stars: row.stars, extra: row.projects,
    })),
    companies: (companies.data ?? []).map((row) => ({
      rank: row.rank, id: row.profile_id, name: row.name, avatarUrl: row.avatar_url,
      points: null, stars: null, extra: row.accepted,
    })),
  };
}
