import Link from 'next/link';

import { Stars } from '@/components/Stars';
import { createClient } from '@/lib/supabase/server';
import { getT } from '@/lib/i18n.server';
import { money } from '@/lib/booking';

export default async function MentorsPage() {
  const t = await getT();
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
        <h2 style={{ fontSize: '1.2rem' }}>{t('المنتورز', 'Mentors')}</h2>
        <p className="muted" style={{ fontSize: '0.9rem', marginTop: 6 }}>
          {t('إرشاد بشري بجلسات محجوزة. سعر الجلسة يحدده مستوى المنتور، والحجز يحتاج 72 ساعة مسبقاً لإتاحة وقت لمراجعة الدفع.',
             'Human mentoring in booked sessions. The price comes from the mentor\u2019s level, and a booking needs 72 hours\u2019 notice so there is time to check the payment.')}
        </p>
      </section>

      {(mentors?.length ?? 0) === 0 ? (
        <p className="notice">{t('لا يوجد منتورز معتمدون بعد.', 'No approved mentors yet.')}</p>
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
                    <Stars value={mentor.rating_avg ?? 0} /> ·{' '}
                    {t(`${mentor.sessions_count} جلسة`, `${mentor.sessions_count} ${mentor.sessions_count === 1 ? 'session' : 'sessions'}`)}
                  </span>
                  {price !== undefined && <span className="eng">{money(price)}{t(' / جلسة', ' / session')}</span>}
                </div>

                {mentor.is_accepting ? (
                  <Link className="btn btn-primary btn-sm" href={`/mentors/${mentor.profile_id}`}>
                    {t('عرض الملف والحجز', 'View profile and book')}
                  </Link>
                ) : (
                  <span className="status-pill status-muted">{t('لا يستقبل حجوزات حالياً', 'Not taking bookings right now')}</span>
                )}
              </article>
            );
          })}
        </div>
      )}
    </>
  );
}
