import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Records which account a payment was paid from (0097), from the payer-account
 * fields of a payment form: a saved account, or one typed now (and saved as the
 * default when asked). Nothing chosen and nothing typed leaves it to the
 * database, which falls back to the payer's default account or refuses.
 */
export async function applyPayerAccount(
  supabase: SupabaseClient,
  paymentId: string,
  formData: FormData,
): Promise<{ message: string } | null> {
  const choice = String(formData.get('payer_account') ?? '');
  const holder = String(formData.get('payer_holder') ?? '').trim();
  const accountRef = String(formData.get('payer_account_ref') ?? '').trim();

  if (choice && choice !== 'new') {
    const { error } = await supabase.rpc('set_payment_payer', { p_payment: paymentId, p_account: choice });
    return error;
  }
  if (holder || accountRef) {
    const { error } = await supabase.rpc('set_payment_payer', {
      p_payment: paymentId,
      p_account: null,
      p_holder: holder,
      p_account_ref: accountRef,
      p_method_key: null,
      p_save: formData.get('payer_save') === 'on',
    });
    return error;
  }
  return null;
}
