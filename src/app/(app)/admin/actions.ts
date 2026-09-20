'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';

/**
 * Approve or reject a role application. The RLS policy on profile_roles already
 * restricts the update to admins; this is the UI entry point, not the guard.
 */
export async function reviewRole(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const roleId = String(formData.get('role_id') ?? '');
  const approve = formData.get('decision') === 'approve';

  await supabase
    .from('profile_roles')
    .update({
      status: approve ? 'approved' : 'rejected',
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
      review_note: String(formData.get('note') ?? '').slice(0, 500) || null,
    })
    .eq('id', roleId);

  revalidatePath('/admin');
}
