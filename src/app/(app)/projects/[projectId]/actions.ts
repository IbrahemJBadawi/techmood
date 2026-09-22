'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';

import { createClient } from '@/lib/supabase/server';
import { dbError } from '@/lib/db-errors';
import { getT } from '@/lib/i18n.server';
import type { EvidenceKind, ProjectStatus } from '@/lib/database.types';

export type WorkState = { error?: string; ok?: string } | undefined;

/** Where the work stands. Only whoever is doing it may say. */
export async function setProjectStatus(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const projectId = String(formData.get('project_id') ?? '');
  const status = String(formData.get('status') ?? 'in_progress') as ProjectStatus;

  await supabase
    .from('projects')
    .update({ status, completed_at: status === 'completed' ? new Date().toISOString() : null })
    .eq('id', projectId)
    .eq('owner_id', user.id);

  revalidatePath(`/projects/${projectId}`);
}

/** A deliverable: a link to something real, attached to the work. */
export async function addDeliverable(_prev: WorkState, formData: FormData): Promise<WorkState> {
  const t = await getT();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const projectId = String(formData.get('project_id') ?? '');
  const url = String(formData.get('url') ?? '').trim();

  if (!/^https?:\/\//.test(url)) {
    return { error: t('الرابط يجب أن يبدأ بـ http أو https.', 'The link has to start with http or https.') };
  }

  const { error } = await supabase.from('project_evidence').insert({
    project_id: projectId,
    kind: (String(formData.get('kind') ?? 'link') as EvidenceKind),
    url,
    label: String(formData.get('label') ?? '').trim() || null,
  });

  revalidatePath(`/projects/${projectId}`);
  if (error) return { error: dbError(t, error.message) };
  return { ok: t('أُضيف التسليم.', 'The deliverable is attached.') };
}

/** A date the two sides agreed on. */
export async function addMilestone(_prev: WorkState, formData: FormData): Promise<WorkState> {
  const t = await getT();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const projectId = String(formData.get('project_id') ?? '');
  const title = String(formData.get('title') ?? '').trim();
  if (title.length < 3) return { error: t('اكتب عنواناً للمعلم.', 'Give the milestone a title.') };

  const { error } = await supabase.from('project_milestones').insert({
    project_id: projectId,
    title_ar: title,
    due_on: String(formData.get('due_on') ?? '') || null,
  });

  revalidatePath(`/projects/${projectId}`);
  if (error) return { error: dbError(t, error.message) };
  return { ok: t('أُضيف المعلم.', 'The milestone is added.') };
}
