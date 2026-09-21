'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';

import { createClient } from '@/lib/supabase/server';
import { getT } from '@/lib/i18n.server';

export type DocumentState = { error?: string; ok?: string } | undefined;

export async function saveDocument(_prev: DocumentState, formData: FormData): Promise<DocumentState> {
  const t = await getT();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const teamId = String(formData.get('team_id') ?? '');
  const title = String(formData.get('title') ?? '').trim();
  const body = String(formData.get('body') ?? '').trim();
  const url = String(formData.get('url') ?? '').trim();

  if (title.length < 3) return { error: t('اكتب عنواناً للمستند.', 'Give the document a title.') };
  if (!body && !url) return { error: t('المستند يحتاج نصاً أو رابطاً على الأقل.', 'A document needs either text or a link.') };
  if (url && !/^https?:\/\//i.test(url)) return { error: t('الرابط يجب أن يبدأ بـ http أو https.', 'The link must start with http or https.') };

  const { error } = await supabase.from('team_documents').insert({
    team_id: teamId,
    kind: String(formData.get('kind') ?? 'meeting_notes'),
    title_ar: title,
    body_ar: body || null,
    url: url || null,
    project_id: String(formData.get('project_id') ?? '') || null,
    author_id: user.id,
  });

  if (error) return { error: t('تعذّر حفظ المستند — تأكد من صلاحياتك في الفريق.', 'The document could not be saved — check your permissions in this team.') };

  revalidatePath(`/teams/${teamId}/documents`);
  return { ok: t('حُفظ المستند.', 'Document saved.') };
}

export async function removeDocument(formData: FormData) {
  const supabase = await createClient();
  const teamId = String(formData.get('team_id') ?? '');

  await supabase.from('team_documents').delete().eq('id', String(formData.get('document_id') ?? ''));
  revalidatePath(`/teams/${teamId}/documents`);
}
