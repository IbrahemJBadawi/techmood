import Link from 'next/link';

import { Stars } from '@/components/Stars';
import { createClient } from '@/lib/supabase/server';

import { Avatar } from '../../shell/ProfileMenu';
import { ContinueLearning, type Resume } from './ContinueLearning';
import { DailyBoard, type AgendaEntry } from './DailyBoard';
import { Leaderboard, type Boards, type WindowKey } from './Leaderboard';
import { Pomodoro } from './Pomodoro';
import { StudentHero, type ActivityDay } from './StudentHero';

const KIND_LABEL: Record<string, string> = {
  freelance: 'عمل حر',
  job: 'وظيفة',
  team_seat: 'مقعد في فريق',
  cofounder: 'شريك مؤسس',
  internship: 'تدريب',
  remote: 'عن بُعد',
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
      .select('id, topic_ar, scheduled_start, scheduled_end, status, mentor_id, meeting_url')
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
  const displayName = profile.display_name ?? profile.full_name;
  const { data: primaryFieldRow } = primaryField?.field_id
    ? await supabase.from('fields').select('name_ar').eq('id', primaryField.field_id).maybeSingle()
    : { data: null };
  const fieldName = primaryFieldRow?.name_ar ?? null;

  const pathIds = (paths ?? []).map((row) => row.path_id).filter(Boolean) as string[];
  const { data: pathDetails } = pathIds.length
    ? await supabase
        .from('learning_paths')
        .select('id, slug, title_ar, description_ar, tags')
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

  return (
    <>
      <StudentHero
        name={displayName}
        avatarUrl={profile.avatar_url}
        techmoodId={profile.techmood_id}
        primaryField={fieldName}
        currentPath={resume ? { slug: resume.path_slug, title: resume.path_title, percent: resume.path_percent } : null}
        totalXp={xp?.total_xp ?? 0}
        stars={stars?.stars_avg ?? 0}
        ratedCount={stars?.rated_count ?? 0}
        streak={typeof streak === 'number' ? streak : 0}
        week={(week ?? []) as ActivityDay[]}
      />

      {/* 2 — continue learning, the board, and the timer */}
      <section className="section-block">
        <h2 style={{ fontSize: '1.05rem', marginBottom: 10 }}>أكمل تعلّمك</h2>
        <div className="learning-row">
          <ContinueLearning resume={resume} />
          <Pomodoro suggestion={resume?.lesson_title ?? null} />
        </div>
      </section>

      <DailyBoard entries={entries} />

      {/* 3 — my paths */}
      <section className="section-block">
        <div className="row-between" style={{ marginBottom: 10 }}>
          <h2 style={{ fontSize: '1.05rem' }}>مساراتي</h2>
          <Link className="btn btn-ghost btn-sm" href="/academy">كل المسارات</Link>
        </div>

        {pathRows.length === 0 ? (
          <p className="panel muted">
            لم تنضم إلى مسار بعد. المسارات مفتوحة دائماً —{' '}
            <Link href="/academy">ابدأ من هنا</Link>.
          </p>
        ) : (
          <div className="card-grid">
            {pathRows.map((row) => (
              <article className="card" key={row.path!.id}>
                <div className="row-between">
                  <h3>{row.path!.title_ar}</h3>
                  <span className={`pill pill-${row.completedAt ? 'ok' : 'ask'}`}>
                    {row.completedAt ? 'مكتمل' : 'نشِط'}
                  </span>
                </div>
                <div className="tags-row">
                  {row.path!.tags?.map((tag) => <span className="tag eng" key={tag}>{tag}</span>)}
                </div>
                <p className="muted">{row.path!.description_ar}</p>
                <p className="muted" style={{ fontSize: '0.76rem' }}>
                  انضممت في {new Date(row.enrolledAt).toLocaleDateString('ar')}
                </p>
                <Link className="btn btn-ghost btn-sm" href={`/academy/${row.path!.slug}`}>
                  {row.completedAt ? 'عرض المسار' : 'تابع'}
                </Link>
              </article>
            ))}
          </div>
        )}
      </section>

      {/* 4 — upcoming mentor sessions */}
      <section className="section-block">
        <div className="row-between" style={{ marginBottom: 10 }}>
          <h2 style={{ fontSize: '1.05rem' }}>جلسات الإرشاد القادمة</h2>
          <Link className="btn btn-ghost btn-sm" href="/bookings">كل حجوزاتي</Link>
        </div>

        {(sessions ?? []).length === 0 ? (
          <div className="panel empty-state">
            <p className="muted">لا جلسات قادمة.</p>
            <Link className="btn btn-primary btn-sm" href="/mentors">ابحث عن منتور</Link>
          </div>
        ) : (
          <div className="stack">
            {(sessions ?? []).map((session) => (
              <article className="panel session-row" key={session.id}>
                <div>
                  <strong>{nameOf.get(session.mentor_id) ?? 'منتور'}</strong>
                  <p className="muted">{session.topic_ar ?? 'جلسة إرشاد'}</p>
                  <p className="muted" style={{ fontSize: '0.8rem' }}>
                    {new Date(session.scheduled_start).toLocaleString('ar')} ·{' '}
                    {Math.round(
                      (new Date(session.scheduled_end).getTime() -
                        new Date(session.scheduled_start).getTime()) / 60000,
                    )} دقيقة
                  </p>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span className={`pill pill-${session.status === 'confirmed' ? 'ok' : 'wait'}`}>
                    {session.status === 'confirmed' ? 'مؤكّدة' : 'بانتظار التأكيد'}
                  </span>
                  {session.meeting_url && session.status === 'confirmed' && (
                    <a className="btn btn-primary btn-sm" href={session.meeting_url}
                       target="_blank" rel="noreferrer noopener">
                      ادخل الجلسة
                    </a>
                  )}
                  <Link className="btn btn-ghost btn-sm" href={`/bookings/${session.id}`}>التفاصيل</Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {/* 5 — my team */}
      <section className="section-block">
        <h2 style={{ fontSize: '1.05rem', marginBottom: 10 }}>فريقي</h2>
        {team ? (
          <article className="panel team-row">
            <Avatar name={team.title_ar} url={team.avatar_url} size={48} />
            <div style={{ flex: 1 }}>
              <strong>{team.title_ar}</strong>
              <p className="muted" style={{ fontSize: '0.84rem' }}>
                يقوده {team.leaderName} · دورك: {membership?.[0]?.title_ar ?? (membership?.[0]?.role === 'leader' ? 'قائد' : 'عضو')}
              </p>
              <div className="tags-row" style={{ marginTop: 6 }}>
                <span className="tag">{team.openTasks} مهمة مفتوحة</span>
                {team.stars > 0 && <span className="tag"><Stars value={team.stars} /></span>}
              </div>
            </div>
            <Link className="btn btn-ghost btn-sm" href={`/teams/${team.id}`}>افتح الفريق</Link>
          </article>
        ) : (
          <div className="panel empty-state">
            <p className="muted">أغلب العمل الحقيقي يحدث ضمن فريق.</p>
            <Link className="btn btn-primary btn-sm" href="/teams">انضم إلى فريق أو أنشئ واحداً</Link>
          </div>
        )}
      </section>

      {/* 6 — opportunities that fit */}
      <section className="section-block">
        <div className="row-between" style={{ marginBottom: 10 }}>
          <h2 style={{ fontSize: '1.05rem' }}>فرص تناسبك</h2>
          <Link className="btn btn-ghost btn-sm" href="/marketplace">كل الفرص</Link>
        </div>
        {(suggestions ?? []).length === 0 ? (
          <p className="panel muted">لا فرص مفتوحة تطابق مجالاتك الآن.</p>
        ) : (
          <div className="card-grid">
            {(suggestions ?? []).map((item) => (
              <article className="card" key={item.id}>
                <div className="row-between">
                  <span className="tag">{KIND_LABEL[item.kind] ?? item.kind}</span>
                  {!item.is_eligible && <span className="pill pill-wait">لم تستوفِ الشروط بعد</span>}
                </div>
                <h3>{item.title_ar}</h3>
                {item.organization_ar && <p className="muted">{item.organization_ar}</p>}
                {item.required_skills?.length > 0 && (
                  <p className="muted" style={{ fontSize: '0.8rem' }}>
                    تطابق {item.matched_skills?.length ?? 0} من {item.required_skills.length} مهارة مطلوبة
                  </p>
                )}
                <Link className="btn btn-ghost btn-sm" href={`/marketplace/${item.id}`}>عرض الفرصة</Link>
              </article>
            ))}
          </div>
        )}
      </section>

      {/* 7 — achievements */}
      <section className="section-block">
        <div className="row-between" style={{ marginBottom: 10 }}>
          <h2 style={{ fontSize: '1.05rem' }}>إنجازاتي</h2>
          <Link className="btn btn-ghost btn-sm" href="/passport">الجواز المهني</Link>
        </div>
        <div className="stat-tiles">
          <Link className="stat-tile" href="/academy">
            <div className="val eng">{progress?.courses_completed ?? 0}</div>
            <div className="lbl">دورات مكتملة</div>
          </Link>
          <Link className="stat-tile" href="/academy">
            <div className="val eng">{progress?.assessments_passed ?? 0}</div>
            <div className="lbl">اختبارات مجتازة</div>
          </Link>
          <Link className="stat-tile" href="/certificates">
            <div className="val eng">{progress?.certificates ?? 0}</div>
            <div className="lbl">شهادات موثّقة</div>
          </Link>
          <Link className="stat-tile" href="/passport">
            <div className="val eng">{progress?.achievements ?? 0}</div>
            <div className="lbl">أوسمة</div>
          </Link>
        </div>

        {(achievements ?? []).length > 0 && (
          <div className="tags-row" style={{ marginTop: 12 }}>
            {(achievements ?? []).map((row) => {
              const badge = badgeById.get(row.achievement_id);
              return (
                <span className="tag" key={row.achievement_id}>
                  {badge?.icon} {badge?.name_ar}
                </span>
              );
            })}
          </div>
        )}
      </section>

      {/* 8 — progress */}
      <section className="section-block">
        <div className="row-between" style={{ marginBottom: 10 }}>
          <h2 style={{ fontSize: '1.05rem' }}>تقدّمي</h2>
          <Link className="btn btn-ghost btn-sm" href="/passport">التفاصيل الكاملة</Link>
        </div>
        <div className="panel progress-grid">
          <ProgressBar label="دروس أُكملت" value={progress?.lessons_completed ?? 0} />
          <ProgressBar label="أعمال معتمدة" value={progress?.work_approved ?? 0} />
          <ProgressBar label="اختبارات مجتازة" value={progress?.assessments_passed ?? 0} />
          <ProgressBar label="جلسات حضرتها" value={progress?.sessions_attended ?? 0} />
          <ProgressBar label="مهام فريق أنجزتها" value={progress?.team_tasks_done ?? 0} />
          <ProgressBar
            label="مهارات موثّقة"
            value={progress?.skills_verified ?? 0}
            outOf={progress?.skills_total ?? 0}
          />
        </div>
      </section>

      {/* 9 — reputation */}
      <section className="section-block">
        <div className="row-between" style={{ marginBottom: 10 }}>
          <h2 style={{ fontSize: '1.05rem' }}>سمعتي</h2>
          <Link className="btn btn-ghost btn-sm" href="/passport">عرض السمعة</Link>
        </div>
        <div className="panel">
          <div className="reputation-head">
            <div>
              <span className="muted">التقييم العام</span>
              <Stars value={stars?.stars_avg ?? 0} />
              <span className="muted" style={{ fontSize: '0.8rem' }}>
                من {stars?.rated_count ?? 0} عمل مُقيَّم
              </span>
            </div>
            <div>
              <span className="muted">نقاط TechMood</span>
              <div className="xp-badge eng">{xp?.total_xp ?? 0} XP</div>
            </div>
          </div>

          {(reputation ?? []).length === 0 ? (
            <p className="muted" style={{ marginTop: 12, fontSize: '0.84rem' }}>
              مقاييس السمعة تُحسب من مراجعات المنتورز وتقييمات الفرق. لم يُسجَّل
              لك تقييم بعد.
            </p>
          ) : (
            <div className="reputation-bars">
              {(reputation ?? []).map((row) => {
                return (
                  <div key={row.dimension}>
                    <div className="row-between">
                      <span className="muted">{dimensionName.get(row.dimension) ?? row.dimension}</span>
                      <span className="eng">{row.value}</span>
                    </div>
                    <div className="progress-track">
                      <div className="progress-fill" style={{ width: `${row.value}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <p className="muted" style={{ fontSize: '0.78rem', marginTop: 12 }}>
            النجوم جودة، والنقاط كمّية. لا يُجمعان في رقم واحد، ولا يُشترى أحدهما
            بالآخر.
          </p>
        </div>
      </section>

      {/* 10 — leaderboard */}
      <Leaderboard boards={boards} myRank={typeof myRank === 'number' ? myRank : null} windowKey={windowKey} />

      {/* 11 — find a mentor */}
      <section className="section-block">
        <div className="row-between" style={{ marginBottom: 10 }}>
          <h2 style={{ fontSize: '1.05rem' }}>منتورز قد يناسبونك</h2>
          <Link className="btn btn-ghost btn-sm" href="/mentors">تصفّح المنتورز</Link>
        </div>
        {(mentors ?? []).length === 0 ? (
          <p className="panel muted">لا منتورز متاحين في مجالاتك الآن.</p>
        ) : (
          <div className="card-grid">
            {(mentors ?? []).map((mentor) => (
              <article className="card mentor-card" key={mentor.profile_id}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <Avatar name={mentor.display_name ?? mentor.full_name} url={mentor.avatar_url} size={44} />
                  <div>
                    <h3 style={{ fontSize: '0.95rem' }}>{mentor.display_name ?? mentor.full_name}</h3>
                    <p className="muted" style={{ fontSize: '0.82rem' }}>{mentor.headline_ar}</p>
                  </div>
                </div>
                <div className="row-between">
                  <Stars value={mentor.rating_avg} />
                  <span className="tag eng">{mentor.level}</span>
                </div>
                <div className="row-between">
                  <span className="muted" style={{ fontSize: '0.8rem' }}>
                    {mentor.sessions_count} جلسة
                  </span>
                  <span className="xp-badge eng">${mentor.price_usd}</span>
                </div>
                <Link className="btn btn-ghost btn-sm" href={`/mentors/${mentor.profile_id}`}>
                  عرض الملف
                </Link>
              </article>
            ))}
          </div>
        )}
      </section>

      {/* 12 — explore */}
      <section className="section-block">
        <h2 style={{ fontSize: '0.95rem', marginBottom: 10 }}>استكشف TechMood</h2>
        <div className="explore-row">
          <Link className="explore-chip" href="/academy">الأكاديمية</Link>
          <Link className="explore-chip" href="/mentors">المنتورز</Link>
          <Link className="explore-chip" href="/teams">الفرق</Link>
          <Link className="explore-chip" href="/marketplace">سوق العمل</Link>
          <Link className="explore-chip" href="/startups">الشركات الناشئة</Link>
          <Link className="explore-chip" href="/exhibition">المعرض</Link>
        </div>
      </section>
    </>
  );
}

function ProgressBar({ label, value, outOf }: { label: string; value: number; outOf?: number }) {
  const percent = outOf && outOf > 0 ? Math.round((value / outOf) * 100) : null;
  return (
    <div>
      <div className="row-between">
        <span className="muted">{label}</span>
        <span className="eng">{outOf !== undefined ? `${value} / ${outOf}` : value}</span>
      </div>
      {percent !== null && (
        <div className="progress-track">
          <div className="progress-fill" style={{ width: `${percent}%` }} />
        </div>
      )}
    </div>
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
