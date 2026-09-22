'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';

import { createClient } from '@/lib/supabase/server';
import { dbError } from '@/lib/db-errors';
import { getT } from '@/lib/i18n.server';

export type ListingState = { error?: string; ok?: string } | undefined;

/**
 * Being findable is a choice, made here and made once.
 *
 * The database decides whether it may be made at all: listing yourself for
 * paid work needs a freelancer role that passed review, because the platform
 * is saying something about you to somebody who will pay.
 */
export async function saveListing(_prev: ListingState, formData: FormData): Promise<ListingState> {
  const t = await getT();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const min = formData.get('rate_min') ? Number(formData.get('rate_min')) : null;
  const max = formData.get('rate_max') ? Number(formData.get('rate_max')) : null;

  if (min !== null && max !== null && max < min) {
    return { error: t('الحد الأعلى يجب أن يكون أكبر من الأدنى.', 'The upper rate has to be the larger one.') };
  }

  const { error } = await supabase.from('freelancer_profiles').upsert({
    profile_id: user.id,
    is_available: formData.get('available') === 'on',
    headline_ar: String(formData.get('headline') ?? '').trim() || null,
    summary_ar: String(formData.get('summary') ?? '').trim() || null,
    rate_kind: formData.get('rate_kind') === 'project' ? 'project' : 'hourly',
    rate_min_usd: min,
    rate_max_usd: max,
  });

  revalidatePath('/settings/freelancer');
  revalidatePath('/marketplace');
  if (error) return { error: dbError(t, error.message) };

  return { ok: t('حُفظ إدراجك في السوق.', 'Your market listing is saved.') };
}

/** One thing you do, and the price it starts from. */
export async function addService(_prev: ListingState, formData: FormData): Promise<ListingState> {
  const t = await getT();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const title = String(formData.get('title') ?? '').trim();
  if (title.length < 3) return { error: t('اكتب اسم الخدمة.', 'Give the service a name.') };

  const { error } = await supabase.from('freelancer_services').insert({
    profile_id: user.id,
    title_ar: title,
    detail_ar: String(formData.get('detail') ?? '').trim() || null,
    from_usd: formData.get('from_usd') ? Number(formData.get('from_usd')) : null,
  });

  revalidatePath('/settings/freelancer');
  if (error) return { error: dbError(t, error.message) };
  return { ok: t('أُضيفت الخدمة.', 'The service is added.') };
}

export async function removeService(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  await supabase.from('freelancer_services')
    .delete()
    .eq('id', String(formData.get('service_id') ?? ''))
    .eq('profile_id', user.id);

  revalidatePath('/settings/freelancer');
}
