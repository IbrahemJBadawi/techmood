'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';

import { createClient } from '@/lib/supabase/server';
import { dbError } from '@/lib/db-errors';
import { getT } from '@/lib/i18n.server';

export type StrategyDoorState = { error?: string; ok?: string } | undefined;

/** A SWOT square, turned into something with a number and a date. */
export async function swotToGoal(_prev: StrategyDoorState, formData: FormData): Promise<StrategyDoorState> {
  const t = await getT();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { error } = await supabase.rpc('swot_to_goal', {
    p_item: String(formData.get('item_id') ?? ''),
    p_metric: String(formData.get('metric') ?? '').trim() || 'عدد',
    p_target: Number(formData.get('target') ?? 1),
    p_due: String(formData.get('due') ?? ''),
    p_title: null,
  });

  revalidatePath(String(formData.get('revalidate') ?? '/startups'));
  if (error) return { error: dbError(t, error.message) };
  return { ok: t('صار هدفاً — وله الآن موعد ورقم.', 'It is a goal now — with a date and a number.') };
}
