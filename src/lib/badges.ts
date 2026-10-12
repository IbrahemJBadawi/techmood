import type { createClient } from '@/lib/supabase/server';

export type BadgeSets = { verified: Set<string>; premium: Set<string> };

/**
 * Who, among these people, carries the verified ✓ and the Premium ✦. One call
 * for a whole list, so a table of names costs two small reads, not one each.
 */
export async function badgesFor(supabase: Awaited<ReturnType<typeof createClient>>, ids: (string | null | undefined)[]): Promise<BadgeSets> {
  const unique = [...new Set(ids.filter((id): id is string => !!id))];
  if (unique.length === 0) return { verified: new Set(), premium: new Set() };
  const [{ data: verified }, { data: premium }] = await Promise.all([
    supabase.from('verified_members').select('profile_id').in('profile_id', unique),
    supabase.from('premium_memberships').select('profile_id').in('profile_id', unique).gt('until', new Date().toISOString()),
  ]);
  return {
    verified: new Set((verified ?? []).map((row) => row.profile_id)),
    premium: new Set((premium ?? []).map((row) => row.profile_id)),
  };
}
