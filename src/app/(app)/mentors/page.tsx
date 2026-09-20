import Link from 'next/link';

import { Stars } from '@/components/Stars';
import { createClient } from '@/lib/supabase/server';
import { money } from '@/lib/booking';

export default async function MentorsPage() {
  const supabase = await createClient();

  const [{ data: mentors }, { data: levels }] = await Promise.all([
    supabase
      .from('mentor_profiles')
      .select('profile_id, level, headline_ar, bio_ar, domains, session_minutes, is_accepting, sessions_count, rating_avg')
      .order('rating_avg', { ascending: false, nullsFirst: false }),
    supabase.from('mentor_levels').select('level, session_price_usd'),
  ]);

  const priceByLevel = new Map((levels ?? []).map((row) => [row.level, row.session_price_usd]));
  const mentorIds = (mentors ?? []).map((row) => row.profile_id);

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name, techmood_id, headline')
    .in('id', mentorIds.length ? mentorIds : ['00000000-0000-0000-0000-000000000000']);

  const profileById = new Map((profiles ?? []).map((row) => [row.id, row]));

  return (
    <>
      <section className="section-block">
        <h2 style={{ fontSize: '1.2rem' }}>المنتورز</h2>
        <p className="muted" style={{ fontSize: '0.9rem', marginTop: 6 }}>
          إرشاد بشري بجلسات محجوزة. سعر الجلسة يحدده مستوى المنتور، والحجز يحتاج 72 ساعة مسبقاً
          لإتاحة وقت لمراجعة الدفع.
        </p>
      </section>

      {(mentors?.length ?? 0) === 0 ? (
        <p className="notice">لا يوجد منتورز معتمدون بعد.</p>
      ) : (
        <div className="card-grid">
          {mentors!.map((mentor) => {
            const profile = profileById.get(mentor.profile_id);
            const price = priceByLevel.get(mentor.level);

            return (
              <article className="card" key={mentor.profile_id}>
                <div className="row-between">
                  <h3>{profile?.full_name ?? '—'}</h3>
                  <span className="badge-pill eng">{mentor.level}</span>
                </div>

                {mentor.headline_ar && <p>{mentor.headline_ar}</p>}

                <div className="tags-row">
                  {(mentor.domains ?? []).map((domain) => (
                    <span className="tag eng" key={domain}>{domain}</span>
                  ))}
                </div>

                <div className="row-between" style={{ fontSize: '0.8rem', color: 'var(--ink-soft)' }}>
                  <span>
                    <Stars value={mentor.rating_avg ?? 0} /> · {mentor.sessions_count} جلسة
                  </span>
                  {price !== undefined && <span className="eng">{money(price)} / جلسة</span>}
                </div>

                {mentor.is_accepting ? (
                  <Link className="btn btn-primary btn-sm" href={`/mentors/${mentor.profile_id}`}>
                    عرض الملف والحجز
                  </Link>
                ) : (
                  <span className="status-pill status-muted">لا يستقبل حجوزات حالياً</span>
                )}
              </article>
            );
          })}
        </div>
      )}
    </>
  );
}
