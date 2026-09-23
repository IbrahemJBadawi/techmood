'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';

/** Approving marks the held ledger row paid; rejecting cancels it and returns the money. */
export async function reviewPayout(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  await supabase.rpc('review_payout', {
    p_request: String(formData.get('request_id') ?? ''),
    p_approve: formData.get('decision') === 'approve',
    p_reference: String(formData.get('reference') ?? '').slice(0, 200) || null,
    p_note: String(formData.get('note') ?? '').slice(0, 500) || null,
  });

  revalidatePath('/admin/payouts');
  revalidatePath('/admin');
}

/** "I am sending it now" — the request moves to processing and the payee is told. */
export async function startTransfer(formData: FormData) {
  const supabase = await createClient();
  await supabase.rpc('start_payout_transfer', { p_request: String(formData.get('request_id') ?? '') });
  revalidatePath('/admin/payouts');
}

/** The admin's own receipt for a transfer, filed under the payee's folder. */
export async function attachPayoutProof(requestId: string, path: string): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc('attach_payout_proof', { p_request: requestId, p_path: path });
  revalidatePath('/admin/payouts');
  return error ? { ok: false, error: error.message } : { ok: true };
}
