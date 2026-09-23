import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@/lib/database.types';

/** What an escrow payer is shown before paying. Mirrors `EscrowInstructions`. */
export type EscrowPayTo = {
  payment_code: string;
  name_ar: string;
  instructions_ar: string | null;
  recipient_name: string | null;
  account_number: string | null;
  wallet_number: string | null;
  iban: string | null;
  bank_name: string | null;
  requires_receipt: boolean;
  requires_reference: boolean;
  reference_label_ar: string | null;
  info_request_ar: string | null;
};

/**
 * Where to send the money for one hold. The receiving account is column-locked
 * (0075) and only `payment_instructions()` returns it — to the payer of this
 * payment, while it is open — so a caller who is not the payer gets null.
 */
export async function escrowPayTo(
  supabase: SupabaseClient<Database>,
  escrowId: string,
): Promise<EscrowPayTo | null> {
  const { data: open } = await supabase
    .from('payments')
    .select('id, info_request_ar')
    .eq('escrow_id', escrowId)
    .in('status', ['pending', 'rejected', 'needs_info'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!open) return null;

  const { data: rows } = await supabase.rpc('payment_instructions', { p_payment: open.id });
  const row = rows?.[0];
  if (!row) return null;

  return {
    payment_code: row.payment_code, name_ar: row.name_ar, instructions_ar: row.instructions_ar,
    recipient_name: row.recipient_name, account_number: row.account_number,
    wallet_number: row.wallet_number, iban: row.iban, bank_name: row.bank_name,
    requires_receipt: row.requires_receipt, requires_reference: row.requires_reference,
    reference_label_ar: row.reference_label_ar, info_request_ar: open.info_request_ar,
  };
}
