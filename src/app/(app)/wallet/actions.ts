'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';

import { createClient } from '@/lib/supabase/server';

export type WalletState = { error?: string; ok?: string } | undefined;

export async function addPayoutAccount(_prev: WalletState, formData: FormData): Promise<WalletState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const holder = String(formData.get('holder_name') ?? '').trim();
  if (holder.length < 3) return { error: 'اكتب اسم صاحب الحساب كما هو مسجّل لديه.' };

  const destination = ['account_number', 'wallet_number', 'iban']
    .map((field) => String(formData.get(field) ?? '').trim())
    .filter(Boolean);

  if (destination.length === 0) {
    return { error: 'أدخل رقم حساب أو رقم محفظة أو IBAN على الأقل.' };
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

  if (error) return { error: 'تعذّر حفظ حساب السحب.' };

  revalidatePath('/wallet');
  return { ok: 'أُضيف حساب السحب.' };
}

/** The balance check, the minimum and the hold all happen in the database. */
export async function requestPayout(_prev: WalletState, formData: FormData): Promise<WalletState> {
  const supabase = await createClient();

  const amount = Number(String(formData.get('amount') ?? '0'));
  if (!Number.isFinite(amount) || amount <= 0) return { error: 'أدخل مبلغاً صحيحاً.' };

  const { error } = await supabase.rpc('request_payout', {
    p_account: String(formData.get('account_id') ?? ''),
    p_amount: amount,
  });

  if (error) {
    const message = error.message ?? '';
    if (message.includes('minimum payout')) {
      return { error: `المبلغ أقل من الحد الأدنى للسحب (${message.split('is ')[1] ?? ''}$).` };
    }
    if (message.includes('is available')) return { error: 'المبلغ المطلوب أكبر من رصيدك المتاح.' };
    if (message.includes('does not belong')) return { error: 'حساب السحب المختار ليس حسابك.' };
    return { error: 'تعذّر إرسال طلب السحب.' };
  }

  revalidatePath('/wallet');
  return { ok: 'أُرسل طلب السحب، وينتظر مراجعة TechMood.' };
}
