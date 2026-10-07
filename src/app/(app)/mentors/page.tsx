import Link from 'next/link';

import { Stars } from '@/components/Stars';
import { createClient } from '@/lib/supabase/server';
import { getT, localizedTitle } from '@/lib/i18n.server';
import { money } from '@/lib/booking';
import { avatarColor, domainLabel, initialOf } from '@/lib/mentor-look';
import { MENTOR_LEVEL_LOOK, mentorLevelLabel } from '@/lib/mentor-levels';
import type { MentorLevel } from '@/lib/database.types';
import { ChoiceChips, FilterSheet, SheetSelect } from '@/components/FilterSheet';

export const generateMetadata = localizedTitle('المنتورز — TechMood', 'Mentors — TechMood');

type MentorFilters = { q?: string; level?: string; domain?: string; max?: string; open?: string; sort?: string };

const SORTS = {
  rating:    { ar: 'الأعلى تقييماً', en: 'Top rated' },
  sessions:  { ar: 'الأكثر جلسات', en: 'Most sessions' },
  price_low: { ar: 'السعر: الأقل', en: 'Price: low to high' },
} as const;

/**
 * Mentors, with filters: a name or topic, the level, the field, a top price,
 * only those taking bookings, and the order. A plain GET form, so a filtered
 * list is a link. There are few mentors, so the filtering happens here.
 */
