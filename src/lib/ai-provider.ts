import type { AiActionKind } from '@/lib/database.types';

import { askClaude, assessWithClaude, claudeConfigured, type AdminAssessment, type AiAnswer } from './ai-claude';
import { askGemini, assessWithGemini, geminiConfigured } from './ai-gemini';

/**
 * Which model answers. AI_PROVIDER ('gemini' | 'anthropic') decides when set;
 * otherwise Gemini when its key is present (the founder's free choice), then
 * Claude. Every rule about what the assistant may do lives in the database and
 * in the shared prompt — swapping the provider changes none of them.
 * Keys are server environment variables only, never NEXT_PUBLIC_.
 */
export type AiProvider = 'gemini' | 'anthropic';

export function aiProvider(): AiProvider | null {
  const wanted = process.env.AI_PROVIDER?.trim().toLowerCase();
  if (wanted === 'gemini') return geminiConfigured() ? 'gemini' : null;
  if (wanted === 'anthropic' || wanted === 'claude') return claudeConfigured() ? 'anthropic' : null;
  if (geminiConfigured()) return 'gemini';
  if (claudeConfigured()) return 'anthropic';
  return null;
}

/** No key, no model call — and the interface says so rather than pretending. */
export function aiConfigured(): boolean {
  return aiProvider() !== null;
}

const NOT_CONNECTED =
  'المساعد غير موصول بمزوّد نموذج في هذه البيئة (GEMINI_API_KEY أو ANTHROPIC_API_KEY غير مضبوط). '
  + 'المحادثة والذاكرة والإجراءات تعمل، لكن لا يوجد من يجيب بعد.';

export async function askAssistant(input: {
  context: unknown;
  history: { role: 'user' | 'assistant'; content: string }[];
  prompt: string;
  kinds: AiActionKind[];
}): Promise<AiAnswer> {
  const provider = aiProvider();
  if (provider === 'gemini') return askGemini(input);
  if (provider === 'anthropic') return askClaude(input);
  return { text: '', proposals: [], model: null, error_ar: NOT_CONNECTED };
}

export async function assessForAdmin(input: {
  kind: 'case' | 'ticket';
  facts: unknown;
  conversation: { author: string; body: string }[];
}): Promise<{ assessment: AdminAssessment | null; error_ar: string | null }> {
  const provider = aiProvider();
  if (provider === 'gemini') return assessWithGemini(input);
  if (provider === 'anthropic') return assessWithClaude(input);
  return {
    assessment: null,
    error_ar: 'AI Assist غير موصول بمزوّد نموذج في هذه البيئة (GEMINI_API_KEY أو ANTHROPIC_API_KEY غير مضبوط). الحقائق المجمّعة أدناه من قاعدة البيانات مباشرة.',
  };
}
