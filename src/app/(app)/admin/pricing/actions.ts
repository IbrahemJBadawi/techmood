'use server';

import { revalidatePath } from 'next/cache';

import type { ActionFormState } from '@/components/ActionForm';
import { createClient } from '@/lib/supabase/server';
import { dbError } from '@/lib/db-errors';
import { getT } from '@/lib/i18n.server';
import type { MentorLevel } from '@/lib/database.types';

/**
 * Pricing and TechMood's share, for every member.
 *
 * Every function called here checks is_admin() itself (0077, 0022); this file
 * grants nothing. What comes back on a refusal is the database's reason.
 */
function num(formData: FormData, key: string): number {
  return Number(String(formData.get(key) ?? '').trim());
}

async function done(message: { ar: string; en: string }, error: { message: string } | null): Promise<ActionFormState> {
  const t = await getT();
  revalidatePath('/admin/pricing');
  if (error) return { error: dbError(t, error.message) };
  return { ok: t(message.ar, message.en) };
}

export async function saveLevel(_prev: ActionFormState, formData: FormData): Promise<ActionFormState> {
  const supabase = await createClient();
  const { error } = await supabase.rpc('save_mentor_level', {
    p_level: String(formData.get('level')) as MentorLevel,
    p_default_usd: num(formData, 'default_usd'),
    p_min_usd: num(formData, 'min_usd'),
    p_max_usd: num(formData, 'max_usd'),
    p_commission_pct: num(formData, 'commission_pct'),
  });
  revalidatePath('/mentors');
  return done({ ar: 'حُفظ المستوى. الأسعار الخاصة خارج المدى الجديد تُحسب عند حدّه.', en: 'Saved. Own prices outside the new range are charged at its edge.' }, error);
}

export async function saveTier(_prev: ActionFormState, formData: FormData): Promise<ActionFormState> {
  const supabase = await createClient();
  const { error } = await supabase.rpc('save_commission_tier', {
    p_kind: String(formData.get('kind') ?? ''),
    p_min_amount: num(formData, 'min_amount'),
    p_rate: num(formData, 'rate'),
    p_note: String(formData.get('note') ?? '').trim() || null,
    p_remove: formData.get('remove') === 'yes',
  });
  return done({ ar: 'حُفظت الشريحة.', en: 'Bracket saved.' }, error);
}

export async function saveSetting(_prev: ActionFormState, formData: FormData): Promise<ActionFormState> {
  const supabase = await createClient();
  const { error } = await supabase.rpc('save_platform_setting', {
    p_key: String(formData.get('key') ?? ''),
    p_value: String(formData.get('value') ?? '').trim(),
  });
  return done({ ar: 'حُفظ الإعداد.', en: 'Setting saved.' }, error);
}

export async function refundBooking(_prev: ActionFormState, formData: FormData): Promise<ActionFormState> {
  const supabase = await createClient();
  const { error } = await supabase.rpc('refund_booking', {
    p_booking: String(formData.get('booking_id') ?? ''),
    p_reason: String(formData.get('reason') ?? '').trim() || null,
  });
  revalidatePath('/admin/finance');
  return done({ ar: 'أُعيد المبلغ إلى محفظة الطالب.', en: 'Refunded to the learner’s wallet.' }, error);
}

/** A learner reported the mentor absent: the admin settles it either way (0104). */
export async function settleAttendance(_prev: ActionFormState, formData: FormData): Promise<ActionFormState> {
  const supabase = await createClient();
  const outcome = formData.get('outcome') === 'held' ? 'held' : 'mentor_absent';
  const bookingId = String(formData.get('booking_id') ?? '');
  const { error } = await supabase.rpc('record_attendance', { p_booking: bookingId, p_outcome: outcome });
  revalidatePath('/admin/pricing');
  revalidatePath(`/bookings/${bookingId}`);
  return done(outcome === 'held'
    ? { ar: 'سُجّلت الجلسة منعقدة.', en: 'Recorded as held.' }
    : { ar: 'سُجّل غياب المنتور وأُعيد المبلغ للطالب.', en: 'Mentor absence recorded; the learner is refunded.' }, error);
}

export async function switchMentor(_prev: ActionFormState, formData: FormData): Promise<ActionFormState> {
  const supabase = await createClient();
  const { error } = await supabase.rpc('set_mentor_accepting', {
    p_accepting: formData.get('accepting') === 'on',
    p_mentor: String(formData.get('mentor_id') ?? ''),
    p_note: String(formData.get('note') ?? '').trim() || null,
  });
  revalidatePath('/mentors');
  return done({ ar: 'تغيّر استقبال المنتور للطلبات.', en: 'The mentor’s requests were switched.' }, error);
}
