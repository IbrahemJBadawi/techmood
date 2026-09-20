'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';

import { createClient } from '@/lib/supabase/server';
import type { ProjectStatus } from '@/lib/database.types';

export type ProjectState = { error?: string; ok?: string } | undefined;

export async function createProject(_prev: ProjectState, formData: FormData): Promise<ProjectState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const teamId = String(formData.get('team_id') ?? '');
  const title = String(formData.get('title') ?? '').trim();
  if (title.length < 3) return { error: 'اكتب عنواناً واضحاً للمشروع.' };

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

  if (error) return { error: 'تعذّر إنشاء المشروع — تأكد من صلاحياتك في الفريق.' };

  revalidatePath(`/teams/${teamId}/projects`);
  return { ok: 'أُنشئ المشروع.' };
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
    if (message.includes('completed project')) return { error: 'أكمل المشروع أولاً ثم قدّمه للمعرض.' };
    if (message.includes('owner or the team leader')) return { error: 'صاحب المشروع أو قائد الفريق فقط يستطيع تقديمه.' };
    if (message.includes('summary')) return { error: 'اكتب ملخصاً للعمل.' };
    return { error: 'تعذّر التقديم للمعرض.' };
  }

  revalidatePath(`/teams/${teamId}/projects`);
  return { ok: 'قُدّم المشروع للمعرض، وينتظر مراجعة TechMood.' };
}
