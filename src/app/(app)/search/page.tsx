import Link from 'next/link';
import { redirect } from 'next/navigation';

import { MemberAvatar } from '@/components/MemberAvatar';
import { createClient } from '@/lib/supabase/server';
import { getT, localizedTitle } from '@/lib/i18n.server';
import { searchGroups } from '@/lib/search';
import { SearchBox } from '@/components/SearchBox';

/** People to follow, shown before anyone types — so «ابحث عن زملاء» is never an empty page. */
async function SuggestedPeople() {
  const t = await getT();
  const supabase = await createClient();
  const { data } = await supabase.rpc('suggested_people', { p_limit: 12 });
  const people = data ?? [];
  if (people.length === 0) return null;

  return (
    <section className="section-block">
      <h2 style={{ fontSize: '1rem', marginBottom: 4 }}>{t('زملاء قد تعرفهم', 'Classmates you may know')}</h2>
      <p className="muted" style={{ fontSize: '0.82rem', marginBottom: 10 }}>
        {t('تابعهم لترى تقدّمهم وتتسابقوا على نقاط الأسبوع.', 'Follow them to see their progress and race for the week’s XP.')}
      </p>
      <div className="suggest-grid">
        {people.map((person) => (
          <Link className="panel suggest-card" href={`/m/${person.techmood_id}`} key={person.techmood_id}>
            <MemberAvatar id={person.techmood_id} name={person.name} url={person.avatar_url} size={44} />
            <strong className="suggest-name">{person.name}</strong>
            {person.headline && <span className="muted suggest-head">{person.headline}</span>}
            <span className="muted suggest-meta eng">
              {person.followers > 0 && `${person.followers} ${t('متابِع', 'followers')}`}
              {person.xp > 0 && `${person.followers > 0 ? ' · ' : ''}${person.xp} XP`}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

export const generateMetadata = localizedTitle('البحث — TechMood', 'Search — TechMood');

/**
 * One search across the platform (src/lib/search.ts), with a search box at
 * the top that suggests as you type — on a phone this is the only box, since
 * the one in the top bar is for wide screens.
 */
export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const t = await getT();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const term = (await searchParams).q?.trim() ?? '';
  if (term.length < 2) {
    return (
      <>
        <section className="section-block">
          <h1 style={{ fontSize: '1.1rem', marginBottom: 10 }}>{t('بحث', 'Search')}</h1>
          <SearchBox autoFocus />
          <p className="muted">{t('اكتب حرفين على الأقل للبحث في المسارات والدورات والمنتورز والأشخاص.',
                                  'Type at least two characters to search paths, courses, mentors and people.')}</p>
        </section>
        <SuggestedPeople />
      </>
    );
  }

  const groups = await searchGroups(supabase, t, term);

  const total = groups.reduce((sum, group) => sum + group.rows.length, 0);

  return (
    <>
      <section className="section-block">
        <SearchBox initial={term} />
        <h1 style={{ fontSize: '1.15rem', margin: '14px 0 4px' }}>
          {t('نتائج البحث عن «', 'Results for “')}{term}{t('»', '”')}
        </h1>
        <p className="muted" style={{ fontSize: '0.86rem' }}>
          {total === 0 ? t('لا نتيجة.', 'No results.') : t(`${total} نتيجة`, `${total} results`)}
        </p>
      </section>

      {groups.map((group) => (
        <section className="section-block" key={group.kind}>
          <h2 style={{ fontSize: '1rem', marginBottom: 10 }}>{group.title}</h2>
          <div className="stack">
            {group.rows.map((row) => (
              <Link className="panel search-result" href={row.href} key={row.key}>
                <strong>{row.title}</strong>
                {row.detail && <span className="muted">{row.detail}</span>}
              </Link>
            ))}
          </div>
        </section>
      ))}

      {total === 0 && (
        <p className="panel muted">
          {t('لم نجد شيئاً. جرّب كلمة أقصر، أو تصفّح ', 'Nothing found. Try a shorter word, or browse ')}
          <Link href="/academy">{t('الأكاديمية', 'the academy')}</Link>.
        </p>
      )}

      <p className="muted" style={{ fontSize: '0.78rem' }}>
        {t('البحث يعرض ما يحق لك رؤيته فقط: الفرق المغلقة والملفات غير العامة لا تظهر هنا مهما كانت الكلمة.',
           'Search shows only what you are allowed to see: closed teams and private profiles never appear here, whatever you type.')}
      </p>
    </>
  );
}