export default async function MentorsPage({ searchParams }: { searchParams: Promise<MentorFilters> }) {
  const t = await getT();
  const supabase = await createClient();
  const filters = await searchParams;

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

  // A mentor's field, by name: their domains are field slugs; a mentor who
  // listed none is shown their primary field from their profile.
  const [{ data: fieldRows }, { data: primaryRows }] = await Promise.all([
    supabase.from('fields').select('id, slug, name_ar, name_en'),
    supabase.from('profile_fields').select('profile_id, field_id').eq('is_primary', true)
      .in('profile_id', mentorIds.length ? mentorIds : ['00000000-0000-0000-0000-000000000000']),
  ]);
  const fieldBySlug = new Map((fieldRows ?? []).map((row) => [row.slug, row]));
  const fieldById = new Map((fieldRows ?? []).map((row) => [row.id, row]));
  const fieldName = (slug: string) => {
    const row = fieldBySlug.get(slug);
    return row ? t(row.name_ar, row.name_en ?? row.name_ar) : domainLabel(slug);
  };
  const fieldsOf = (mentor: { profile_id: string; domains: string[] | null }) => {
    const named = (mentor.domains ?? []).map(fieldName);
    if (named.length) return named;
    const primary = (primaryRows ?? []).find((row) => row.profile_id === mentor.profile_id);
    const row = primary ? fieldById.get(primary.field_id) : undefined;
    return row ? [t(row.name_ar, row.name_en ?? row.name_ar)] : [];
  };

  const available = (mentors ?? []).filter((mentor) => mentor.is_accepting).length;

  const domains = [...new Set((mentors ?? []).flatMap((mentor) => mentor.domains ?? []))].sort();
  const query = filters.q?.trim().toLowerCase() ?? '';
  const level = filters.level && filters.level in MENTOR_LEVEL_LOOK ? (filters.level as MentorLevel) : null;
  const domain = filters.domain && domains.includes(filters.domain) ? filters.domain : null;
  const max = Number(filters.max) > 0 ? Number(filters.max) : null;
  const onlyOpen = filters.open === '1';
  const sort = (filters.sort && filters.sort in SORTS ? filters.sort : 'rating') as keyof typeof SORTS;
  const activeFilters = [level, domain, max, onlyOpen || null].filter(Boolean).length;

  const shown = (mentors ?? [])
    .filter((mentor) => {
      const profile = profileById.get(mentor.profile_id);
      const price = fromPrice.get(mentor.profile_id);
      if (level && mentor.level !== level) return false;
      if (domain && !(mentor.domains ?? []).includes(domain)) return false;
      if (onlyOpen && !mentor.is_accepting) return false;
      if (max !== null && (price === undefined || price > max)) return false;
      if (query) {
        const text = [profile?.full_name, profile?.techmood_id, mentor.headline_ar, profile?.headline, mentor.bio_ar,
          ...fieldsOf(mentor)].join(' ').toLowerCase();
        if (!text.includes(query)) return false;
      }
      return true;
    })
    .sort((a, b) => {
      if (sort === 'sessions') return (b.sessions_count ?? 0) - (a.sessions_count ?? 0);
      if (sort === 'price_low') return (fromPrice.get(a.profile_id) ?? Infinity) - (fromPrice.get(b.profile_id) ?? Infinity);
      return Number(b.rating_avg ?? 0) - Number(a.rating_avg ?? 0);
    });

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

      {(mentors?.length ?? 0) > 0 && (
        <form className="filter-form" action="/mentors" role="search">
          <div className="filter-bar">
            <input type="search" name="q" defaultValue={filters.q ?? ''} aria-label={t('بحث', 'Search')}
                   placeholder={t('ابحث باسم أو مجال…', 'Search a name or field…')} />
            <FilterSheet count={activeFilters} title={t('تصفية المنتورز', 'Filter mentors')} clearHref="/mentors">
              <ChoiceChips name="level" legend={t('المستوى', 'Level')} defaultValue={level ?? ''}
                           options={[{ value: '', label: t('الكل', 'All') },
                             ...(Object.keys(MENTOR_LEVEL_LOOK) as MentorLevel[]).map((key) => ({ value: key, label: mentorLevelLabel(key) }))]} />
              {domains.length > 0 && (
                <ChoiceChips name="domain" legend={t('المجال', 'Field')} defaultValue={domain ?? ''}
                             options={[{ value: '', label: t('الكل', 'All') },
                               ...domains.map((key) => ({ value: key, label: fieldName(key) }))]} />
              )}
              <ChoiceChips name="max" legend={t('أعلى سعر للجلسة', 'Top price a session')} defaultValue={max ? String(max) : ''}
                           options={[{ value: '', label: t('أي سعر', 'Any price') },
                             ...[10, 20, 40, 75, 150].map((value) => ({ value: String(value), label: t(`حتى ${money(value)}`, `Up to ${money(value)}`) }))]} />
              <label className="sc-check">
                <input type="checkbox" name="open" value="1" defaultChecked={onlyOpen} /> {t('متاح للحجز الآن فقط', 'Only those taking bookings')}
              </label>
            </FilterSheet>
          </div>
          <div className="result-bar">
            <span className="result-count">{t(`${shown.length} منتور`, `${shown.length} mentors`)}</span>
            <SheetSelect name="sort" variant="chip" autoSubmit label={t('الترتيب', 'Sort by')} defaultValue={sort}
                         options={Object.entries(SORTS).map(([key, label]) => ({ value: key, label: t(label) }))} />
          </div>
        </form>
      )}

      {(mentors?.length ?? 0) === 0 ? (
        <p className="notice">{t('لا يوجد منتورز معتمدون بعد.', 'No approved mentors yet.')}</p>
      ) : shown.length === 0 ? (
        <div className="panel empty-state">
          <h3 style={{ fontSize: '0.98rem' }}>{t('لا منتورز يطابقون هذا', 'No mentors match')}</h3>
          <p className="muted" style={{ fontSize: '0.88rem' }}>{t('جرّب تصفية أوسع أو كلمة بحث أخرى.', 'Try a wider filter or another word.')}</p>
          <Link className="btn btn-primary btn-sm" href="/mentors">{t('مسح التصفية', 'Clear the filters')}</Link>
        </div>
      ) : (
        <div className="mn-grid">
          {shown.map((mentor) => {
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

                <span className={`mn-field-box${fieldsOf(mentor).length ? '' : ' is-empty'}`}>
                  <small>{t('المجال', 'Field')}</small>
                  <strong>{fieldsOf(mentor).length ? fieldsOf(mentor).slice(0, 3).join(' · ') : t('لم يُحدَّد بعد', 'Not set yet')}</strong>
                </span>

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
