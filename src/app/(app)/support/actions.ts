'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';
import { dbError } from '@/lib/db-errors';
import { getT } from '@/lib/i18n.server';
import type { TicketCategory, TicketRelated } from '@/lib/database.types';

export type SupportState = { error?: string; ok?: string } | undefined;

/**
 * Opening a ticket. What it may point at, who it is about, its priority and
 * whether a person has to see it are all decided by open_ticket() (0083).
 */
export async function openTicket(_prev: SupportState, formData: FormData): Promise<SupportState> {
  const t = await getT();
  const supabase = await createClient();

  const related = String(formData.get('related') ?? '');
  const [relatedType, relatedId] = related.includes(':') ? related.split(':') : [null, null];

  const { data, error } = await supabase.rpc('open_ticket', {
    p_category: String(formData.get('category') ?? 'other') as TicketCategory,
    p_subject: String(formData.get('subject') ?? '').trim(),
    p_description: String(formData.get('description') ?? '').trim(),
    p_related: (relatedType as TicketRelated | null) || null,
    p_related_id: relatedId || null,
    p_attachment: String(formData.get('attachment') ?? '') || null,
  });

  if (error) return { error: dbError(t, error.message) };
  revalidatePath('/support');
  redirect(`/support/${data.id}`);
}

export async function replyToTicket(_prev: SupportState, formData: FormData): Promise<SupportState> {
  const t = await getT();
  const supabase = await createClient();
  const ticketId = String(formData.get('ticket_id') ?? '');

  const { error } = await supabase.rpc('post_ticket_message', {
    p_ticket: ticketId,
    p_body: String(formData.get('body') ?? '').trim(),
    p_attachment: String(formData.get('attachment') ?? '') || null,
    p_internal: formData.get('internal') === 'on',
  });

  revalidatePath(`/support/${ticketId}`);
  revalidatePath(`/admin/support/${ticketId}`);
  if (error) return { error: dbError(t, error.message) };
  return { ok: t('أُرسلت.', 'Sent.') };
}
