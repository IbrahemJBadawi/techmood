import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';
import { CALENDAR_ENTRY } from '@/lib/teams';

import { TeamNav } from '../TeamNav';

const WINDOW_BACK_DAYS = 14;
const WINDOW_FORWARD_DAYS = 60;

export default async function TeamCalendarPage({
  params,
}: {
  params: Promise<{ teamId: string }>;
}) {
  const { teamId } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: team } = await supabase.from('teams').select('id, title_ar').eq('id', teamId).maybeSingle();
  if (!team) notFound();

  const asDate = (value: Date) => value.toISOString().slice(0, 10);
  const today = new Date();
  const from = asDate(new Date(today.getTime() - WINDOW_BACK_DAYS * 86400000));
  const to = asDate(new Date(today.getTime() + WINDOW_FORWARD_DAYS * 86400000));
  const todayKey = asDate(today);

  const { data: entries } = await supabase.rpc('team_calendar', {
    p_team: teamId,
    p_from: from,
    p_to: to,
  });

  // The calendar is a list of dates, grouped by day — the shape people read.
  const byDay = new Map<string, typeof entries>();
  for (const entry of entries ?? []) {
    byDay.set(entry.on_date, [...(byDay.get(entry.on_date) ?? []), entry]);
  }

  const days = [...byDay.keys()].sort();
  const upcoming = days.filter((day) => day >= todayKey);
  const past = days.filter((day) => day < todayKey).reverse();

  function dayBlock(day: string) {
    const dayEntries = byDay.get(day) ?? [];
    const isToday = day === todayKey;
    const isLate = day < todayKey;

    return (
      <article className="panel" key={day} style={{ marginBottom: 12 }}>
        <div className="row-between">
          <strong style={{ fontSize: '0.92rem' }}>
            {new Date(`${day}T12:00:00`).toLocaleDateString('ar-EG', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
            })}
          </strong>
          {isToday && <span className="status-pill status-ok">اليوم</span>}
        </div>

        {dayEntries.map((entry) => {
          const info = CALENDAR_ENTRY[entry.entry_kind] ?? { label: entry.entry_kind, icon: '•' };
          return (
            <div
              className="row-between"
              key={`${entry.entry_kind}-${entry.entry_id}`}
              style={{ marginTop: 10, alignItems: 'flex-start' }}
            >
              <div>
                <span style={{ fontSize: '0.88rem' }}>
                  {info.icon} {entry.title_ar}
                </span>
                {entry.detail_ar && (
                  <p className="muted" style={{ fontSize: '0.78rem', marginTop: 3 }}>{entry.detail_ar}</p>
                )}
              </div>
              <span className={`status-pill ${isLate && entry.entry_kind === 'task' ? 'status-danger' : 'status-muted'}`}>
                {info.label}
              </span>
            </div>
          );
        })}
      </article>
    );
  }

  return (
    <>
      <section className="section-block">
        <div className="row-between">
          <h2 style={{ fontSize: '1.15rem' }}>{team.title_ar} — التقويم</h2>
          <Link className="btn btn-ghost btn-sm" href={`/teams/${teamId}`}>نظرة عامة</Link>
        </div>
        <p className="muted" style={{ fontSize: '0.88rem', marginTop: 6 }}>
          مواعيد المهام والسبرنتات ومعالم المشاريع وجلسات المنتور — مجموعة من حيث هي مسجّلة
          أصلاً، لا مُدخلة مرة ثانية.
        </p>
      </section>

      <TeamNav teamId={teamId} />

      <section className="section-block">
        <h3 style={{ fontSize: '1rem', marginBottom: 12 }}>القادم ({upcoming.length} يوم)</h3>
        {upcoming.length === 0 ? (
          <p className="notice">لا مواعيد قادمة خلال الشهرين القادمين.</p>
        ) : (
          upcoming.map(dayBlock)
        )}
      </section>

      {past.length > 0 && (
        <section className="section-block">
          <h3 style={{ fontSize: '1rem', marginBottom: 12 }}>مضى</h3>
          {past.map(dayBlock)}
        </section>
      )}
    </>
  );
}
