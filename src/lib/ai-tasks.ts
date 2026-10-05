import type { SupabaseClient } from '@supabase/supabase-js';

import { SUPABASE_PUBLIC_KEY, SUPABASE_URL } from './supabase/config';

/**
 * The model's two jobs beside the assistant (0139, 0140), both through the
 * ai-gemini Edge Function as the member: the database claims the call first,
 * the function writes the result with the service role, and the page reads it
 * back. Nothing here sees the Gemini key or the quiz answers.
 */
async function callAiTask(supabase: SupabaseClient, body: Record<string, unknown>): Promise<{ ok: boolean; error?: string }> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return { ok: false, error: 'not authenticated' };
  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/ai-gemini`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, apikey: SUPABASE_PUBLIC_KEY },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(90_000),
      cache: 'no-store',
    });
    const out = (await response.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
    return { ok: Boolean(out?.ok), error: out?.error };
  } catch {
    return { ok: false, error: 'unreachable' };
  }
}

/** Writes a lesson's quiz now, for a learner who is waiting for it. */
export function writeLessonQuiz(supabase: SupabaseClient, lessonId: string) {
  return callAiTask(supabase, { task: 'quiz', lesson: lessonId });
}

/** The first look at a submission's newest version. */
export function precheckSubmission(supabase: SupabaseClient, submissionId: string) {
  return callAiTask(supabase, { task: 'precheck', submission: submissionId });
}
