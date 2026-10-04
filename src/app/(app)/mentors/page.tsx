import Link from 'next/link';

import { Stars } from '@/components/Stars';
import { createClient } from '@/lib/supabase/server';
import { getT, localizedTitle } from '@/lib/i18n.server';
import { money } from '@/lib/booking';
import { avatarColor, domainLabel, initialOf } from '@/lib/mentor-look';
import { mentorLevelLabel } from '@/lib/mentor-levels';

export const generateMetadata = localizedTitle('المنتورز — TechMood', 'Mentors — TechMood');

export default async function MentorsPage() {
  const t = await getT();
  const supabase = await createClient();

  const { data: mentors } = await supabase
    .from('mentor_profiles')
    .select('profile_id, level, headline_ar, bio_ar, domains, session_minutes, is_accepting, sessions_count, rating_avg')
    .order('rating_avg', { ascending: false, nullsFirst: false });

  const mentorIds = (mentors ?? []).map((row) => row.profile_id);

  // Each mentor's cheapest offered session, from their own prices (0077).
  const priceLists = await Promise.all(
    mentorIds.map((id) => supabase.rpc('mentor_price_list', { p_mentor: id })),
  );
  const fromPrice = new Map(mentorIds.map((id, index) => {
    const offered = (priceLists[index].data ?? []).filter((row) => row.is_active).map((row) => Number(row.price_usd));
    return [id, offered.length ? Math.min(...offered) : undefined] as const;
  }));

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name, techmood_id, headline, avatar_url')
    .in('id', mentorIds.length ? mentorIds : ['00000000-0000-0000-0000-000000000000']);

  const profileById = new Map((profiles ?? []).map((row) => [row.id, row]));

  const available = (mentors ?? []).filter((mentor) => mentor.is_accepting).length;

  return (
    <>
      <section className="section-block mn-head">
        <div>
          <h2>{t('المنتورز', 'Mentors')}</h2>
          <p className="muted">
            {t('خبراء يراجعون عملك في جلسة واحد لواحد. كل منتور يسعّر جلساته ضمن حدود مستواه.',
               'Experts who review your work one to one. Each mentor prices their sessions within their level’s range.')}
          </p>
        </div>
        <span className="mn-count">
          <span className="mn-dot" />{t(`${available} متاح للحجز الآن`, `${available} taking bookings now`)}
        </span>
      </section>

      {(mentors?.length ?? 0) === 0 ? (
        <p className="notice">{t('لا يوجد منتورز معتمدون بعد.', 'No approved mentors yet.')}</p>
      ) : (
        <div className="mn-grid">
          {mentors!.map((mentor) => {
            const profile = profileById.get(mentor.profile_id);
            const price = fromPrice.get(mentor.profile_id);
            const name = profile?.full_name ?? '—';

            return (
              <Link className={`mn-card${mentor.is_accepting ? '' : ' is-paused'}`} key={mentor.profile_id}
                    href={`/mentors/${mentor.profile_id}`}>
                <span className="mn-card-top">
                  <span className="mn-avatar" style={{ background: avatarColor(mentor.profile_id) }}>
                    {profile?.avatar_url
                      // eslint-disable-next-line @next/next/no-img-element
                      ? <img src={profile.avatar_url} alt="" />
                      : initialOf(name)}
                    {mentor.is_accepting && <span className="mn-online" aria-hidden="true" />}
                  </span>
                  <span className="mn-card-id">
                    <strong>{name}</strong>
                    <span className="mn-headline">{mentor.headline_ar ?? profile?.headline ?? t('منتور', 'Mentor')}</span>
                    <span className="mn-level eng">{mentorLevelLabel(mentor.level)}</span>
                  </span>
                </span>

                <span className="mn-rating">
                  <Stars value={mentor.rating_avg ?? 0} />
                  <span className="eng">{mentor.rating_avg ? Number(mentor.rating_avg).toFixed(1) : '—'}</span>
                  <span className="muted">· {t(`${mentor.sessions_count} جلسة`, `${mentor.sessions_count} ${mentor.sessions_count === 1 ? 'session' : 'sessions'}`)}</span>
                </span>

                {(mentor.domains ?? []).length > 0 && (
                  <span className="mn-domains">
                    {(mentor.domains ?? []).slice(0, 3).map((domain) => (
                      <span className="mn-domain" key={domain}>{domainLabel(domain)}</span>
                    ))}
                  </span>
                )}

                <span className="mn-card-foot">
                  <span className="mn-price">
                    {price !== undefined
                      ? <>{t('من ', 'From ')}<strong className="eng">{money(price)}</strong>{t(' / جلسة', ' / session')}</>
                      : <span className="muted">{t('لم يُسعّر بعد', 'Not priced yet')}</span>}
                  </span>
                  <span className={`mn-cta${mentor.is_accepting ? '' : ' is-off'}`}>
                    {mentor.is_accepting ? t('احجز', 'Book') : t('غير متاح', 'Unavailable')}
                  </span>
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
