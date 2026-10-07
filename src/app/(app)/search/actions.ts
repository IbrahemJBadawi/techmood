'use server';

import { createClient } from '@/lib/supabase/server';
import { getT } from '@/lib/i18n.server';
import { searchGroups, type SearchGroup } from '@/lib/search';

/** Suggestions while typing: a few of each kind, read as the signed-in member. */
export async function suggestAction(term: string): Promise<SearchGroup[]> {
  if (typeof term !== 'string' || term.trim().length < 2 || term.length > 80) return [];
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const groups = await searchGroups(supabase, await getT(), term, 3);
  return groups.map((group) => ({ ...group, rows: group.rows.slice(0, 3) }));
}
