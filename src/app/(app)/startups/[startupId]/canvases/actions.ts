'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';

import { createClient } from '@/lib/supabase/server';
import { dbError } from '@/lib/db-errors';
import { getT } from '@/lib/i18n.server';
import type { CanvasKind, CanvasVisibility } from '@/lib/database.types';

export type CanvasState = { error?: string; ok?: string } | undefined;

/** A new wall. Its blocks come from the model it is made of. */
export async function createCanvas(_prev: CanvasState, formData: FormData): Promise<CanvasState> {
  const t = await getT();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const startupId = String(formData.get('startup_id') ?? '');
  const kind = String(formData.get('kind') ?? 'lean') as CanvasKind;
  const blocks = String(formData.get('blocks') ?? '')
    .split(',').map((block) => block.trim()).filter(Boolean);

  const { data, error } = await supabase.rpc('create_canvas', {
    p_startup: startupId,
    p_kind: kind,
    p_title: String(formData.get('title') ?? '').trim() || null,
    p_blocks: kind === 'custom' && blocks.length > 0 ? blocks : null,
  });

  revalidatePath(`/startups/${startupId}/canvases`);
  if (error) return { error: dbError(t, error.message) };

  const canvas = data as { id: string } | null;
  if (canvas?.id) redirect(`/startups/${startupId}/canvases/${canvas.id}`);
  return { ok: t('أُنشئت اللوحة.', 'The canvas is ready.') };
}

/** Freezing the wall as it is, with a note about why. */
export async function snapshotCanvas(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const canvasId = String(formData.get('canvas_id') ?? '');
  await supabase.rpc('snapshot_canvas', {
    p_canvas: canvasId,
    p_note: String(formData.get('note') ?? '').trim() || null,
  });

  revalidatePath(String(formData.get('revalidate') ?? '/startups'));
}

/** Going back. Which is itself recorded, so going back is undoable too. */
export async function restoreVersion(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  await supabase.rpc('restore_canvas_version', {
    p_version: String(formData.get('version_id') ?? ''),
  });

  revalidatePath(String(formData.get('revalidate') ?? '/startups'));
}

/** Who may look at this wall. */
export async function setCanvasVisibility(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const canvasId = String(formData.get('canvas_id') ?? '');
  await supabase
    .from('canvases')
    .update({ visibility: String(formData.get('visibility') ?? 'workspace') as CanvasVisibility })
    .eq('id', canvasId);

  revalidatePath(String(formData.get('revalidate') ?? '/startups'));
}

/** A card becomes a goal with a number and a date. */
export async function cardToGoal(_prev: CanvasState, formData: FormData): Promise<CanvasState> {
  const t = await getT();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { error } = await supabase.rpc('card_to_goal', {
    p_card: String(formData.get('card_id') ?? ''),
    p_metric: String(formData.get('metric') ?? '').trim() || 'عدد',
    p_target: Number(formData.get('target') ?? 1),
    p_due: String(formData.get('due') ?? ''),
    p_title: String(formData.get('title') ?? '').trim() || null,
  });

  revalidatePath(String(formData.get('revalidate') ?? '/startups'));
  if (error) return { error: dbError(t, error.message) };
  return { ok: t('صار هدفاً بتاريخ ورقم.', 'It is a goal now, with a number and a date.') };
}

/** …or a project the company runs. */
export async function cardToProject(_prev: CanvasState, formData: FormData): Promise<CanvasState> {
  const t = await getT();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { error } = await supabase.rpc('card_to_project', {
    p_card: String(formData.get('card_id') ?? ''),
    p_title: String(formData.get('title') ?? '').trim() || null,
  });

  revalidatePath(String(formData.get('revalidate') ?? '/startups'));
  if (error) return { error: dbError(t, error.message) };
  return { ok: t('صار مشروعاً في مساحة العمل.', 'It is a project in the workspace now.') };
}
