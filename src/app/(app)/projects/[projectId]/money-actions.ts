'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';

import { createClient } from '@/lib/supabase/server';
import { dbError } from '@/lib/db-errors';
import { getT } from '@/lib/i18n.server';
import type { ClientCriterion, SaleLicence } from '@/lib/database.types';

export type MoneyState = { error?: string; ok?: string } | undefined;

/**
 * Opening the hold. The amount and the commission are the database's answer,
 * not this form's: `open_escrow()` prices it from the brackets in the table.
 */
export async function openEscrow(_prev: MoneyState, formData: FormData): Promise<MoneyState> {
  const t = await getT();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const projectId = String(formData.get('project_id') ?? '');
  const amount = Number(formData.get('amount') ?? 0);
  if (!(amount > 0)) return { error: t('اكتب مبلغاً صحيحاً.', 'Enter a real amount.') };

  const { error } = await supabase.rpc('open_escrow', {
    p_kind: 'market_work',
    p_project: projectId,
    p_payee: String(formData.get('payee') ?? ''),
    p_amount: amount,
    p_method_key: String(formData.get('method_key') ?? ''),
  });

  revalidatePath(`/projects/${projectId}`);
  if (error) return { error: dbError(t, error.message) };
  return { ok: t('فُتح الحجز — أرسل الإيصال لتأكيده.', 'The hold is open — send the receipt to confirm it.') };
}

/** The receipt, exactly as a booking's. */
export async function submitEscrowProof(_prev: MoneyState, formData: FormData): Promise<MoneyState> {
  const t = await getT();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { error } = await supabase.rpc('submit_escrow_proof', {
    p_escrow: String(formData.get('escrow_id') ?? ''),
    p_proof_path: String(formData.get('proof_path') ?? '').trim() || null,
    p_reference: String(formData.get('reference') ?? '').trim() || null,
  });

  revalidatePath(String(formData.get('revalidate') ?? '/marketplace'));
  if (error) return { error: dbError(t, error.message) };
  return { ok: t('وصل إثبات الدفع — تتحقق منه الإدارة.', 'The receipt is in — TechMood is checking it.') };
}

/** Letting the money go, freezing it, or judging the work. */
export async function escrowAction(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const escrowId = String(formData.get('escrow_id') ?? '');
  const action = String(formData.get('action') ?? '');

  if (action === 'release') {
    await supabase.rpc('release_escrow', { p_escrow: escrowId, p_note: null });
  } else if (action === 'dispute') {
    await supabase.rpc('dispute_escrow', {
      p_escrow: escrowId,
      p_reason: String(formData.get('reason') ?? '').trim() || 'خلاف على التسليم',
    });
  }

  revalidatePath(String(formData.get('revalidate') ?? '/marketplace'));
}

/**
 * The client's judgement. It can only be written once the money was released,
 * which is what makes it worth reading.
 */
export async function reviewWork(_prev: MoneyState, formData: FormData): Promise<MoneyState> {
  const t = await getT();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const projectId = String(formData.get('project_id') ?? '');
  const criteria = String(formData.get('criteria') ?? '').split(',').filter(Boolean) as ClientCriterion[];
  const scores: Partial<Record<ClientCriterion, number>> = {};
  for (const criterion of criteria) {
    const raw = String(formData.get(criterion) ?? '').trim();
    if (raw) scores[criterion] = Number(raw);
  }

  if (Object.keys(scores).length === 0) {
    return { error: t('اختر درجة واحدة على الأقل.', 'Give at least one score.') };
  }

  const { error } = await supabase.rpc('review_client_work', {
    p_project: projectId,
    p_scores: scores,
    p_comment: String(formData.get('comment') ?? '').trim() || null,
  });

  revalidatePath(`/projects/${projectId}`);
  if (error) return { error: dbError(t, error.message) };
  return { ok: t('وصل تقييمك، وهو الآن جزء من سجلّ من نفّذ العمل.',
                 'Your review is in, and it is now part of the record of whoever did the work.') };
}

/** Putting finished work on the shelf. */
export async function listForSale(_prev: MoneyState, formData: FormData): Promise<MoneyState> {
  const t = await getT();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const projectId = String(formData.get('project_id') ?? '');

  const { error } = await supabase.rpc('list_project_for_sale', {
    p_project: projectId,
    p_price: Number(formData.get('price') ?? 0),
    p_summary: String(formData.get('summary') ?? '').trim(),
    p_licence: (String(formData.get('licence') ?? 'usage_rights') as SaleLicence),
    p_includes: String(formData.get('includes') ?? '')
      .split(',').map((item) => item.trim()).filter(Boolean),
  });

  revalidatePath(`/projects/${projectId}`);
  revalidatePath('/marketplace');
  if (error) return { error: dbError(t, error.message) };
  return { ok: t('عُرض المشروع للبيع.', 'The project is on sale.') };
}

export async function withdrawListing(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  await supabase.rpc('withdraw_listing', { p_listing: String(formData.get('listing_id') ?? '') });
  revalidatePath(String(formData.get('revalidate') ?? '/marketplace'));
}

/** Buying one. Nothing changes hands on a click: it opens a hold. */
export async function buyProject(_prev: MoneyState, formData: FormData): Promise<MoneyState> {
  const t = await getT();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { error } = await supabase.rpc('buy_project', {
    p_listing: String(formData.get('listing_id') ?? ''),
    p_method_key: String(formData.get('method_key') ?? ''),
  });

  revalidatePath('/marketplace');
  if (error) return { error: dbError(t, error.message) };
  return { ok: t('حُجز المشروع لك — أرسل الإيصال من «عملي».',
                 'The project is reserved for you — send the receipt from “My work”.') };
}
