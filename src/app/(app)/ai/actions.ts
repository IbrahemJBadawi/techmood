'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';

import { createClient } from '@/lib/supabase/server';
import { getT } from '@/lib/i18n.server';
import { dbError } from '@/lib/db-errors';
import { askClaude, aiConfigured } from '@/lib/ai-claude';
import type {
  AiActionKind, AiActionStatus, AiMemoryKind, AiRole, AiScope, AiSurface,
} from '@/lib/database.types';

export type PanelMessage = {
  id: string;
  role: AiRole;
  content: string;
  errorAr: string | null;
  createdAt: string;
};

export type PanelAction = {
  id: string;
  kind: string;
  titleAr: string;
  summaryAr: string;
  status: AiActionStatus;
  errorAr: string | null;
};

export type PanelState = {
  threadId: string | null;
  threadTitle: string | null;
  messages: PanelMessage[];
  actions: PanelAction[];
  suggestions: { label: string; prompt: string }[];
  /** Whether a model can actually be reached from this deployment. */
  live: boolean;
  error?: string;
};

export type PanelWhere = {
  surface: AiSurface;
  scope: AiScope;
  entityType?: string | null;
  entityId?: string | null;
  label?: string | null;
};

async function readThread(
  supabase: Awaited<ReturnType<typeof createClient>>,
  threadId: string | null,
  surface: AiSurface,
): Promise<Omit<PanelState, 'live' | 'error'>> {
  const [messages, actions, suggestions, thread] = await Promise.all([
    threadId
      ? supabase.rpc('ai_thread_messages', { p_thread: threadId })
      : Promise.resolve({ data: [] as never[] }),
    threadId
      ? supabase.rpc('ai_thread_actions', { p_thread: threadId })
      : Promise.resolve({ data: [] as never[] }),
    supabase.rpc('ai_suggestions_for', { p_surface: surface }),
    threadId
      ? supabase.from('ai_threads').select('title_ar').eq('id', threadId).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  return {
    threadId,
    threadTitle: thread.data?.title_ar ?? null,
    messages: (messages.data ?? []).map((row) => ({
      id: row.id, role: row.role, content: row.content,
      errorAr: row.error_ar, createdAt: row.created_at,
    })),
    actions: (actions.data ?? []).map((row) => ({
      id: row.id, kind: row.kind, titleAr: row.title_ar,
      summaryAr: row.summary_ar, status: row.status, errorAr: row.error_ar,
    })),
    suggestions: (suggestions.data ?? []).map((row) => ({
      label: row.label_ar, prompt: row.prompt_ar,
    })),
  };
}

/** Opening the panel: what this surface offers, and the thread if there is one. */
export async function openPanel(where: PanelWhere, threadId: string | null): Promise<PanelState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  return { ...(await readThread(supabase, threadId, where.surface)), live: aiConfigured() };
}

/**
 * Asking.
 *
 * The order matters: the question is written down before the model is called,
 * so a failed call leaves a thread that still makes sense. The context is read
 * through `ai_context()`, which runs as the caller — this server action never
 * assembles the context itself, and so cannot widen it by mistake.
 */
export async function ask(where: PanelWhere, prompt: string, threadId: string | null): Promise<PanelState> {
  const t = await getT();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const question = prompt.trim();
  if (!question) {
    return { ...(await readThread(supabase, threadId, where.surface)), live: aiConfigured(),
             error: t('اكتب سؤالك أولاً.', 'Write your question first.') };
  }

  let thread = threadId;

  if (!thread) {
    const { data, error } = await supabase.rpc('start_ai_thread', {
      p_title: question.slice(0, 60),
      p_surface: where.surface,
      p_scope: where.scope,
      p_entity_type: where.entityType ?? null,
      p_entity_id: where.entityId ?? null,
    });
    if (error || !data) {
      return { ...(await readThread(supabase, null, where.surface)), live: aiConfigured(),
               error: dbError(t, error?.message ?? '') };
    }
    thread = data;
  }

  const { error: sayError } = await supabase.rpc('ai_say', {
    p_thread: thread, p_role: 'user', p_content: question,
    p_surface: where.surface, p_scope: where.scope,
  });
  if (sayError) {
    return { ...(await readThread(supabase, thread, where.surface)), live: aiConfigured(),
             error: dbError(t, sayError.message) };
  }

  const [{ data: context }, { data: kinds }, { data: history }] = await Promise.all([
    supabase.rpc('ai_context', {
      p_surface: where.surface,
      p_scope: where.scope,
      p_entity_type: where.entityType ?? null,
      p_entity_id: where.entityId ?? null,
    }),
    supabase.from('ai_action_kinds').select('*').eq('is_enabled', true).order('sort_order'),
    supabase.rpc('ai_thread_messages', { p_thread: thread }),
  ]);

  // The turn just written is the prompt, not part of the history.
  const earlier = (history ?? [])
    .filter((row) => row.role !== 'system' && !row.error_ar)
    .slice(0, -1)
    .slice(-12)
    .map((row) => ({ role: row.role as 'user' | 'assistant', content: row.content }));

  const answer = await askClaude({
    context,
    history: earlier,
    prompt: question,
    kinds: (kinds ?? []) as AiActionKind[],
  });

  await supabase.rpc('ai_say', {
    p_thread: thread,
    p_role: 'assistant',
    p_content: answer.error_ar ?? answer.text,
    p_surface: where.surface,
    p_scope: where.scope,
    p_model: answer.model,
    p_error: answer.error_ar,
  });

  // A proposal that the database refuses — a restricted kind the model reached
  // for anyway — is dropped here rather than shown as a button that cannot work.
  for (const proposal of answer.proposals) {
    await supabase.rpc('propose_ai_action', {
      p_thread: thread,
      p_kind: proposal.kind,
      p_summary: proposal.summary_ar,
      p_params: proposal.params,
    });
  }

  return { ...(await readThread(supabase, thread, where.surface)), live: aiConfigured() };
}

/** The button. Everything the assistant changes goes through this one door. */
export async function confirmAction(actionId: string): Promise<{ ok: boolean; error?: string }> {
  const t = await getT();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data, error } = await supabase.rpc('confirm_ai_action', { p_action: actionId });

  if (error) return { ok: false, error: dbError(t, error.message) };

  const result = (data ?? {}) as { ok?: boolean; error_ar?: string };
  revalidatePath('/', 'layout');

  if (!result.ok) return { ok: false, error: dbError(t, result.error_ar ?? '') };
  return { ok: true };
}

export async function declineAction(actionId: string): Promise<{ ok: boolean; error?: string }> {
  const t = await getT();
  const supabase = await createClient();
  const { error } = await supabase.rpc('decline_ai_action', { p_action: actionId });
  if (error) return { ok: false, error: dbError(t, error.message) };
  return { ok: true };
}

export async function newThread(where: PanelWhere, title: string): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase.rpc('start_ai_thread', {
    p_title: title,
    p_surface: where.surface,
    p_scope: where.scope,
    p_entity_type: where.entityType ?? null,
    p_entity_id: where.entityId ?? null,
  });
  return data ?? null;
}

export async function rememberSomething(content: string, kind: AiMemoryKind): Promise<{ ok: boolean; error?: string }> {
  const t = await getT();
  const supabase = await createClient();
  const { error } = await supabase.rpc('ai_remember', { p_content: content, p_kind: kind });
  revalidatePath('/settings/ai');
  if (error) return { ok: false, error: dbError(t, error.message) };
  return { ok: true };
}
