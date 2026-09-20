'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';

import { createClient } from '@/lib/supabase/server';
import type { TeamJoinPolicy, TeamKind, TeamStatus, TeamVisibility } from '@/lib/database.types';

export type SettingsState = { error?: string; ok?: string } | undefined;

export async function saveTeamSettings(_prev: SettingsState, formData: FormData): Promise<SettingsState> {
  const supabase = await createClient();
  const teamId = String(formData.get('team_id') ?? '');

  const title = String(formData.get('title') ?? '').trim();
  if (title.length < 3) return { error: 'اسم الفريق قصير جداً.' };

  const { error } = await supabase
    .from('teams')
    .update({
      title_ar: title,
      description_ar: String(formData.get('description') ?? '').trim() || null,
      focus_ar: String(formData.get('focus') ?? '').trim() || null,
      kind: String(formData.get('kind') ?? 'project') as TeamKind,
      status: String(formData.get('status') ?? 'active') as TeamStatus,
      visibility: String(formData.get('visibility') ?? 'private') as TeamVisibility,
      join_policy: String(formData.get('join_policy') ?? 'invite_only') as TeamJoinPolicy,
      public_summary_ar: String(formData.get('public_summary') ?? '').trim() || null,
      needs: String(formData.get('needs') ?? '')
        .split(',').map((need) => need.trim()).filter(Boolean),
    })
    .eq('id', teamId);

  if (error) return { error: 'تعذّر حفظ الإعدادات — قائد الفريق فقط يستطيع تعديلها.' };

  revalidatePath(`/teams/${teamId}/settings`);
  revalidatePath(`/teams/${teamId}`);
  return { ok: 'حُفظت الإعدادات.' };
}

/** Permissions are per-team, so a leader delegates without inventing roles. */
export async function savePermissions(formData: FormData) {
  const supabase = await createClient();
  const teamId = String(formData.get('team_id') ?? '');

  await supabase.from('team_permissions').upsert(
    {
      team_id: teamId,
      members_create_tasks: formData.get('members_create_tasks') === 'on',
      members_assign_tasks: formData.get('members_assign_tasks') === 'on',
      members_invite: formData.get('members_invite') === 'on',
      members_manage_docs: formData.get('members_manage_docs') === 'on',
      members_book_mentor: formData.get('members_book_mentor') === 'on',
      members_edit_project: formData.get('members_edit_project') === 'on',
    },
    { onConflict: 'team_id' },
  );

  revalidatePath(`/teams/${teamId}/settings`);
}

export async function updateMember(formData: FormData) {
  const supabase = await createClient();
  const teamId = String(formData.get('team_id') ?? '');

  await supabase
    .from('team_members')
    .update({ responsibility_ar: String(formData.get('responsibility') ?? '').trim() || null })
    .eq('team_id', teamId)
    .eq('profile_id', String(formData.get('profile_id') ?? ''));

  revalidatePath(`/teams/${teamId}/settings`);
  revalidatePath(`/teams/${teamId}/members`);
}

export async function removeMember(formData: FormData) {
  const supabase = await createClient();
  const teamId = String(formData.get('team_id') ?? '');

  await supabase
    .from('team_members')
    .delete()
    .eq('team_id', teamId)
    .eq('profile_id', String(formData.get('profile_id') ?? ''));

  revalidatePath(`/teams/${teamId}/settings`);
  revalidatePath(`/teams/${teamId}/members`);
}

/** One call, so a team is never left with two leaders or none. */
export async function transferLeadership(_prev: SettingsState, formData: FormData): Promise<SettingsState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const teamId = String(formData.get('team_id') ?? '');
  const to = String(formData.get('profile_id') ?? '');

  if (String(formData.get('confirm') ?? '') !== 'نعم') {
    return { error: 'اكتب «نعم» للتأكيد — نقل القيادة لا يمكن التراجع عنه إلا من القائد الجديد.' };
  }

  const { error } = await supabase.rpc('transfer_team_leadership', { p_team: teamId, p_to: to });

  if (error) {
    const message = error.message ?? '';
    if (message.includes('already be a member')) return { error: 'القائد الجديد يجب أن يكون عضواً في الفريق.' };
    if (message.includes('current leader')) return { error: 'قائد الفريق الحالي فقط يستطيع نقل القيادة.' };
    return { error: 'تعذّر نقل القيادة.' };
  }

  revalidatePath(`/teams/${teamId}/settings`);
  revalidatePath(`/teams/${teamId}`);
  return { ok: 'نُقلت قيادة الفريق.' };
}
