'use server';

import { revalidatePath } from 'next/cache';

import { createClient } from '@/lib/supabase/server';
import { getT } from '@/lib/i18n.server';
import { dbError } from '@/lib/db-errors';
import type { RoleRequestEvent } from '@/lib/database.types';

export type ReviewState = { error?: string; ok?: string } | undefined;

const ALLOWED: RoleRequestEvent[] = ['approved', 'rejected', 'more_info_requested', 'suspended', 'reinstated'];

/**
 * Approve, reject, or ask for more information.
 *
 * The decision itself is made by decide_role_request(), which checks that the
 * caller is an admin, refuses a rejection with no reason, records the step in
 * the append-only trail and tells the applicant. Nothing here is trusted.
 */
export async function decideRequest(_prev: ReviewState, formData: FormData): Promise<ReviewState> {
  const t = await getT();
  const supabase = await createClient();
  const decision = String(formData.get('decision') ?? '') as RoleRequestEvent;

  if (!ALLOWED.includes(decision)) return { error: t('قرار غير معروف.', 'Unknown decision.') };

  const { error } = await supabase.rpc('decide_role_request', {
    p_request: String(formData.get('request_id') ?? ''),
    p_decision: decision,
    p_note: String(formData.get('note') ?? '').trim() || null,
  });

  if (error) return { error: dbError(t, error.message) };

  revalidatePath('/admin/role-requests');
  return { ok: t('تم.', 'Done.') };
}
