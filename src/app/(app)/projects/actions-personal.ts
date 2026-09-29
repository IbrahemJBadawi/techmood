'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';

import { createClient } from '@/lib/supabase/server';
import { dbError } from '@/lib/db-errors';
import { getT } from '@/lib/i18n.server';

export type NewProjectState = { error?: string } | undefined;

/**
 * A personal project, open to every member whatever their role: the owner is
 * the person signed in (projects_write lets only them write it), there is no
 * team, and it starts in «planning». From the project's page its owner marks
 * it complete, then sends it to the exhibition (submit_to_exhibition) or puts
 * it up for sale (list_project_for_sale) — both reviewed by TechMood before
 * they show.
 */
export async function createPersonalProject(_prev: NewProjectState, formData: FormData): Promise<NewProjectState> {
  const t = await getT();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/projects/new');

  const title = String(formData.get('title') ?? '').trim();
  if (title.length < 3) return { error: t('اكتب اسماً واضحاً للمشروع.', 'Give the project a clear name.') };

  const { data, error } = await supabase
    .from('projects')
    .insert({
      title_ar: title.slice(0, 160),
      description_ar: String(formData.get('description') ?? '').trim().slice(0, 4000) || null,
      owner_id: user.id,
      kind: 'personal',
      tags: String(formData.get('tags') ?? '')
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean)
        .slice(0, 12),
    })
    .select('id')
    .single();

  if (error || !data) return { error: dbError(t, error?.message ?? '') || t('تعذّر إنشاء المشروع.', 'The project could not be created.') };

  revalidatePath('/projects');
  redirect(`/projects/${data.id}`);
}

export type ExhibitState = { error?: string; ok?: string } | undefined;

/**
 * Sends a finished project to the exhibition from its own page. The rules are
 * submit_to_exhibition's: the owner (or its team's lead), a completed project,
 * a summary. A mentor then reviews it before anything shows.
 */
export async function submitProjectToExhibition(_prev: ExhibitState, formData: FormData): Promise<ExhibitState> {
  const t = await getT();
  const supabase = await createClient();
  const projectId = String(formData.get('project_id') ?? '');
  const lines = (name: string, by: string) => String(formData.get(name) ?? '').split(by).map((v) => v.trim()).filter(Boolean);

  const { error } = await supabase.rpc('submit_to_exhibition', {
    p_project: projectId,
    p_summary: String(formData.get('summary') ?? '').trim(),
    p_technologies: lines('technologies', ','),
    p_demo_url: String(formData.get('demo_url') ?? '').trim() || null,
    p_documentation: String(formData.get('documentation') ?? '').trim() || null,
    p_problem: String(formData.get('problem') ?? '').trim() || null,
    p_solution: String(formData.get('solution') ?? '').trim() || null,
    p_outcomes: lines('outcomes', '\n'),
    p_cover_url: String(formData.get('cover_url') ?? '').trim() || null,
  });
  if (error) return { error: dbError(t, error.message) };

  revalidatePath(`/projects/${projectId}`);
  revalidatePath('/projects');
  return { ok: t('قُدّم المشروع للمعرض، وينتظر مراجعة منتور.', 'Submitted to the exhibition; it is waiting on a mentor’s review.') };
}

/** After a mentor approves it, putting it on the wall (or taking it down) is the owner's call. */
export async function setProjectExhibited(_prev: ExhibitState, formData: FormData): Promise<ExhibitState> {
  const t = await getT();
  const supabase = await createClient();
  const show = String(formData.get('public') ?? 'true') === 'true';
  const { error } = await supabase.rpc('publish_exhibition_entry', {
    p_entry: String(formData.get('entry_id') ?? ''),
    p_public: show,
  });
  if (error) return { error: dbError(t, error.message) };

  revalidatePath(`/projects/${String(formData.get('project_id') ?? '')}`);
  revalidatePath('/exhibition');
  return { ok: show ? t('صار المشروع معروضاً في المعرض.', 'The project is on the wall.') : t('سُحب المشروع من المعرض.', 'The project is off the wall.') };
}
