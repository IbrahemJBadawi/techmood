'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';
import { getT } from '@/lib/i18n.server';
import type { MessageReaction } from '@/lib/database.types';

export type MessageState = { error?: string } | undefined;

/**
 * Sends a message. Links and images are refused by the database, not only here,
 * because the rule exists to keep work reviewable inside TechMood rather than
 * scattered across chat threads.
 */
export async function sendMessage(_prev: MessageState, formData: FormData): Promise<MessageState> {
  const t = await getT();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const conversationId = String(formData.get('conversation_id') ?? '');
  const body = String(formData.get('body') ?? '').trim();
  if (!body) return undefined;

  const { error } = await supabase.from('messages').insert({
    conversation_id: conversationId,
    sender_id: user.id,
    body_ar: body,
  });

  if (error) {
    const message = error.message ?? '';
    if (message.includes('links and images')) {
      return { error: t('لا يمكن إرسال روابط أو صور داخل محادثات TechMood. شارك عملك كتسليم بدلاً من ذلك.', 'Links and images cannot be sent in TechMood conversations. Share your work as a submission instead.') };
    }
    if (message.includes('read-only')) {
      return { error: t('هذه المحادثة للقراءة فقط.', 'This conversation is read-only.') };
    }
    return { error: t('تعذّر إرسال الرسالة.', 'The message could not be sent.') };
  }

  await markRead(conversationId);
  revalidatePath('/messages');
  return undefined;
}

/** One reaction per person per message — pressing the same one again removes it. */
export async function toggleReaction(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const messageId = String(formData.get('message_id') ?? '');
  const reaction = String(formData.get('reaction') ?? '') as MessageReaction;
  const existing = String(formData.get('existing') ?? '');

  if (existing === reaction) {
    await supabase.from('message_reactions').delete().eq('message_id', messageId).eq('profile_id', user.id);
  } else {
    await supabase
      .from('message_reactions')
      .upsert({ message_id: messageId, profile_id: user.id, reaction }, { onConflict: 'message_id,profile_id' });
  }

  revalidatePath('/messages');
}

export async function markRead(conversationId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  await supabase
    .from('conversation_participants')
    .update({ last_read_at: new Date().toISOString() })
    .eq('conversation_id', conversationId)
    .eq('profile_id', user.id);
}
