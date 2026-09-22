'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';

import { createClient } from '@/lib/supabase/server';
import { dbError } from '@/lib/db-errors';
import { getT } from '@/lib/i18n.server';
import type { MarketSaveKind } from '@/lib/database.types';

export type MarketState = { error?: string; ok?: string } | undefined;

/** Keeping something to come back to. Private to whoever saved it. */
export async function toggleSave(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  await supabase.rpc('toggle_market_save', {
    p_kind: String(formData.get('kind') ?? 'opportunity') as MarketSaveKind,
    p_target: String(formData.get('target') ?? ''),
  });

  revalidatePath(String(formData.get('revalidate') ?? '/marketplace'));
}

/**
 * Asking somebody by name. Only the poster may, and only somebody who offered
 * their work can be asked — both checked in the database.
 */
export async function inviteToOpportunity(_prev: MarketState, formData: FormData): Promise<MarketState> {
  const t = await getT();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const opportunity = String(formData.get('opportunity_id') ?? '');
  const profile = String(formData.get('profile_id') ?? '') || null;
  const team = String(formData.get('team_id') ?? '') || null;

  const { error } = await supabase.rpc('invite_to_opportunity', {
    p_opportunity: opportunity,
    p_profile: profile,
    p_team: team,
    p_message: String(formData.get('message') ?? '').trim() || null,
  });

  revalidatePath(`/marketplace/${opportunity}`);
  if (error) return { error: dbError(t, error.message) };
  return { ok: t('وصلت الدعوة.', 'The invitation is on its way.') };
}

/** Answering one. Accepting is applying — the same queue, one step along. */
export async function respondToInvite(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  await supabase.rpc('respond_to_invite', {
    p_invite: String(formData.get('invite_id') ?? ''),
    p_accept: formData.get('answer') === 'accept',
  });

  revalidatePath('/marketplace');
}
