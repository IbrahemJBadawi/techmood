'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';

import { createClient } from '@/lib/supabase/server';
import { dbError } from '@/lib/db-errors';
import { getT } from '@/lib/i18n.server';
import type { RoadmapStatus } from '@/lib/database.types';

export type RoadmapState = { error?: string; ok?: string } | undefined;

/** Something the company intends, in the quarter it intends it. */
export async function addRoadmapItem(_prev: RoadmapState, formData: FormData): Promise<RoadmapState> {
  const t = await getT();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const startupId = String(formData.get('startup_id') ?? '');
  const title = String(formData.get('title') ?? '').trim();
  if (title.length < 2) return { error: t('اكتب عنوان البند.', 'Give the item a title.') };

  const { error } = await supabase.from('roadmap_items').insert({
    startup_id: startupId,
    title_ar: title,
    detail_ar: String(formData.get('detail') ?? '').trim() || null,
    year: Number(formData.get('year') ?? new Date().getFullYear()),
    quarter: Number(formData.get('quarter') ?? 1),
    created_by: user.id,
  });

  revalidatePath(`/startups/${startupId}/roadmap`);
  if (error) return { error: dbError(t, error.message) };
  return { ok: t('أُضيف إلى خارطة الطريق.', 'It is on the roadmap.') };
}

export async function setRoadmapStatus(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const startupId = String(formData.get('startup_id') ?? '');

  await supabase
    .from('roadmap_items')
    .update({ status: String(formData.get('status') ?? 'planned') as RoadmapStatus })
    .eq('id', String(formData.get('item_id') ?? ''));

  revalidatePath(`/startups/${startupId}/roadmap`);
}

/** The moment work starts, the intention becomes a project. */
export async function startRoadmapItem(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const startupId = String(formData.get('startup_id') ?? '');
  await supabase.rpc('roadmap_item_to_project', { p_item: String(formData.get('item_id') ?? '') });

  revalidatePath(`/startups/${startupId}/roadmap`);
  revalidatePath(`/startups/${startupId}/projects`);
}

export async function removeRoadmapItem(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const startupId = String(formData.get('startup_id') ?? '');
  await supabase.from('roadmap_items').delete().eq('id', String(formData.get('item_id') ?? ''));

  revalidatePath(`/startups/${startupId}/roadmap`);
}
