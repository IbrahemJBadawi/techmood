import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database, PayTo } from '@/lib/database.types';
import type { MethodOption } from '@/components/MethodPicker';

/** Everything an escrow payer needs to pay: where, how, and what else they may use. */
export type EscrowPayTo = {
  paymentId: string;
  payTo: PayTo;
  options: MethodOption[];
  infoRequest: string | null;
};

/**
 * Where to send the money for one hold. The receiving account is column-locked
 * and only `payment_instructions()` returns it — the fields the chosen method
 * shows, to the payer of this payment, while it is open — so anyone else gets
 * null.
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

  const [{ data: rows }, { data: options }] = await Promise.all([
    supabase.rpc('payment_instructions', { p_payment: open.id }),
    supabase.rpc('payment_options', { p_payment: open.id }),
  ]);
  const payTo = rows?.[0];
  if (!payTo) return null;

  return { paymentId: open.id, payTo, options: options ?? [], infoRequest: open.info_request_ar };
}
