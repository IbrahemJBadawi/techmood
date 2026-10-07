'use server';

import { createClient } from '@/lib/supabase/server';
import { getT } from '@/lib/i18n.server';
import type { BusinessNeed } from '@/lib/database.types';
import { dbError } from '@/lib/db-errors';

export type InquiryState = { ok?: boolean; error?: string } | undefined;

const NEEDS: BusinessNeed[] = ['hire', 'project', 'training', 'sponsor', 'other'];

/** A company's message to TechMood (0150): stored, and the admins are told at once. */
export async function sendInquiry(_prev: InquiryState, formData: FormData): Promise<InquiryState> {
  const t = await getT();
  const value = (key: string) => String(formData.get(key) ?? '').trim();
  const need = value('need') as BusinessNeed;
  if (!NEEDS.includes(need)) return { error: t('اختر ما تحتاجه شركتك.', 'Choose what your company needs.') };
  // a field a person never sees: a bot fills it, a person does not
  if (value('website')) return { ok: true };

  const supabase = await createClient();
  const { error } = await supabase.rpc('submit_business_inquiry', {
    p_company: value('company'), p_contact_name: value('contact_name'), p_email: value('email'),
    p_phone: value('phone') || null, p_need: need, p_message: value('message'),
  });
  if (error) return { error: dbError(t, error.message) };
  return { ok: true };
}
