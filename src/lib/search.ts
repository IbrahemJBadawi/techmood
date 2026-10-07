import type { createClient } from '@/lib/supabase/server';
import type { T } from '@/lib/i18n';
import { IS_MVP } from '@/lib/scope';

type Supabase = Awaited<ReturnType<typeof createClient>>;

export type SearchRow = { key: string; href: string; title: string; detail: string | null };
export type SearchGroup = { kind: string; title: string; rows: SearchRow[] };

/**
 * One search across the platform, shared by the /search page and the
 * suggestions under the search box.
 *
 * Every list is filtered by RLS before it arrives, so the results are what
 * this person may see — a private team, an unapproved mentor or a hidden
 * profile simply never comes back.
 */
export async function searchGroups(supabase: Supabase, t: T, raw: string, limit = 6): Promise<SearchGroup[]> {
  // Characters with a meaning inside a PostgREST filter are dropped rather than
  // escaped: nobody searches for a comma, and a stray one must not break the query.
  const term = raw.replace(/[%_,()*\\]/g, ' ').replace(/\s+/g, ' ').trim();
  if (term.length < 2) return [];
  const like = `%${term}%`;

  const [paths, courses, mentors, teams, opportunities, people] = await Promise.all([
    supabase.from('learning_paths').select('id, slug, title_ar, description_ar')
      .eq('status', 'published').ilike('title_ar', like).limit(limit),
    supabase.from('courses').select('id, slug, title_ar, description_ar')
      .eq('status', 'published').ilike('title_ar', like).limit(limit),
    supabase.from('mentor_profiles').select('profile_id, headline_ar, level, rating_avg')
      .not('approved_at', 'is', null).ilike('headline_ar', like).limit(limit),
    supabase.from('teams').select('id, title_ar, focus_ar, public_summary_ar')
      .eq('visibility', 'listed').ilike('title_ar', like).limit(limit),
    supabase.from('opportunities').select('id, title_ar, organization_ar, kind')
      .eq('status', 'published').ilike('title_ar', like).limit(limit),
    supabase.from('profiles').select('id, techmood_id, full_name, display_name, username, headline')
      .eq('is_public', true).or(`full_name.ilike.${like},display_name.ilike.${like},username.ilike.${like}`)
      .limit(limit),
  ]);

  const mentorIds = (mentors.data ?? []).map((row) => row.profile_id);
  const { data: mentorProfiles } = mentorIds.length
    ? await supabase.from('profiles').select('id, full_name, display_name').in('id', mentorIds)
    : { data: [] };
  const mentorName = new Map((mentorProfiles ?? []).map((row) => [row.id, row.display_name ?? row.full_name]));

  return [
    {
      kind: 'path',
      title: t('المسارات', 'Paths'),
      rows: (paths.data ?? []).map((row) => ({
        key: row.id, href: `/academy/${row.slug}`, title: row.title_ar, detail: row.description_ar,
      })),
    },
    {
      kind: 'course',
      title: t('الدورات', 'Courses'),
      rows: (courses.data ?? []).map((row) => ({
        key: row.id, href: '/academy', title: row.title_ar, detail: row.description_ar,
      })),
    },
    {
      kind: 'mentor',
      title: t('المنتورز', 'Mentors'),
      rows: (mentors.data ?? []).map((row) => ({
        key: row.profile_id,
        href: `/mentors/${row.profile_id}`,
        title: mentorName.get(row.profile_id) ?? t('منتور', 'Mentor'),
        detail: row.headline_ar,
      })),
    },
    {
      kind: 'team',
      title: t('الفرق', 'Teams'),
      rows: (teams.data ?? []).map((row) => ({
        key: row.id, href: `/teams/${row.id}`, title: row.title_ar,
        detail: row.focus_ar ?? row.public_summary_ar,
      })),
    },
    {
      kind: 'opening',
      title: t('الفرص', 'Openings'),
      // Openings are outside the MVP (src/lib/scope.ts).
      rows: (IS_MVP ? [] : opportunities.data ?? []).map((row) => ({
        key: row.id, href: `/marketplace/${row.id}`, title: row.title_ar, detail: row.organization_ar,
      })),
    },
    {
      kind: 'person',
      title: t('أشخاص', 'People'),
      rows: (people.data ?? []).map((row) => ({
        key: row.id, href: `/m/${row.techmood_id}`, title: row.display_name ?? row.full_name,
        detail: row.headline ?? row.techmood_id,
      })),
    },
  ].filter((group) => group.rows.length > 0);
}
