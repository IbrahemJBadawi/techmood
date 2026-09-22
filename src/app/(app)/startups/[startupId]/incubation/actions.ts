'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';

import { createClient } from '@/lib/supabase/server';
import { dbError } from '@/lib/db-errors';
import { getT } from '@/lib/i18n.server';

export type StageState = { error?: string; ok?: string } | undefined;

/**
 * Climbing a rung. The database decides whether it may be climbed at all — this
 * only carries the answer back with the names of whatever is missing.
 */
export async function advanceStage(_prev: StageState, formData: FormData): Promise<StageState> {
  const t = await getT();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const startupId = String(formData.get('startup_id') ?? '');

  const { data, error } = await supabase.rpc('advance_startup_stage', {
    p_startup: startupId,
    p_note: String(formData.get('note') ?? '').trim() || null,
  });

  revalidatePath(`/startups/${startupId}/incubation`);
  revalidatePath(`/startups/${startupId}`);
  if (error) return { error: dbError(t, error.message) };

  return { ok: t(`انتقلتم إلى مرحلة: ${data}`, `You are at: ${data}`) };
}

/** The tick for a requirement the platform cannot see for itself. */
export async function tickRequirement(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const startupId = String(formData.get('startup_id') ?? '');
  const key = String(formData.get('requirement_key') ?? '');

  if (formData.get('state') === 'off') {
    await supabase.from('startup_requirement_ticks')
      .delete().eq('startup_id', startupId).eq('requirement_key', key);
  } else {
    await supabase.from('startup_requirement_ticks').upsert({
      startup_id: startupId,
      requirement_key: key,
      note_ar: String(formData.get('note') ?? '').trim() || null,
      ticked_by: user.id,
    });
  }

  revalidatePath(`/startups/${startupId}/incubation`);
}
