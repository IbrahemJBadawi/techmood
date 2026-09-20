'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';

import { createClient } from '@/lib/supabase/server';

export type DocumentState = { error?: string; ok?: string } | undefined;

export async function saveDocument(_prev: DocumentState, formData: FormData): Promise<DocumentState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const teamId = String(formData.get('team_id') ?? '');
  const title = String(formData.get('title') ?? '').trim();
  const body = String(formData.get('body') ?? '').trim();
  const url = String(formData.get('url') ?? '').trim();

  if (title.length < 3) return { error: 'اكتب عنواناً للمستند.' };
  if (!body && !url) return { error: 'المستند يحتاج نصاً أو رابطاً على الأقل.' };
  if (url && !/^https?:\/\//i.test(url)) return { error: 'الرابط يجب أن يبدأ بـ http أو https.' };

  const { error } = await supabase.from('team_documents').insert({
    team_id: teamId,
    kind: String(formData.get('kind') ?? 'meeting_notes'),
    title_ar: title,
    body_ar: body || null,
    url: url || null,
    project_id: String(formData.get('project_id') ?? '') || null,
    author_id: user.id,
  });

  if (error) return { error: 'تعذّر حفظ المستند — تأكد من صلاحياتك في الفريق.' };

  revalidatePath(`/teams/${teamId}/documents`);
  return { ok: 'حُفظ المستند.' };
}

export async function removeDocument(formData: FormData) {
  const supabase = await createClient();
  const teamId = String(formData.get('team_id') ?? '');

  await supabase.from('team_documents').delete().eq('id', String(formData.get('document_id') ?? ''));
  revalidatePath(`/teams/${teamId}/documents`);
}
