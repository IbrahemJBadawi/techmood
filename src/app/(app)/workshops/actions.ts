'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';
import { getT } from '@/lib/i18n.server';
import { dbError } from '@/lib/db-errors';
import { localToUtc } from '@/lib/zoned';

export type WorkshopState = { error?: string } | undefined;

/** Announce a workshop, or change one (0150). The time is read in Palestine's clock. */
export async function saveWorkshop(_prev: WorkshopState, formData: FormData): Promise<WorkshopState> {
  const t = await getT();
  const value = (key: string) => String(formData.get(key) ?? '').trim();
  const starts = localToUtc(value('date'), value('time'));
  if (!starts) return { error: t('اختر اليوم والساعة.', 'Choose the day and the time.') };
  const capacity = Number(value('capacity')) || null;

  const supabase = await createClient();
  const { data: id, error } = await supabase.rpc('save_workshop', {
    p_id: value('id') || null,
    p_title: value('title'),
    p_description: value('description'),
    p_starts_at: starts.toISOString(),
    p_duration: Number(value('duration')) || 60,
    p_capacity: capacity,
    p_live_url: value('live_url') || null,
    p_recording_url: value('recording_url') || null,
  });
  if (error) return { error: dbError(t, error.message) };
  revalidatePath('/workshops');
  redirect(`/workshops/${id}`);
}

/** Take a seat, or give it back. */
export async function toggleRegistration(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get('id') ?? '');
  await supabase.rpc('register_workshop', { p_id: id, p_register: formData.get('register') === '1' });
  revalidatePath('/workshops');
  revalidatePath(`/workshops/${id}`);
}

export async function cancelWorkshop(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get('id') ?? '');
  await supabase.rpc('cancel_workshop', { p_id: id });
  revalidatePath('/workshops');
  revalidatePath(`/workshops/${id}`);
}
