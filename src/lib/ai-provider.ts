import type { AiActionKind } from '@/lib/database.types';
import type { createClient } from '@/lib/supabase/server';

import { askClaude, assessWithClaude, claudeConfigured, type AdminAssessment, type AiAnswer } from './ai-claude';
import { askGemini, assessWithGemini, geminiConfigured, type GeminiRoute } from './ai-gemini';

type Db = Awaited<ReturnType<typeof createClient>>;

/**
 * Which model answers. AI_PROVIDER ('gemini' | 'anthropic') decides when set;
 * otherwise Gemini when it has a key — in the server's environment or in
 * Supabase Vault (0130) — then Claude. Every rule about what the assistant may
 * do lives in the database and in the shared prompt; swapping the provider
 * changes none of them. No key is ever in the code.
 */
export type AiProvider = 'gemini' | 'anthropic';

async function geminiAvailable(supabase: Db) {
  if (geminiConfigured()) return true;
  const { data } = await supabase.rpc('ai_gemini_ready');
  return data === true;
}

export async function aiProvider(supabase: Db): Promise<AiProvider | null> {
  const wanted = process.env.AI_PROVIDER?.trim().toLowerCase();
  if (wanted === 'anthropic' || wanted === 'claude') return claudeConfigured() ? 'anthropic' : null;
  if (await geminiAvailable(supabase)) return 'gemini';
  if (wanted !== 'gemini' && claudeConfigured()) return 'anthropic';
  return null;
}

/** No key, no model call — and the interface says so rather than pretending. */
export async function aiConfigured(supabase: Db): Promise<boolean> {
  return (await aiProvider(supabase)) !== null;
}

async function routeFor(supabase: Db, thread: string | null): Promise<GeminiRoute> {
  const { data } = await supabase.auth.getSession();
  return { accessToken: data.session?.access_token ?? null, thread };
}

const NOT_CONNECTED =
  'المساعد غير موصول بمزوّد نموذج في هذه البيئة (لا مفتاح Gemini ولا ANTHROPIC_API_KEY). '
  + 'المحادثة والذاكرة والإجراءات تعمل، لكن لا يوجد من يجيب بعد.';

export async function askAssistant(supabase: Db, thread: string, input: {
  context: unknown;
  history: { role: 'user' | 'assistant'; content: string }[];
  prompt: string;
  kinds: AiActionKind[];
}): Promise<AiAnswer> {
  const provider = await aiProvider(supabase);
  if (provider === 'gemini') return askGemini(input, await routeFor(supabase, thread));
  if (provider === 'anthropic') return askClaude(input);
  return { text: '', proposals: [], model: null, error_ar: NOT_CONNECTED };
}

export async function assessForAdmin(supabase: Db, input: {
  kind: 'case' | 'ticket';
  facts: unknown;
  conversation: { author: string; body: string }[];
}): Promise<{ assessment: AdminAssessment | null; error_ar: string | null }> {
  const provider = await aiProvider(supabase);
  if (provider === 'gemini') return assessWithGemini(input, await routeFor(supabase, null));
  if (provider === 'anthropic') return assessWithClaude(input);
  return {
    assessment: null,
    error_ar: 'AI Assist غير موصول بمزوّد نموذج في هذه البيئة (لا مفتاح Gemini ولا ANTHROPIC_API_KEY). الحقائق المجمّعة أدناه من قاعدة البيانات مباشرة.',
  };
}
