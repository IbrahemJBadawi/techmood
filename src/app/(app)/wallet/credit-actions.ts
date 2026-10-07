'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';
import { getT } from '@/lib/i18n.server';
import { dbError } from '@/lib/db-errors';

export type CreditState = { error?: string; ok?: string } | undefined;

/** Ask to top up: an amount and a transfer method; then the transfer details page (0151). */
export async function requestTopup(_prev: CreditState, formData: FormData): Promise<CreditState> {
  const t = await getT();
  const supabase = await createClient();
  const amount = Number(formData.get('amount') ?? 0);
  const method = String(formData.get('method') ?? '');
  if (!method) return { error: t('اختر طريقة التحويل.', 'Choose how you will transfer.') };
  const { data, error } = await supabase.rpc('request_topup', { p_amount: amount, p_method: method });
  if (error) return { error: dbError(t, error.message) };
  redirect(`/wallet/topup/${data}`);
}

/** Pay for Premium or a package by transfer: a top-up for exactly its price, completed on approval (0155). */
export async function requestPurchase(_prev: CreditState, formData: FormData): Promise<CreditState> {
  const t = await getT();
  const supabase = await createClient();
  const method = String(formData.get('method') ?? '');
  if (!method) return { error: t('اختر طريقة التحويل.', 'Choose how you will transfer.') };
  const purpose = String(formData.get('purpose')) === 'package' ? 'package' : 'premium';
  const { data, error } = await supabase.rpc('request_purchase_topup', purpose === 'premium'
    ? { p_purpose: 'premium', p_method: method, p_plan: String(formData.get('plan')) === 'month' ? 'month' : 'year' }
    : {
        p_purpose: 'package', p_method: method,
        p_mentor: String(formData.get('mentor_id') ?? ''),
        p_session_type: String(formData.get('session_type_id') ?? ''),
        p_sessions: Number(formData.get('sessions') ?? 0),
      });
  if (error) return { error: dbError(t, error.message) };
  redirect(`/wallet/topup/${data}`);
}

/** The receipt of a top-up, for an admin to check. */
export async function submitTopupProof(_prev: CreditState, formData: FormData): Promise<CreditState> {
  const t = await getT();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const id = String(formData.get('topup_id') ?? '');
  const proof = String(formData.get('proof_path') ?? '').trim() || null;
  if (proof && !proof.startsWith(`${user.id}/`)) return { error: t('ملف الإيصال غير صالح.', 'That receipt file is not valid.') };
  const { error } = await supabase.rpc('submit_topup_proof', {
    p_topup: id, p_proof_path: proof, p_reference: String(formData.get('reference') ?? '').trim() || null,
  });
  if (error) return { error: dbError(t, error.message) };
  revalidatePath(`/wallet/topup/${id}`);
  revalidatePath('/wallet');
  return { ok: t('أُرسل الإيصال — يُشحن رصيدك حين تتحقق منه TechMood.', 'Sent — your balance is topped up once TechMood checks it.') };
}

export async function cancelTopup(formData: FormData) {
  const supabase = await createClient();
  await supabase.rpc('cancel_topup', { p_topup: String(formData.get('topup_id') ?? '') });
  revalidatePath('/wallet');
  redirect('/wallet');
}

/** Pay an open payment (a session, a purchase) from the balance, then go where it belongs. */
export async function payWithCredit(_prev: CreditState, formData: FormData): Promise<CreditState> {
  const t = await getT();
  const supabase = await createClient();
  const { error } = await supabase.rpc('pay_with_credit', { p_payment: String(formData.get('payment_id') ?? '') });
  if (error) return { error: dbError(t, error.message) };
  const next = String(formData.get('next') ?? '/wallet');
  revalidatePath('/wallet');
  revalidatePath(next);
  redirect(next.startsWith('/') ? next : '/wallet');
}

/** Pay a session from a package. */
export async function payWithPackage(_prev: CreditState, formData: FormData): Promise<CreditState> {
  const t = await getT();
  const supabase = await createClient();
  const { error } = await supabase.rpc('pay_with_package', {
    p_payment: String(formData.get('payment_id') ?? ''), p_package: String(formData.get('package_id') ?? ''),
  });
  if (error) return { error: dbError(t, error.message) };
  const next = String(formData.get('next') ?? '/bookings');
  revalidatePath('/wallet');
  redirect(next.startsWith('/') ? next : '/bookings');
}

/** Buy a package of sessions with a mentor, from the balance (0152). */
export async function buyPackage(_prev: CreditState, formData: FormData): Promise<CreditState> {
  const t = await getT();
  const supabase = await createClient();
  const { error } = await supabase.rpc('buy_session_package', {
    p_mentor: String(formData.get('mentor_id') ?? ''),
    p_session_type: String(formData.get('session_type_id') ?? ''),
    p_sessions: Number(formData.get('sessions') ?? 0),
  });
  if (error) return { error: dbError(t, error.message) };
  revalidatePath('/wallet');
  return { ok: t('✓ اشتريت الباقة — اختر «ادفع من باقتك» عند الحجز مع هذا المنتور.', '✓ Package bought — choose «Pay from your package» when you book this mentor.') };
}

/** Premium for a month or a year, from the balance (0154). */
export async function subscribePremium(_prev: CreditState, formData: FormData): Promise<CreditState> {
  const t = await getT();
  const supabase = await createClient();
  const plan = String(formData.get('plan')) === 'year' ? 'year' : 'month';
  const { error } = await supabase.rpc('subscribe_premium', { p_plan: plan });
  if (error) return { error: dbError(t, error.message) };
  revalidatePath('/premium');
  revalidatePath('/wallet');
  return { ok: t('✦ أهلاً بك في Premium!', '✦ Welcome to Premium!') };
}
