'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';

import { createClient } from '@/lib/supabase/server';

/**
 * A disputed hold is the one case where the platform decides: it either goes to
 * the person who did the work, or back to the person who paid. Both are written
 * to the wallet, and both notify the two sides.
 */
export async function settleEscrow(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const escrowId = String(formData.get('escrow_id') ?? '');
  const reason = String(formData.get('reason') ?? '').trim();

  if (formData.get('decision') === 'release') {
    await supabase.rpc('release_escrow', { p_escrow: escrowId, p_note: reason || null });
  } else {
    await supabase.rpc('refund_escrow', { p_escrow: escrowId, p_reason: reason || 'قرار الإدارة' });
  }

  revalidatePath('/admin/escrows');
}
