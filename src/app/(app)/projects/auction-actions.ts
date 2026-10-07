'use server';

import { revalidatePath } from 'next/cache';

import { createClient } from '@/lib/supabase/server';
import { getT } from '@/lib/i18n.server';
import { dbError } from '@/lib/db-errors';

export type AuctionState = { error?: string; ok?: string } | undefined;

/** Put a listed project up for auction (0153). */
export async function startAuction(_prev: AuctionState, formData: FormData): Promise<AuctionState> {
  const t = await getT();
  const supabase = await createClient();
  const { error } = await supabase.rpc('start_auction', {
    p_listing: String(formData.get('listing_id') ?? ''),
    p_start: Number(formData.get('start') ?? 0),
    p_step: Number(formData.get('step') ?? 0),
    p_hours: Number(formData.get('hours') ?? 0),
  });
  if (error) return { error: dbError(t, error.message) };
  revalidatePath(String(formData.get('revalidate') ?? '/marketplace'));
  return { ok: t('🔨 بدأ المزاد — يظهر في السوق مع عدّاد.', '🔨 The auction is on — it shows in the market with a countdown.') };
}

export async function placeBid(_prev: AuctionState, formData: FormData): Promise<AuctionState> {
  const t = await getT();
  const supabase = await createClient();
  const { error } = await supabase.rpc('place_bid', {
    p_auction: String(formData.get('auction_id') ?? ''), p_amount: Number(formData.get('amount') ?? 0),
  });
  if (error) return { error: dbError(t, error.message) };
  revalidatePath(String(formData.get('revalidate') ?? '/marketplace'));
  return { ok: t('✓ مزايدتك هي الأعلى الآن', '✓ Yours is the top bid now') };
}

export async function cancelAuction(formData: FormData) {
  const supabase = await createClient();
  await supabase.rpc('cancel_auction', { p_auction: String(formData.get('auction_id') ?? '') });
  revalidatePath(String(formData.get('revalidate') ?? '/marketplace'));
}
