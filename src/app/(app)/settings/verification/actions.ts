'use server';

import { revalidatePath } from 'next/cache';

import { createClient } from '@/lib/supabase/server';

/** Sends the uploaded document for an admin to check (0161). */
export async function requestVerification(legalName: string, documentPath: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc('request_identity_verification', {
    p_legal_name: legalName,
    p_document_path: documentPath,
  });
  if (error) {
    // the upload stays private either way; a failed request should not leave it behind
    await supabase.storage.from('identity-docs').remove([documentPath]);
    return { ok: false, error: error.message };
  }
  revalidatePath('/settings/verification');
  return { ok: true };
}
