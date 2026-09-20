'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';

/** Verify or reject a payment. The admin check lives in verify_payment(). */
export async function reviewPayment(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  await supabase.rpc('verify_payment', {
    p_payment_id: String(formData.get('payment_id') ?? ''),
    p_approve: formData.get('decision') === 'verify',
    p_reason: String(formData.get('reason') ?? '').slice(0, 500) || null,
  });

  revalidatePath('/admin/payments');
  revalidatePath('/admin');
}

/** A short-lived link to a receipt, generated only for an admin who asked. */
export async function receiptUrl(proofPath: string) {
  const supabase = await createClient();
  const { data } = await supabase.storage.from('payment-proofs').createSignedUrl(proofPath, 300);
  return data?.signedUrl ?? null;
}
