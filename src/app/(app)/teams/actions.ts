'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';

import { createClient } from '@/lib/supabase/server';
import { dbError } from '@/lib/db-errors';
import { getT } from '@/lib/i18n.server';
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
  const t = await getT();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const title = String(formData.get('title') ?? '').trim();
  if (title.length < 3) return { error: t('اكتب اسماً واضحاً للفريق.', 'Give the team a clear name.') };

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

  if (error || !data) return { error: t('تعذّر إنشاء الفريق — ربما الاسم مستخدم.', 'The team could not be created — the name may be taken.') };

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
  const t = await getT();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const teamId = String(formData.get('team_id') ?? '');
  const title = String(formData.get('title') ?? '').trim();
  if (title.length < 3) return { error: t('اكتب عنواناً واضحاً للمهمة.', 'Give the task a clear title.') };

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

  if (error) return { error: t('تعذّر إضافة المهمة — تأكد من صلاحياتك في الفريق.', 'The task could not be added — check your permissions in this team.') };

  revalidatePath(`/teams/${teamId}/tasks`);
  revalidatePath(`/teams/${teamId}`);
  return { ok: t('تمت إضافة المهمة.', 'Task added.') };
}

/** Moving a card. A move into `blocked` must carry a reason, enforced in the database. */
export async function moveTask(formData: FormData) {
  const t = await getT();
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
      blocked_reason_ar: column === 'blocked' ? reason || t('بلا سبب محدد', 'no reason given') : null,
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
  const t = await getT();
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

  if (error) return { error: t('تعذّر إنشاء السبرنت — قائد الفريق فقط يستطيع ذلك.', 'The sprint could not be created — only the team lead can do that.') };

  revalidatePath(`/teams/${teamId}/sprints`);
  return { ok: t('تم بدء السبرنت.', 'Sprint started.') };
}

export async function inviteMember(_prev: TeamState, formData: FormData): Promise<TeamState> {
  const t = await getT();
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

  if (!invitee) return { error: t('لا يوجد حساب بهذا الـ TechMood ID.', 'No account with that TechMood ID.') };

  const { error } = await supabase.from('team_invites').insert({
    team_id: teamId,
    invitee_id: invitee.id,
    responsibility_ar: String(formData.get('responsibility') ?? '').trim() || null,
    invited_by: user.id,
  });

  if (error) return { error: t('تعذّر إرسال الدعوة — ربما توجد دعوة مفتوحة بالفعل.', 'The invitation could not be sent — there may already be one open.') };

  revalidatePath(`/teams/${teamId}/members`);
  return { ok: t('أُرسلت الدعوة.', 'Invitation sent.') };
}

/**
 * A team's own hour.
 *
 * It costs nothing and books no mentor, which is exactly why it is limited:
 * the database allows a team two of these a week — counted for the team, not
 * per member, so nobody gets around it by taking turns.
 */
export async function scheduleTeamMeeting(_prev: TeamState, formData: FormData): Promise<TeamState> {
  const t = await getT();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const teamId = String(formData.get('team_id') ?? '');
  const date = String(formData.get('date') ?? '');
  const time = String(formData.get('time') ?? '');
  const minutes = Number(formData.get('minutes') ?? 60);

  if (!date || !time) return { error: t('اختر اليوم والساعة.', 'Pick the day and the hour.') };

  const start = new Date(`${date}T${time}`);
  if (Number.isNaN(start.getTime())) return { error: t('الموعد غير صالح.', 'That is not a valid time.') };

  const end = new Date(start.getTime() + Math.min(180, Math.max(15, minutes)) * 60000);

  const { error } = await supabase.rpc('schedule_internal_session', {
    p_team: teamId,
    p_start: start.toISOString(),
    p_end: end.toISOString(),
  });

  revalidatePath(`/teams/${teamId}/calendar`);
  if (error) return { error: dbError(t, error.message) };

  return { ok: t('حُجز اجتماع الفريق، وسيصل الجميع إشعار به.', 'The meeting is booked, and everybody in the team has been told.') };
}
