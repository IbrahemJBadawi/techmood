'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';

/** Approving publishes the entry and freezes its snapshot. */
export async function reviewEntry(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  await supabase.rpc('review_exhibition_entry', {
    p_entry: String(formData.get('entry_id') ?? ''),
    p_approve: formData.get('decision') === 'approve',
    p_note: String(formData.get('note') ?? '').slice(0, 500) || null,
  });

  revalidatePath('/admin/exhibition');
  revalidatePath('/admin');
  revalidatePath('/exhibition');
}
