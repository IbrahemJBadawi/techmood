import Link from 'next/link';
import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';
import { getT } from '@/lib/i18n.server';

export const metadata = { title: 'Search — TechMood' };

/**
 * One search across the platform.
 *
 * Every list below is filtered by RLS before it reaches this page, so the
 * results are what this person may see — a private team, an unapproved mentor
 * or a hidden profile simply never arrives.
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
      <section className="panel section-block">
        <h1 style={{ fontSize: '1.1rem', marginBottom: 6 }}>{t('بحث', 'Search')}</h1>
        <p className="muted">{t('اكتب حرفين على الأقل.', 'Type at least two characters.')}</p>
      </section>
    );
  }

  const like = `%${term}%`;

  const [paths, courses, mentors, teams, opportunities, people] = await Promise.all([
    supabase.from('learning_paths').select('id, slug, title_ar, description_ar')
      .eq('status', 'published').ilike('title_ar', like).limit(6),
    supabase.from('courses').select('id, slug, title_ar, description_ar')
      .eq('status', 'published').ilike('title_ar', like).limit(6),
    supabase.from('mentor_profiles').select('profile_id, headline_ar, level, rating_avg')
      .not('approved_at', 'is', null).ilike('headline_ar', like).limit(6),
    supabase.from('teams').select('id, title_ar, focus_ar, public_summary_ar')
      .eq('visibility', 'listed').ilike('title_ar', like).limit(6),
    supabase.from('opportunities').select('id, title_ar, organization_ar, kind')
      .eq('status', 'published').ilike('title_ar', like).limit(6),
    supabase.from('profiles').select('id, techmood_id, full_name, display_name, username, headline')
      .eq('is_public', true).or(`full_name.ilike.${like},display_name.ilike.${like},username.ilike.${like}`)
      .limit(6),
  ]);

  const mentorIds = (mentors.data ?? []).map((row) => row.profile_id);
  const { data: mentorProfiles } = mentorIds.length
    ? await supabase.from('profiles').select('id, full_name, display_name').in('id', mentorIds)
    : { data: [] };
  const mentorName = new Map((mentorProfiles ?? []).map((row) => [row.id, row.display_name ?? row.full_name]));

  const groups = [
    {
      title: t('المسارات', 'Paths'),
      rows: (paths.data ?? []).map((row) => ({
        key: row.id, href: `/academy/${row.slug}`, title: row.title_ar, detail: row.description_ar,
      })),
    },
    {
      title: t('الدورات', 'Courses'),
      rows: (courses.data ?? []).map((row) => ({
        key: row.id, href: '/academy', title: row.title_ar, detail: row.description_ar,
      })),
    },
    {
      title: t('المنتورز', 'Mentors'),
      rows: (mentors.data ?? []).map((row) => ({
        key: row.profile_id,
        href: `/mentors/${row.profile_id}`,
        title: mentorName.get(row.profile_id) ?? t('منتور', 'Mentor'),
        detail: row.headline_ar,
      })),
    },
    {
      title: t('الفرق', 'Teams'),
      rows: (teams.data ?? []).map((row) => ({
        key: row.id, href: `/teams/${row.id}`, title: row.title_ar,
        detail: row.focus_ar ?? row.public_summary_ar,
      })),
    },
    {
      title: t('الفرص', 'Openings'),
      rows: (opportunities.data ?? []).map((row) => ({
        key: row.id, href: `/marketplace/${row.id}`, title: row.title_ar, detail: row.organization_ar,
      })),
    },
    {
      title: t('أشخاص', 'People'),
      rows: (people.data ?? []).map((row) => ({
        key: row.id, href: '/passport', title: row.display_name ?? row.full_name,
        detail: row.headline ?? row.techmood_id,
      })),
    },
  ].filter((group) => group.rows.length > 0);

  const total = groups.reduce((sum, group) => sum + group.rows.length, 0);

  return (
    <>
      <section className="section-block">
        <h1 style={{ fontSize: '1.15rem', marginBottom: 4 }}>
          {t('نتائج البحث عن «', 'Results for “')}{term}{t('»', '”')}
        </h1>
        <p className="muted" style={{ fontSize: '0.86rem' }}>
          {total === 0 ? t('لا نتيجة.', 'No results.') : t(`${total} نتيجة`, `${total} results`)}
        </p>
      </section>

      {groups.map((group) => (
        <section className="section-block" key={group.title}>
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
