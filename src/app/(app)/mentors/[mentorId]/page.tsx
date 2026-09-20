import Link from 'next/link';
import { notFound } from 'next/navigation';

import { Stars } from '@/components/Stars';
import { createClient } from '@/lib/supabase/server';
import { money } from '@/lib/booking';

const DAY_NAMES = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

export default async function MentorProfilePage({
  params,
}: {
  params: Promise<{ mentorId: string }>;
}) {
  const { mentorId } = await params;
  const supabase = await createClient();

  const { data: mentor } = await supabase
    .from('mentor_profiles')
    .select('profile_id, level, headline_ar, bio_ar, domains, session_minutes, is_accepting, sessions_count, rating_avg')
    .eq('profile_id', mentorId)
    .maybeSingle();

  if (!mentor) notFound();

  const [{ data: profile }, { data: level }, { data: availability }, { data: offered }] = await Promise.all([
    supabase.from('profiles').select('full_name, techmood_id, bio, github_url, linkedin_url').eq('id', mentorId).single(),
    supabase.from('mentor_levels').select('session_price_usd, platform_share_usd, mentor_share_usd').eq('level', mentor.level).single(),
    supabase.from('mentor_availability').select('day_of_week, start_time, end_time').eq('mentor_id', mentorId).order('day_of_week'),
    supabase
      .from('mentor_session_types')
      .select('is_active, session_types(id, name_ar, description_ar, duration_minutes)')
      .eq('mentor_id', mentorId)
      .eq('is_active', true),
  ]);

  const sessionTypes = (offered ?? []).map(
    (row) => row.session_types as unknown as { id: string; name_ar: string; description_ar: string | null; duration_minutes: number },
  );

  return (
    <>
      <Link className="btn btn-ghost btn-sm" href="/mentors">→ رجوع للمنتورز</Link>

      <section className="panel section-block" style={{ marginTop: 16 }}>
        <div className="row-between" style={{ alignItems: 'flex-start' }}>
          <div>
            <h2 style={{ fontSize: '1.25rem' }}>{profile?.full_name}</h2>
            {mentor.headline_ar && (
              <p className="muted" style={{ fontSize: '0.9rem', marginTop: 6 }}>{mentor.headline_ar}</p>
            )}
          </div>
          <span className="badge-pill eng">{mentor.level}</span>
        </div>

        <div className="tags-row" style={{ marginTop: 12, alignItems: 'center' }}>
          <span className="id-chip">{profile?.techmood_id}</span>
          <Stars value={mentor.rating_avg ?? 0} />
          <span className="muted" style={{ fontSize: '0.8rem' }}>{mentor.sessions_count} جلسة مكتملة</span>
        </div>

        {mentor.bio_ar && <p style={{ fontSize: '0.9rem', marginTop: 14 }}>{mentor.bio_ar}</p>}

        <div className="tags-row" style={{ marginTop: 12 }}>
          {(mentor.domains ?? []).map((domain) => <span className="tag eng" key={domain}>{domain}</span>)}
        </div>

        <div className="row-between" style={{ marginTop: 18 }}>
          <span className="eng" style={{ fontWeight: 700, color: 'var(--royal-dark)', fontSize: '1.1rem' }}>
            {level ? money(level.session_price_usd) : '—'} / جلسة
          </span>
          {mentor.is_accepting && sessionTypes.length > 0 ? (
            <Link className="btn btn-primary" href={`/mentors/${mentorId}/book`}>احجز جلسة</Link>
          ) : (
            <span className="status-pill status-muted">لا يستقبل حجوزات حالياً</span>
          )}
        </div>
      </section>

      <div className="detail-grid">
        <section className="panel">
          <h3 style={{ fontSize: '0.98rem', marginBottom: 12 }}>أنواع الجلسات</h3>
          {sessionTypes.length === 0 ? (
            <p className="muted" style={{ fontSize: '0.86rem' }}>لم يحدد هذا المنتور أنواع جلساته بعد.</p>
          ) : (
            sessionTypes.map((type) => (
              <div className="row-between" key={type.id} style={{ padding: '10px 0', borderBottom: '1px solid var(--line)' }}>
                <div>
                  <strong style={{ fontSize: '0.9rem' }}>{type.name_ar}</strong>
                  {type.description_ar && (
                    <p className="muted" style={{ fontSize: '0.82rem', marginTop: 3 }}>{type.description_ar}</p>
                  )}
                </div>
                <span className="badge-pill eng">{type.duration_minutes} min</span>
              </div>
            ))
          )}
        </section>

        <aside className="panel">
          <h3 style={{ fontSize: '0.98rem', marginBottom: 12 }}>أوقات التوفر</h3>
          {(availability?.length ?? 0) === 0 ? (
            <p className="muted" style={{ fontSize: '0.86rem' }}>لم يُنشر جدول توفر بعد.</p>
          ) : (
            availability!.map((slot, index) => (
              <div className="row-between" key={`${slot.day_of_week}-${index}`} style={{ marginBottom: 8 }}>
                <span style={{ fontSize: '0.86rem' }}>{DAY_NAMES[slot.day_of_week]}</span>
                <span className="eng muted" style={{ fontSize: '0.82rem' }}>
                  {slot.start_time.slice(0, 5)}–{slot.end_time.slice(0, 5)}
                </span>
              </div>
            ))
          )}
          <p className="muted" style={{ fontSize: '0.76rem', marginTop: 10 }}>
            بحد أقصى 5 ساعات يومياً، والحجز قبل 72 ساعة على الأقل.
          </p>
        </aside>
      </div>
    </>
  );
}
