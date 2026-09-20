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
