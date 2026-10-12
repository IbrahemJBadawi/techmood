'use server';

import { revalidatePath } from 'next/cache';

import { createClient } from '@/lib/supabase/server';
import { getT } from '@/lib/i18n.server';
import { dbError } from '@/lib/db-errors';

/** What the giver holds and may still give today (0161). */
export async function giftAllowance() {
  const supabase = await createClient();
  const { data } = await supabase.rpc('my_gift_allowance');
  const row = data?.[0];
  return { balance: row?.balance ?? 0, left: row?.left_today ?? 0 };
}

/** Gives XP from the giver's own points; the database checks every limit. */
export async function giftXp(to: string, amount: number, note: string, path: string) {
  const t = await getT();
  const supabase = await createClient();
  const { error } = await supabase.rpc('gift_xp', { p_to: to, p_amount: amount, p_note: note.trim() || null });
  if (error) return { ok: false, error: dbError(t, error.message) };
  revalidatePath(path);
  return { ok: true };
}
