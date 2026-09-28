'use server';

import { revalidatePath } from 'next/cache';

import { createClient } from '@/lib/supabase/server';

export type ToggleResult = { on: boolean; error?: string };

/** Follow or unfollow a member. The database decides who may, and tells them once (0106). */
export async function toggleFollow(profileId: string, path: string): Promise<ToggleResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('toggle_follow', { p_profile: profileId });
  if (error) return { on: false, error: error.message };
  revalidatePath(path);
  return { on: data === true };
}

/** Like or unlike somebody else's project (0106). */
export async function toggleProjectLike(projectId: string, path: string): Promise<ToggleResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('toggle_project_like', { p_project: projectId });
  if (error) return { on: false, error: error.message };
  revalidatePath(path);
  return { on: data === true };
}
