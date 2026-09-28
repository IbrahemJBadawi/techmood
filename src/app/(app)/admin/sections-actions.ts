'use server';

import { revalidatePath } from 'next/cache';

import type { ActionFormState } from '@/components/ActionForm';
import { createClient } from '@/lib/supabase/server';
import { dbError } from '@/lib/db-errors';
import { getT } from '@/lib/i18n.server';
import type { ContentStatus, TicketCategory } from '@/lib/database.types';

/**
 * Knowledge base and admin permissions. Each write is refused by the database
 * for anybody who is not an admin (0087); this file grants nothing.
 */
const text = (formData: FormData, key: string) => String(formData.get(key) ?? '').trim();

export async function saveArticle(_prev: ActionFormState, formData: FormData): Promise<ActionFormState> {
  const t = await getT();
  const supabase = await createClient();
  const id = text(formData, 'id');
  const row = {
    slug: text(formData, 'slug').toLowerCase(),
    category: (text(formData, 'category') || null) as TicketCategory | null,
    title_ar: text(formData, 'title_ar'),
    title_en: text(formData, 'title_en') || null,
    body_ar: text(formData, 'body_ar'),
    status: (text(formData, 'status') || 'draft') as ContentStatus,
    sort_order: Number(text(formData, 'sort_order') || 0),
  };
  const { error } = id
    ? await supabase.from('kb_articles').update(row).eq('id', id)
    : await supabase.from('kb_articles').insert(row);
  revalidatePath('/admin/knowledge');
  revalidatePath('/support');
  if (error) return { error: dbError(t, error.message) };
  return { ok: t('حُفظ المقال.', 'Article saved.') };
}

export async function deleteArticle(_prev: ActionFormState, formData: FormData): Promise<ActionFormState> {
  const t = await getT();
  const supabase = await createClient();
  const { error } = await supabase.from('kb_articles').delete().eq('id', text(formData, 'id'));
  revalidatePath('/admin/knowledge');
  revalidatePath('/support');
  if (error) return { error: dbError(t, error.message) };
  return { ok: t('حُذف المقال.', 'Article deleted.') };
}

export async function setAdmin(_prev: ActionFormState, formData: FormData): Promise<ActionFormState> {
  const t = await getT();
  const supabase = await createClient();
  let profile = text(formData, 'profile_id');

  // Granting can name the person by their TechMood ID.
  if (!profile && text(formData, 'techmood_id')) {
    const { data } = await supabase.from('profiles').select('id').eq('techmood_id', text(formData, 'techmood_id').toUpperCase()).maybeSingle();
    if (!data) return { error: t('لا يوجد حساب بهذا المعرّف.', 'No account has that TechMood ID.') };
    profile = data.id;
  }

  const { error } = await supabase.rpc('set_admin_role', {
    p_profile: profile,
    p_grant: text(formData, 'grant') === 'yes',
    p_reason: text(formData, 'reason'),
  });
  revalidatePath('/admin/permissions');
  if (error) return { error: dbError(t, error.message) };
  return { ok: t('تم، وسُجّل في سجل التدقيق.', 'Done, and written to the audit log.') };
}

/** A market listing: verified onto the shelf, or refused with a reason (0099). */
export async function reviewListing(_prev: ActionFormState, formData: FormData): Promise<ActionFormState> {
  const t = await getT();
  const supabase = await createClient();
  const approve = text(formData, 'decision') === 'approve';
  const { error } = await supabase.rpc('review_listing', {
    p_listing: text(formData, 'listing_id'),
    p_approve: approve,
    p_note: text(formData, 'note') || null,
  });
  revalidatePath('/admin/market');
  revalidatePath('/marketplace');
  if (error) return { error: dbError(t, error.message) };
  return { ok: approve ? t('تحقّقت منه — ظاهر في السوق.', 'Verified — it is on the market.') : t('رُفض، وسُجّل تنبيه على البائع.', 'Refused, and a warning is on the seller’s record.') };
}

/** A mentor's level upgrade: approved (the level moves) or declined with a reason (0101). */
export async function reviewLevelUpgrade(_prev: ActionFormState, formData: FormData): Promise<ActionFormState> {
  const t = await getT();
  const supabase = await createClient();
  const approve = text(formData, 'decision') === 'approve';
  const { error } = await supabase.rpc('review_level_upgrade', {
    p_request: text(formData, 'request_id'),
    p_approve: approve,
    p_note: text(formData, 'note') || null,
  });
  revalidatePath('/admin/levels');
  if (error) return { error: dbError(t, error.message) };
  return { ok: approve ? t('رُقّي المنتور.', 'The mentor moved up.') : t('وصل المنتور السبب.', 'The mentor has the reason.') };
}
