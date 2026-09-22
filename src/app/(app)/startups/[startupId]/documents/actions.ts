'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';

import { createClient } from '@/lib/supabase/server';
import { getT } from '@/lib/i18n.server';
import type { CompanyDocumentKind } from '@/lib/database.types';

export type DocumentState = { error?: string; ok?: string } | undefined;

/**
 * A paper the company keeps. A new version of the same title does not overwrite
 * the old one: it is another row with a higher number, so "which version did
 * they send the investor?" has an answer.
 */
export async function addDocument(_prev: DocumentState, formData: FormData): Promise<DocumentState> {
  const t = await getT();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const startupId = String(formData.get('startup_id') ?? '');
  const title = String(formData.get('title') ?? '').trim();
  const url = String(formData.get('url') ?? '').trim();

  if (title.length < 3) return { error: t('اكتب عنوان المستند.', 'Give the document a title.') };
  if (!/^https?:\/\//.test(url)) {
    return { error: t('الرابط يجب أن يبدأ بـ http أو https.', 'The link has to start with http or https.') };
  }

  const { data: previous } = await supabase
    .from('startup_documents')
    .select('version')
    .eq('startup_id', startupId)
    .eq('title_ar', title)
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await supabase.from('startup_documents').insert({
    startup_id: startupId,
    kind: String(formData.get('kind') ?? 'other') as CompanyDocumentKind,
    title_ar: title,
    summary_ar: String(formData.get('summary') ?? '').trim() || null,
    url,
    version: (previous?.version ?? 0) + 1,
    uploaded_by: user.id,
  });

  revalidatePath(`/startups/${startupId}/documents`);
  if (error) return { error: t('تعذّر الحفظ — التعديل لأعضاء المساحة.', 'That failed — editing belongs to the workspace’s people.') };

  return { ok: t('حُفظ المستند.', 'The document is saved.') };
}

export async function removeDocument(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const startupId = String(formData.get('startup_id') ?? '');
  await supabase.from('startup_documents').delete().eq('id', String(formData.get('document_id') ?? ''));

  revalidatePath(`/startups/${startupId}/documents`);
}
