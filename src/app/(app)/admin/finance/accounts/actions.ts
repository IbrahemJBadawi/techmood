'use server';

import { revalidatePath } from 'next/cache';

import { createClient } from '@/lib/supabase/server';
import { getT } from '@/lib/i18n.server';
import { dbError } from '@/lib/db-errors';

export type AccountState = { error?: string; ok?: string } | undefined;

const val = (formData: FormData, key: string) => String(formData.get(key) ?? '').trim() || null;

/** Saved through save_payment_account(), which checks the admin and refuses an
 *  account switched on with nowhere to send money. */
export async function savePaymentAccount(_prev: AccountState, formData: FormData): Promise<AccountState> {
  const t = await getT();
  const supabase = await createClient();

  const { error } = await supabase.rpc('save_payment_account', {
    p_key: String(formData.get('key') ?? ''),
    p_enabled: formData.get('enabled') === 'on',
    p_recipient_name: val(formData, 'recipient_name'),
    p_account_number: val(formData, 'account_number'),
    p_wallet_number: val(formData, 'wallet_number'),
    p_iban: val(formData, 'iban'),
    p_swift: val(formData, 'swift'),
    p_bank_name: val(formData, 'bank_name'),
    p_instructions: val(formData, 'instructions'),
    p_use_for: formData.getAll('use_for').map(String),
    p_supports_payout: formData.get('supports_payout') === 'on',
  });

  revalidatePath('/admin/finance/accounts');
  if (error) return { error: dbError(t, error.message) };
  return { ok: t('حُفظ.', 'Saved.') };
}
