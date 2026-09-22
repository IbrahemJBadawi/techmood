'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';

import { createClient } from '@/lib/supabase/server';
import { getT } from '@/lib/i18n.server';
import { dbError } from '@/lib/db-errors';
import type { AiMemoryKind } from '@/lib/database.types';

export type AiSettingsState = { error?: string; ok?: string } | undefined;

/**
 * The two switches.
 *
 * Memory off does not hide the list — it stops the list being sent. What the
 * person already told the assistant stays theirs to read and delete.
 */
export async function saveAiPreferences(
  _prev: AiSettingsState,
  formData: FormData,
): Promise<AiSettingsState> {
  const t = await getT();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { error } = await supabase.rpc('set_ai_preferences', {
    p_memory: formData.get('memory') === 'on',
    p_actions: formData.get('actions') === 'on',
  });

  revalidatePath('/settings/ai');
  if (error) return { error: dbError(t, error.message) };
  return { ok: t('حُفظت إعداداتك.', 'Your choices are saved.') };
}

export async function addMemory(
  _prev: AiSettingsState,
  formData: FormData,
): Promise<AiSettingsState> {
  const t = await getT();
  const supabase = await createClient();

  const content = String(formData.get('content') ?? '').trim();
  if (content.length < 2) return { error: t('اكتب ما تريد أن يتذكّره.', 'Write what it should remember.') };

  const { error } = await supabase.rpc('ai_remember', {
    p_content: content,
    p_kind: (formData.get('kind') as AiMemoryKind) ?? 'fact',
  });

  revalidatePath('/settings/ai');
  if (error) return { error: dbError(t, error.message) };
  return { ok: t('أُضيفت.', 'Added.') };
}

export async function editMemory(id: string, content: string): Promise<{ ok: boolean; error?: string }> {
  const t = await getT();
  const supabase = await createClient();
  const { error } = await supabase
    .from('ai_memory')
    .update({ content_ar: content.trim() })
    .eq('id', id);

  revalidatePath('/settings/ai');
  if (error) return { ok: false, error: dbError(t, error.message) };
  return { ok: true };
}

export async function setMemoryActive(id: string, isActive: boolean): Promise<{ ok: boolean; error?: string }> {
  const t = await getT();
  const supabase = await createClient();
  const { error } = await supabase.from('ai_memory').update({ is_active: isActive }).eq('id', id);

  revalidatePath('/settings/ai');
  if (error) return { ok: false, error: dbError(t, error.message) };
  return { ok: true };
}

/** Deleted means deleted: the row is gone, not flagged. */
export async function forgetMemory(id: string): Promise<{ ok: boolean; error?: string }> {
  const t = await getT();
  const supabase = await createClient();
  const { error } = await supabase.from('ai_memory').delete().eq('id', id);

  revalidatePath('/settings/ai');
  if (error) return { ok: false, error: dbError(t, error.message) };
  return { ok: true };
}
