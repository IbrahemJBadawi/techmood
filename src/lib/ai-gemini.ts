import type { AiActionKind } from '@/lib/database.types';
import { SUPABASE_PUBLIC_KEY, SUPABASE_URL } from './supabase/config';

import {
  ADMIN_SYSTEM, CATEGORIES, systemPrompt, validAssessment, validProposal,
  type AdminAssessment, type AiAnswer, type AiProposal,
} from './ai-claude';

/**
 * Google Gemini as the assistant's model (the founder's free option).
 *
 * The same rules as the Claude path, because they do not live here: the
 * system prompt is shared, the one tool only writes a *proposal* the person
 * still has to confirm, restricted kinds are refused in the database, and a
 * proposal of the wrong shape is dropped. This file holds only the HTTP call.
 *
 * Where the key is (server-side only, never NEXT_PUBLIC_):
 *   * in Supabase Vault as `gemini_api_key` (0130) — the call then goes
 *     through the `ai-gemini` Edge Function, which reads the key itself and
 *     allows one model call per question the member actually asked; or
 *   * GEMINI_API_KEY in the server's environment — a direct call
 *     (GEMINI_MODEL optional; defaults to GEMINI_DEFAULT_MODEL).
 */

export const GEMINI_DEFAULT_MODEL = 'gemini-flash-latest';
const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';

export function geminiConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY);
}

function geminiModel() {
  return process.env.GEMINI_MODEL?.trim() || GEMINI_DEFAULT_MODEL;
}

type Part = { text?: string; thought?: boolean; functionCall?: { name: string; args?: Record<string, unknown> } };
type GeminiResponse = {
  candidates?: { content?: { parts?: Part[] }; finishReason?: string }[];
  modelVersion?: string;
  promptFeedback?: { blockReason?: string };
  error?: { code?: number; message?: string };
};

/** How this call reaches Gemini when the key is in Vault: as the member, for one thread. */
export type GeminiRoute = { accessToken: string | null; thread: string | null };

async function generate(body: unknown, route?: GeminiRoute): Promise<{ data: GeminiResponse | null; status: number }> {
  if (!geminiConfigured()) {
    if (!route?.accessToken) return { data: null, status: 401 };
    const relay = await fetch(`${SUPABASE_URL}/functions/v1/ai-gemini`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${route.accessToken}`,
        apikey: SUPABASE_PUBLIC_KEY,
      },
      body: JSON.stringify({ thread: route.thread, request: body }),
      signal: AbortSignal.timeout(100_000),
      cache: 'no-store',
    });
    const out = (await relay.json().catch(() => null)) as { status?: number; data?: GeminiResponse } | null;
    return { data: out?.data ?? null, status: relay.ok ? (out?.status ?? 502) : relay.status };
  }
  const response = await fetch(`${ENDPOINT}/${encodeURIComponent(geminiModel())}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY ?? '' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(90_000),
    cache: 'no-store',
  });
  const data = (await response.json().catch(() => null)) as GeminiResponse | null;
  return { data, status: response.status };
}

/** Gemini's schema subset has no free-form objects, so the proposal's params travel as JSON text. */
function proposalDeclaration(kinds: AiActionKind[]) {
  const allowed = kinds.filter((k) => k.permission !== 'restricted' && k.is_enabled);
  if (allowed.length === 0) return null;
  return {
    name: 'propose_action',
    description: [
      'اقترح إجراءً على صاحب الحساب. الأداة لا تنفّذ شيئًا: هي تسجّل اقتراحًا يظهر له كبطاقة بزرّ تأكيد وزرّ رفض.',
      'استدعها حين يكون هناك تغيير ملموس يفيده، لا لمجرّد الشرح.',
    ].join(' '),
    parameters: {
      type: 'object',
      properties: {
        kind: { type: 'string', enum: allowed.map((k) => k.kind), description: 'نوع الإجراء من القائمة المسموح بها.' },
        summary_ar: { type: 'string', description: 'جملة واحدة بالعربية تصف ما سيحدث إن أكّده.' },
        params_json: {
          type: 'string',
          description: [
            'معطيات الإجراء كنصّ JSON. remember: {"content","kind"}. save_opportunity: {"opportunity_id"}.',
            'create_goal: {"startup_id","title","specific","metric","baseline","target","due_on"}.',
            'create_roadmap_item: {"startup_id","title","detail","year","quarter"}.',
            'add_canvas_card: {"canvas_id","block","body","note"}.',
            'create_project_draft: {"title","description"}. update_headline: {"headline"}. update_bio: {"bio"}.',
          ].join(' '),
        },
      },
      required: ['kind', 'summary_ar', 'params_json'],
    },
  };
}

function parseParams(raw: unknown): Record<string, unknown> {
  if (typeof raw !== 'string') return {};
  try {
    const value = JSON.parse(raw);
    return typeof value === 'object' && value !== null && !Array.isArray(value) ? value : {};
  } catch {
    return {};
  }
}

function failure(status: number, data: GeminiResponse | null): string {
  if (status === 429) return 'بلغ المساعد حدّ الاستخدام المجاني لدى Gemini الآن. حاول بعد قليل.';
  if (status === 503) return 'نموذج Gemini مشغول الآن من كثرة الطلب. حاول بعد لحظات.';
  if (status === 400 || status === 403) return `رفض Gemini الطلب (${status}) — تحقّق من مفتاح Gemini واسم النموذج.`;
  if (status === 409) return 'هذا السؤال أُجيب بالفعل أو انتهت مهلته — اسأل من جديد.';
  return `تعذّر الوصول إلى النموذج (${status || data?.error?.code || 'خطأ'}). حاول بعد قليل.`;
}

