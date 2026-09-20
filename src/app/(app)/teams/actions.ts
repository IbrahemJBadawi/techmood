'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';

import { createClient } from '@/lib/supabase/server';
import type { TaskColumn, TeamKind } from '@/lib/database.types';

export type TeamState = { error?: string; ok?: string } | undefined;

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

export async function createTeam(_prev: TeamState, formData: FormData): Promise<TeamState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const title = String(formData.get('title') ?? '').trim();
  if (title.length < 3) return { error: 'اكتب اسماً واضحاً للفريق.' };

  const slug = `${slugify(title)}-${Math.random().toString(36).slice(2, 6)}`;

  const { data, error } = await supabase
    .from('teams')
    .insert({
      slug,
      title_ar: title,
      description_ar: String(formData.get('description') ?? '').trim() || null,
      focus_ar: String(formData.get('focus') ?? '').trim() || null,
      kind: (String(formData.get('kind') ?? 'project') as TeamKind),
      leader_id: user.id,
      join_policy: formData.get('join_policy') === 'request_allowed' ? 'request_allowed' : 'invite_only',
      visibility: formData.get('visibility') === 'listed' ? 'listed' : 'private',
    })
    .select('id')
    .single();

  if (error || !data) return { error: 'تعذّر إنشاء الفريق — ربما الاسم مستخدم.' };

  // The creator is the leader, and the leader is a member.
  await supabase.from('team_members').insert({
    team_id: data.id,
    profile_id: user.id,
    role: 'leader',
  });

  revalidatePath('/teams');
  redirect(`/teams/${data.id}`);
}

export async function createTask(_prev: TeamState, formData: FormData): Promise<TeamState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const teamId = String(formData.get('team_id') ?? '');
  const title = String(formData.get('title') ?? '').trim();
  if (title.length < 3) return { error: 'اكتب عنواناً واضحاً للمهمة.' };

  const { error } = await supabase.from('team_tasks').insert({
    team_id: teamId,
    title_ar: title,
    description_ar: String(formData.get('description') ?? '').trim() || null,
    assignee_id: String(formData.get('assignee_id') ?? '') || null,
    due_on: String(formData.get('due_on') ?? '') || null,
    priority: (String(formData.get('priority') ?? 'normal') as 'low' | 'normal' | 'high' | 'urgent'),
    sprint_id: String(formData.get('sprint_id') ?? '') || null,
    created_by: user.id,
  });

  if (error) return { error: 'تعذّر إضافة المهمة — تأكد من صلاحياتك في الفريق.' };

  revalidatePath(`/teams/${teamId}/tasks`);
  revalidatePath(`/teams/${teamId}`);
  return { ok: 'تمت إضافة المهمة.' };
}

/** Moving a card. A move into `blocked` must carry a reason, enforced in the database. */
export async function moveTask(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const taskId = String(formData.get('task_id') ?? '');
  const teamId = String(formData.get('team_id') ?? '');
  const column = String(formData.get('column_key') ?? 'todo') as TaskColumn;
  const reason = String(formData.get('blocked_reason') ?? '').trim();

  await supabase
    .from('team_tasks')
    .update({
      column_key: column,
      blocked_reason_ar: column === 'blocked' ? reason || 'بلا سبب محدد' : null,
    })
    .eq('id', taskId);

  revalidatePath(`/teams/${teamId}/tasks`);
  revalidatePath(`/teams/${teamId}/tasks/${taskId}`);
  revalidatePath(`/teams/${teamId}`);
}

export async function toggleChecklistItem(formData: FormData) {
  const supabase = await createClient();
  const itemId = String(formData.get('item_id') ?? '');
  const done = formData.get('is_done') === 'true';

  await supabase.from('task_checklist_items').update({ is_done: !done }).eq('id', itemId);
  revalidatePath(String(formData.get('revalidate') ?? '/teams'));
}

export async function addChecklistItem(formData: FormData) {
  const supabase = await createClient();
  const label = String(formData.get('label') ?? '').trim();
  if (!label) return;

  await supabase.from('task_checklist_items').insert({
    task_id: String(formData.get('task_id') ?? ''),
    label_ar: label,
  });
  revalidatePath(String(formData.get('revalidate') ?? '/teams'));
}

export async function addTaskComment(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const body = String(formData.get('body') ?? '').trim();
  if (!body) return;

  await supabase.from('task_comments').insert({
    task_id: String(formData.get('task_id') ?? ''),
    author_id: user.id,
    body_ar: body,
  });
  revalidatePath(String(formData.get('revalidate') ?? '/teams'));
}

export async function createSprint(_prev: TeamState, formData: FormData): Promise<TeamState> {
  const supabase = await createClient();
  const teamId = String(formData.get('team_id') ?? '');

  const { data: last } = await supabase
    .from('sprints')
    .select('number')
    .eq('team_id', teamId)
    .order('number', { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await supabase.from('sprints').insert({
    team_id: teamId,
    number: (last?.number ?? 0) + 1,
    goal_ar: String(formData.get('goal') ?? '').trim() || null,
    starts_on: String(formData.get('starts_on') ?? ''),
    ends_on: String(formData.get('ends_on') ?? ''),
    status: 'active',
  });

  if (error) return { error: 'تعذّر إنشاء السبرنت — قائد الفريق فقط يستطيع ذلك.' };

  revalidatePath(`/teams/${teamId}/sprints`);
  return { ok: 'تم بدء السبرنت.' };
}

export async function inviteMember(_prev: TeamState, formData: FormData): Promise<TeamState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const teamId = String(formData.get('team_id') ?? '');
  const techmoodId = String(formData.get('techmood_id') ?? '').trim().toUpperCase();

  const { data: invitee } = await supabase
    .from('profiles')
    .select('id')
    .eq('techmood_id', techmoodId)
    .maybeSingle();

  if (!invitee) return { error: 'لا يوجد حساب بهذا الـ TechMood ID.' };

  const { error } = await supabase.from('team_invites').insert({
    team_id: teamId,
    invitee_id: invitee.id,
    responsibility_ar: String(formData.get('responsibility') ?? '').trim() || null,
    invited_by: user.id,
  });

  if (error) return { error: 'تعذّر إرسال الدعوة — ربما توجد دعوة مفتوحة بالفعل.' };

  revalidatePath(`/teams/${teamId}/members`);
  return { ok: 'أُرسلت الدعوة.' };
}
