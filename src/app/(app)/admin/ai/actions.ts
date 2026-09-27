'use server';

import { createClient } from '@/lib/supabase/server';
import { dbError } from '@/lib/db-errors';
import { getT } from '@/lib/i18n.server';

export type ReadState = { error?: string; lines?: { role: string; content: string }[] } | undefined;

/** admin_read_ai_thread() checks the case and the reason, and records the access (0087). */
export async function readThread(_prev: ReadState, formData: FormData): Promise<ReadState> {
  const t = await getT();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('admin_read_ai_thread', {
    p_thread: String(formData.get('thread_id') ?? ''),
    p_case: String(formData.get('case_id') ?? ''),
    p_reason: String(formData.get('reason') ?? '').trim(),
  });
  if (error) return { error: dbError(t, error.message) };
  return { lines: (data ?? []).map((row) => ({ role: row.role, content: row.content })) };
}