export async function askGemini(input: {
  context: unknown;
  history: { role: 'user' | 'assistant'; content: string }[];
  prompt: string;
  kinds: AiActionKind[];
}, route?: GeminiRoute): Promise<AiAnswer> {
  const declaration = proposalDeclaration(input.kinds);
  try {
    const { data, status } = await generate({
      systemInstruction: { parts: [{ text: systemPrompt(input.kinds, input.context) }] },
      contents: [
        ...input.history.map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })),
        { role: 'user', parts: [{ text: input.prompt }] },
      ],
      ...(declaration ? { tools: [{ functionDeclarations: [declaration] }], toolConfig: { functionCallingConfig: { mode: 'AUTO' } } } : {}),
      generationConfig: { maxOutputTokens: 4096, temperature: 0.6 },
    }, route);
    if (status !== 200 || !data) return { text: '', proposals: [], model: null, error_ar: failure(status, data) };

    const candidate = data.candidates?.[0];
    if (!candidate) {
      return { text: '', proposals: [], model: null, error_ar: data.promptFeedback?.blockReason
        ? 'لم يُجب النموذج على هذه الرسالة. أعد صياغتها.' : 'لم يصلني ردّ من النموذج. حاول مرّة أخرى.' };
    }
    const parts = candidate.content?.parts ?? [];
    const text = parts.filter((p) => p.text && !p.thought).map((p) => p.text).join('\n').trim();

    // A reply cut off at the token limit, or stopped for safety, may carry a
    // half-written call. Nothing from it is proposed.
    const trustTools = candidate.finishReason === 'STOP' || candidate.finishReason === undefined;
    const proposals = trustTools
      ? parts
          .filter((p) => p.functionCall?.name === 'propose_action')
          .map((p) => validProposal({
            kind: p.functionCall?.args?.kind,
            summary_ar: p.functionCall?.args?.summary_ar,
            params: parseParams(p.functionCall?.args?.params_json),
          }, input.kinds))
          .filter((p): p is AiProposal => p !== null)
      : [];

    return {
      text: text || (proposals.length ? 'جهّزت لك اقتراحاً — راجعه وأكّده إن ناسبك.' : 'لم يصلني ردّ نصّي. أعد صياغة سؤالك.'),
      proposals,
      model: data.modelVersion ?? geminiModel(),
      error_ar: null,
    };
  } catch {
    return { text: '', proposals: [], model: null, error_ar: 'تعذّر الوصول إلى Gemini. حاول مرّة أخرى.' };
  }
}

export async function assessWithGemini(input: {
  kind: 'case' | 'ticket';
  facts: unknown;
  conversation: { author: string; body: string }[];
}, route?: GeminiRoute): Promise<{ assessment: AdminAssessment | null; error_ar: string | null }> {
  try {
    const { data, status } = await generate({
      systemInstruction: { parts: [{ text: ADMIN_SYSTEM }] },
      contents: [{ role: 'user', parts: [{ text: JSON.stringify(input) }] }],
      tools: [{
        functionDeclarations: [{
          name: 'record_assessment',
          description: 'سجّل قراءتك للبلاغ أو القضية: ملخص، الأدلة المهمة، الخطوة التالية المقترحة، التصنيف ودرجة الثقة.',
          parameters: {
            type: 'object',
            properties: {
              summary_ar: { type: 'string', description: 'ملخص القضية في 2–4 جمل.' },
              evidence: { type: 'array', items: { type: 'string' }, description: 'الأدلة ذات الصلة كما وردت في الحقائق.' },
              next_step_ar: { type: 'string', description: 'الخطوة التالية المقترحة على الموظف، جملة واحدة.' },
              category: { type: 'string', enum: [...CATEGORIES], description: 'التصنيف الأنسب.' },
              confidence: { type: 'integer', description: 'ثقتك في التصنيف من 0 إلى 100.' },
            },
            required: ['summary_ar', 'evidence', 'next_step_ar', 'category', 'confidence'],
          },
        }],
      }],
      toolConfig: { functionCallingConfig: { mode: 'ANY', allowedFunctionNames: ['record_assessment'] } },
      generationConfig: { maxOutputTokens: 2048, temperature: 0.2 },
    }, route);
    if (status !== 200 || !data) return { assessment: null, error_ar: failure(status, data) };

    const candidate = data.candidates?.[0];
    if (!candidate || (candidate.finishReason && candidate.finishReason !== 'STOP')) {
      return { assessment: null, error_ar: 'لم تكتمل قراءة الذكاء الاصطناعي. حاول مرة أخرى.' };
    }
    const call = candidate.content?.parts?.find((p) => p.functionCall?.name === 'record_assessment')?.functionCall;
    const assessment = call ? validAssessment(call.args) : null;
    return assessment
      ? { assessment, error_ar: null }
      : { assessment: null, error_ar: 'جاء ردّ النموذج بصيغة غير صالحة. حاول مرة أخرى.' };
  } catch {
    return { assessment: null, error_ar: 'تعذّر الوصول إلى Gemini. حاول مرّة أخرى.' };
  }
}
