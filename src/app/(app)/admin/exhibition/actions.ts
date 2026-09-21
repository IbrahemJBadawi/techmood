'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';

/**
 * Sending an entry back for revision.
 *
 * Approving is not here any more: it needs the six criteria, so it happens on
 * the rubric page an admin shares with the mentors. One judgement, one form.
 */
export async function reviewEntry(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  await supabase.rpc('review_exhibition_entry', {
    p_entry: String(formData.get('entry_id') ?? ''),
    p_approve: false,
    p_note: String(formData.get('note') ?? '').slice(0, 500) || null,
  });

  revalidatePath('/admin/exhibition');
  revalidatePath('/admin');
  revalidatePath('/exhibition');
}
