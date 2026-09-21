'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';

import { createClient } from '@/lib/supabase/server';
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
  });

  if (error) {
    const message = error.message ?? '';
    if (message.includes('completed project')) return { error: t('أكمل المشروع أولاً ثم قدّمه للمعرض.', 'Finish the project first, then submit it.') };
    if (message.includes('owner or the team leader')) return { error: t('صاحب المشروع أو قائد الفريق فقط يستطيع تقديمه.', 'Only the project owner or the team lead can submit it.') };
    if (message.includes('summary')) return { error: t('اكتب ملخصاً للعمل.', 'Write a summary of the work.') };
    return { error: t('تعذّر التقديم للمعرض.', 'The submission could not be sent.') };
  }

  revalidatePath(`/teams/${teamId}/projects`);
  return { ok: t('قُدّم المشروع للمعرض، وينتظر مراجعة TechMood.', 'Submitted to the exhibition; it is now waiting on a TechMood review.') };
}
