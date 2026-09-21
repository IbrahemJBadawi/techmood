'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';

import { createClient } from '@/lib/supabase/server';

/**
 * Checking a claim somebody made about something that happened elsewhere.
 * The refusal, if the caller is not an admin, comes from the database.
 */
export async function reviewClaim(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  await supabase.rpc('review_external_exhibition', {
    p_entry: String(formData.get('entry_id') ?? ''),
    p_approve: formData.get('decision') === 'approve',
    p_note: String(formData.get('note') ?? '').slice(0, 400) || null,
  });

  revalidatePath('/admin/external');
  revalidatePath('/admin');
}
