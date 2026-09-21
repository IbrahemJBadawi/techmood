'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';

import { createClient } from '@/lib/supabase/server';
import { dbError } from '@/lib/db-errors';
import { getT } from '@/lib/i18n.server';
import type { ProjectStatus } from '@/lib/database.types';

export type ProjectState = { error?: string; ok?: string } | undefined;

export async function createProject(_prev: ProjectState, formData: FormData): Promise<ProjectState> {
  const t = await getT();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const teamId = String(formData.get('team_id') ?? '');
  const title = String(formData.get('title') ?? '').trim();
  if (title.length < 3) return { error: t('اكتب عنواناً واضحاً للمشروع.', 'Give the project a clear title.') };

  const { error } = await supabase.from('projects').insert({
    title_ar: title,
    description_ar: String(formData.get('description') ?? '').trim() || null,
    owner_id: user.id,
    team_id: teamId,
    tags: String(formData.get('tags') ?? '')
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean),
  });

  if (error) return { error: t('تعذّر إنشاء المشروع — تأكد من صلاحياتك في الفريق.', 'The project could not be created — check your permissions in this team.') };

  revalidatePath(`/teams/${teamId}/projects`);
  return { ok: t('أُنشئ المشروع.', 'Project created.') };
}

export async function setProjectStatus(formData: FormData) {
  const supabase = await createClient();
  const teamId = String(formData.get('team_id') ?? '');

  await supabase
    .from('projects')
    .update({ status: String(formData.get('status') ?? 'planning') as ProjectStatus })
    .eq('id', String(formData.get('project_id') ?? ''));

  revalidatePath(`/teams/${teamId}/projects`);
}

/** Publishing the work is what turns it into evidence on every builder's passport. */
export async function submitToExhibition(_prev: ProjectState, formData: FormData): Promise<ProjectState> {
  const t = await getT();
  const supabase = await createClient();
  const teamId = String(formData.get('team_id') ?? '');

  const { error } = await supabase.rpc('submit_to_exhibition', {
    p_project: String(formData.get('project_id') ?? ''),
    p_summary: String(formData.get('summary') ?? '').trim(),
    p_technologies: String(formData.get('technologies') ?? '')
      .split(',')
      .map((tech) => tech.trim())
      .filter(Boolean),
    p_demo_url: String(formData.get('demo_url') ?? '').trim() || null,
    p_documentation: String(formData.get('documentation') ?? '').trim() || null,
    p_problem: String(formData.get('problem') ?? '').trim() || null,
    p_solution: String(formData.get('solution') ?? '').trim() || null,
    p_outcomes: String(formData.get('outcomes') ?? '')
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean),
    p_cover_url: String(formData.get('cover_url') ?? '').trim() || null,
  });

  if (error) return { error: dbError(t, error.message) };

  revalidatePath(`/teams/${teamId}/projects`);
  return { ok: t('قُدّم المشروع للمعرض، وينتظر مراجعة TechMood.', 'Submitted to the exhibition; it is now waiting on a TechMood review.') };
}

/**
 * Exhibiting, and taking it back.
 *
 * Approval is the mentor's judgement; this is the builder's decision. The
 * database refuses to exhibit work no mentor approved, and refuses to let
 * anyone but the owner or the team lead make that call.
 */
export async function setExhibited(_prev: ProjectState, formData: FormData): Promise<ProjectState> {
  const t = await getT();
  const supabase = await createClient();
  const teamId = String(formData.get('team_id') ?? '');
  const show = String(formData.get('public') ?? 'true') === 'true';

  const { error } = await supabase.rpc('publish_exhibition_entry', {
    p_entry: String(formData.get('entry_id') ?? ''),
    p_public: show,
  });

  if (error) return { error: dbError(t, error.message) };

  if (teamId) revalidatePath(`/teams/${teamId}/projects`);
  revalidatePath('/exhibition');
  return {
    ok: show
      ? t('صار المشروع معروضاً في المعرض.', 'The project is on the wall.')
      : t('سُحب المشروع من المعرض.', 'The project is off the wall.'),
  };
}
