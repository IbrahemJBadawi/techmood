'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';

import { createClient } from '@/lib/supabase/server';
import { getT } from '@/lib/i18n.server';
import { dbError } from '@/lib/db-errors';

export type WalletState = { error?: string; ok?: string } | undefined;

export async function addPayoutAccount(_prev: WalletState, formData: FormData): Promise<WalletState> {
  const t = await getT();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const holder = String(formData.get('holder_name') ?? '').trim();
  if (holder.length < 3) return { error: t('اكتب اسم صاحب الحساب كما هو مسجّل لديه.', 'Enter the account holder’s name exactly as their bank has it.') };

  const destination = ['account_number', 'wallet_number', 'iban']
    .map((field) => String(formData.get(field) ?? '').trim())
    .filter(Boolean);

  if (destination.length === 0) {
    return { error: t('أدخل رقم حساب أو رقم محفظة أو IBAN على الأقل.', 'Enter at least an account number, a wallet number or an IBAN.') };
  }

  const { error } = await supabase.from('payout_accounts').insert({
    profile_id: user.id,
    method_key: String(formData.get('method_key') ?? ''),
    label_ar: String(formData.get('label') ?? '').trim() || null,
    holder_name: holder,
    account_number: String(formData.get('account_number') ?? '').trim() || null,
    wallet_number: String(formData.get('wallet_number') ?? '').trim() || null,
    iban: String(formData.get('iban') ?? '').trim() || null,
    swift: String(formData.get('swift') ?? '').trim() || null,
    bank_name: String(formData.get('bank_name') ?? '').trim() || null,
    country: String(formData.get('country') ?? '').trim() || null,
  });

  if (error) return { error: t('تعذّر حفظ حساب السحب.', 'The payout account could not be saved.') };

  revalidatePath('/wallet');
  return { ok: t('أُضيف حساب السحب.', 'Payout account added.') };
}

/** The balance check, the minimum and the hold all happen in the database. */
export async function requestPayout(_prev: WalletState, formData: FormData): Promise<WalletState> {
  const t = await getT();
  const supabase = await createClient();

  const amount = Number(String(formData.get('amount') ?? '0'));
  if (!Number.isFinite(amount) || amount <= 0) return { error: t('أدخل مبلغاً صحيحاً.', 'Enter a valid amount.') };

  const { error } = await supabase.rpc('request_payout', {
    p_account: String(formData.get('account_id') ?? ''),
    p_amount: amount,
  });

  if (error) {
    const message = error.message ?? '';
    if (message.includes('minimum payout')) {
      return { error: `المبلغ أقل من الحد الأدنى للسحب (${message.split('is ')[1] ?? ''}$).` };
    }
    if (message.includes('is available')) return { error: t('المبلغ المطلوب أكبر من رصيدك المتاح.', 'That is more than your available balance.') };
    if (message.includes('does not belong')) return { error: t('حساب السحب المختار ليس حسابك.', 'That payout account is not yours.') };
    return { error: t('تعذّر إرسال طلب السحب.', 'The payout request could not be sent.') };
  }

  revalidatePath('/wallet');
  return { ok: t('أُرسل طلب السحب، وينتظر مراجعة TechMood.', 'Payout requested; it is now waiting on a TechMood review.') };
}

/**
 * Switching the method of an open payment, from the payment page itself.
 * choose_payment_method() checks the payer, that the payment is still open,
 * and that the method is on, complete, and collects for this kind of payment.
 */
export async function choosePaymentMethod(
  paymentId: string,
  method: string,
  revalidate: string,
): Promise<{ ok: boolean; error?: string }> {
  const t = await getT();
  const supabase = await createClient();
  const { error } = await supabase.rpc('choose_payment_method', { p_payment: paymentId, p_method: method });
  revalidatePath(revalidate);
  if (error) return { ok: false, error: dbError(t, error.message) };
  return { ok: true };
}
