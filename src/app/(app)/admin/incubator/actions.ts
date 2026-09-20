'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';

export async function reviewApplication(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  await supabase.rpc('review_incubator_application', {
    p_application: String(formData.get('application_id') ?? ''),
    p_approve: formData.get('decision') === 'approve',
    p_note: String(formData.get('note') ?? '').slice(0, 500) || null,
  });

  revalidatePath('/admin/incubator');
  revalidatePath('/admin');
  revalidatePath('/incubator');
}
