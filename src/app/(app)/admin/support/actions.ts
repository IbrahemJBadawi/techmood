'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import type { ActionFormState } from '@/components/ActionForm';
import { assessForAdmin } from '@/lib/ai-claude';
import { createClient } from '@/lib/supabase/server';
import { dbError } from '@/lib/db-errors';
import { getT } from '@/lib/i18n.server';
import type { AdminActionKind, CaseLinkType, RestrictedFeature, TicketCategory, TicketStatus } from '@/lib/database.types';

/**
 * Support and case work. Every function called here checks is_admin() itself
 * (0083, 0084); this file adds no permission of its own.
 */
async function finish(paths: string[], error: { message: string } | null, ok: { ar: string; en: string }): Promise<ActionFormState> {
  const t = await getT();
  for (const path of paths) revalidatePath(path);
  if (error) return { error: dbError(t, error.message) };
  return { ok: t(ok.ar, ok.en) };
}

const text = (formData: FormData, key: string) => String(formData.get(key) ?? '').trim();

export async function setTicketStatus(_prev: ActionFormState, formData: FormData): Promise<ActionFormState> {
  const supabase = await createClient();
  const id = text(formData, 'ticket_id');
  const { error } = await supabase.rpc('set_ticket_status', {
    p_ticket: id,
    p_status: text(formData, 'status') as TicketStatus,
    p_note: text(formData, 'note') || null,
  });
  return finish([`/admin/support/${id}`, '/admin/support'], error, { ar: 'تغيّرت حالة البلاغ.', en: 'The ticket was updated.' });
}

export async function openCaseFromTicket(_prev: ActionFormState, formData: FormData): Promise<ActionFormState> {
  const t = await getT();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('open_case', {
    p_title: text(formData, 'title'),
    p_ticket: text(formData, 'ticket_id') || null,
    p_reported: text(formData, 'reported') || null,
  });
  if (error) return { error: dbError(t, error.message) };
  redirect(`/admin/cases/${data.id}`);
}

/** ✨ AI Assist on a ticket: a reading stored beside it, never a decision. */
export async function assistTicket(_prev: ActionFormState, formData: FormData): Promise<ActionFormState> {
  const t = await getT();
  const supabase = await createClient();
  const id = text(formData, 'ticket_id');

  const [{ data: ticket }, { data: messages }] = await Promise.all([
    supabase.from('support_tickets').select('code, category, subject_ar, related_type, status, priority, escalation_reason').eq('id', id).single(),
    supabase.from('ticket_messages').select('author_kind, body_ar, attachment_path').eq('ticket_id', id).order('created_at'),
  ]);
  if (!ticket) return { error: t('البلاغ غير موجود', 'Ticket not found') };

  const result = await assessForAdmin({
    kind: 'ticket',
    facts: { ...ticket, attachments: (messages ?? []).filter((row) => row.attachment_path).length },
    conversation: (messages ?? []).map((row) => ({ author: row.author_kind, body: row.body_ar })),
  });
  if (!result.assessment) return { error: result.error_ar ?? '' };

  const { error } = await supabase.rpc('save_ai_assist', {
    p_case: null,
    p_ticket: id,
    p_summary: [result.assessment.summary_ar, ...result.assessment.evidence.map((item) => `• ${item}`)].join('\n'),
    p_next_step: result.assessment.next_step_ar,
    p_category: result.assessment.category as TicketCategory | null,
    p_confidence: result.assessment.confidence,
  });
  return finish([`/admin/support/${id}`, '/admin/support'], error, { ar: 'قرأ الذكاء الاصطناعي البلاغ — القرار لك.', en: 'AI has read the ticket — the decision is yours.' });
}

/* ------------------------------ cases ------------------------------ */

export async function caseAction(_prev: ActionFormState, formData: FormData): Promise<ActionFormState> {
  const supabase = await createClient();
  const id = text(formData, 'case_id');
  const duration = text(formData, 'duration_days');
  const { error } = await supabase.rpc('admin_case_action', {
    p_case: id,
    p_action: text(formData, 'action') as AdminActionKind,
    p_reason: text(formData, 'reason'),
    p_target_profile: text(formData, 'target_profile') || null,
    p_target_id: text(formData, 'target_id') || null,
    p_feature: (text(formData, 'feature') || null) as RestrictedFeature | null,
    p_duration_days: duration === '' ? null : Number(duration),
    p_notify: formData.get('notify') === 'on',
  });
  return finish([`/admin/cases/${id}`, '/admin/cases', '/admin/support'], error, { ar: 'نُفّذ الإجراء وسُجّل.', en: 'Done, and recorded.' });
}

export async function addCaseNote(_prev: ActionFormState, formData: FormData): Promise<ActionFormState> {
  const supabase = await createClient();
  const id = text(formData, 'case_id');
  const { error } = await supabase.rpc('add_case_note', { p_case: id, p_body: text(formData, 'body') });
  return finish([`/admin/cases/${id}`], error, { ar: 'أُضيفت الملاحظة.', en: 'Note added.' });
}

export async function addCaseEvidence(_prev: ActionFormState, formData: FormData): Promise<ActionFormState> {
  const supabase = await createClient();
  const id = text(formData, 'case_id');
  const { error } = await supabase.rpc('add_case_evidence', {
    p_case: id, p_label: text(formData, 'label'), p_url: text(formData, 'url') || null,
  });
  return finish([`/admin/cases/${id}`], error, { ar: 'أُضيف الدليل.', en: 'Evidence added.' });
}

export async function linkToCase(_prev: ActionFormState, formData: FormData): Promise<ActionFormState> {
  const supabase = await createClient();
  const id = text(formData, 'case_id');
  const { error } = await supabase.rpc('link_to_case', {
    p_case: id,
    p_type: text(formData, 'type') as CaseLinkType,
    p_id: text(formData, 'entity_id'),
    p_note: text(formData, 'note') || null,
  });
  return finish([`/admin/cases/${id}`], error, { ar: 'رُبطت العملية بالقضية.', en: 'Linked to the case.' });
}

export async function assistCase(_prev: ActionFormState, formData: FormData): Promise<ActionFormState> {
  const t = await getT();
  const supabase = await createClient();
  const id = text(formData, 'case_id');

  const [{ data: facts }, { data: tickets }] = await Promise.all([
    supabase.rpc('case_facts', { p_case: id }),
    supabase.from('support_tickets').select('id').eq('case_id', id),
  ]);
  const ticketIds = (tickets ?? []).map((row) => row.id);
  const { data: messages } = ticketIds.length
    ? await supabase.from('ticket_messages').select('author_kind, body_ar').in('ticket_id', ticketIds).order('created_at')
    : { data: [] as { author_kind: string; body_ar: string }[] };

  const result = await assessForAdmin({
    kind: 'case',
    facts,
    conversation: (messages ?? []).map((row) => ({ author: row.author_kind, body: row.body_ar })),
  });
  if (!result.assessment) return { error: result.error_ar ?? t('تعذّر', 'Failed') };

  const { error } = await supabase.rpc('save_ai_assist', {
    p_case: id,
    p_ticket: null,
    p_summary: [result.assessment.summary_ar, ...result.assessment.evidence.map((item) => `• ${item}`)].join('\n'),
    p_next_step: result.assessment.next_step_ar,
  });
  return finish([`/admin/cases/${id}`], error, { ar: 'قرأ الذكاء الاصطناعي القضية — القرار لك.', en: 'AI has read the case — the decision is yours.' });
}
