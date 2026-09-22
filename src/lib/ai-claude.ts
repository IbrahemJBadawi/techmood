import Anthropic from '@anthropic-ai/sdk';

import type { AiActionKind } from '@/lib/database.types';

/**
 * The one place the platform talks to a model.
 *
 * Everything that must be true whichever model answers — who may read what,
 * what may be acted on, what is remembered — lives in the database. This file
 * holds only the call itself, and two rules about it:
 *
 *   1. The model never executes anything. Its one tool writes a *proposal*,
 *      and a proposal is a row the person still has to press a button on.
 *   2. The restricted kinds are named in the system prompt, so the assistant
 *      explains the refusal in its own words instead of promising something the
 *      database is about to refuse.
 */

export const AI_MODEL = 'claude-opus-5';

export type AiProposal = {
  kind: string;
  summary_ar: string;
  params: Record<string, unknown>;
};

export type AiAnswer = {
  text: string;
  proposals: AiProposal[];
  model: string | null;
  /** Set when the model could not be reached. Shown to the person as-is. */
  error_ar: string | null;
};

/** No key, no model call — and the interface says so rather than pretending. */
export function aiConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

function systemPrompt(kinds: AiActionKind[], context: unknown): string {
  const allowed = kinds.filter((k) => k.permission !== 'restricted' && k.is_enabled);
  const restricted = kinds.filter((k) => k.permission === 'restricted');

  return [
    'أنت مساعد TechMood: منصّة عربية تأخذ المتعلّم من التعلّم إلى الممارسة إلى بناء مشروع',
    'إلى التقييم إلى فريق إلى ملف مهني إلى عمل إلى شركة ناشئة.',
    '',
    'كيف تتحدّث:',
    '- بالعربية دائمًا، بضمير المخاطب، وبإيجاز. لا مقدّمات ولا اعتذارات.',
    '- لا تخترع شيئًا. ما لم يكن في السياق أدناه فقل إنك لا تعرفه، واقترح أين يجده.',
    '- أنت ترى ما يراه صاحب الحساب فقط. إن كان السياق فارغًا فهذا يعني أنه لا يملك صلاحية عليه، لا أنه غير موجود.',
    '- الأرقام التي تذكرها تأتي من السياق، لا من تقديرك.',
    '',
    'ماذا تفعل حين يحتاج الأمر تغييرًا:',
    '- لا تنفّذ شيئًا بنفسك. استخدم أداة propose_action لتقترح، ثم اشرح في نصّك ما اقترحته ولماذا.',
    '- الاقتراح لا يحدث شيئًا حتى يضغط صاحب الحساب زرّ التأكيد.',
    allowed.length
      ? `- ما يمكن اقتراحه: ${allowed.map((k) => `${k.kind} (${k.title_ar})`).join('، ')}.`
      : '- لا توجد إجراءات مفعّلة حاليًا.',
    '',
    'ما لا تفعله أبدًا، ولا تعد به:',
    ...restricted.map((k) => `- ${k.title_ar}: ${k.refusal_ar ?? 'ليس من عمل المساعد.'}`),
    'إن طُلب منك أحدها، قل ما تستطيع فعله بدلًا منه (صياغة، تجهيز، مراجعة) ودلّ على الصفحة التي يتمّ منها.',
    '',
    'السياق الحالي، كما قرأته قاعدة البيانات بصلاحيات صاحب الحساب نفسه:',
    JSON.stringify(context ?? {}, null, 1),
  ].join('\n');
}

function proposalTool(kinds: AiActionKind[]) {
  const allowed = kinds.filter((k) => k.permission !== 'restricted' && k.is_enabled);

  return {
    name: 'propose_action',
    description: [
      'اقترح إجراءً على صاحب الحساب. الأداة لا تنفّذ شيئًا: هي تسجّل اقتراحًا',
      'يظهر له كبطاقة بزرّ تأكيد وزرّ رفض. استدعها حين يكون هناك تغيير ملموس',
      'يفيده (بطاقة على لوحة، بند في خارطة طريق، هدف، مسودّة مشروع، عنوان مهني،',
      'نبذة، حفظ فرصة، أو معلومة تستحق التذكّر). لا تستدعها لمجرّد الشرح.',
    ].join(' '),
    eager_input_streaming: true,
    input_schema: {
      type: 'object' as const,
      properties: {
        kind: {
          type: 'string',
          enum: allowed.map((k) => k.kind),
          description: 'نوع الإجراء من القائمة المسموح بها.',
        },
        summary_ar: {
          type: 'string',
          description: 'جملة واحدة بالعربية تصف ما سيحدث إن أكّده، كما سيقرأها هو.',
        },
        params: {
          type: 'object',
          description: [
            'معطيات الإجراء. remember: {content, kind}. save_opportunity: {opportunity_id}.',
            'create_goal: {startup_id, title, specific, metric, baseline, target, due_on}.',
            'create_roadmap_item: {startup_id, title, detail, year, quarter}.',
            'add_canvas_card: {canvas_id, block, body, note}.',
            'create_project_draft: {title, description}. update_headline: {headline}. update_bio: {bio}.',
          ].join(' '),
          additionalProperties: true,
        },
      },
      required: ['kind', 'summary_ar', 'params'],
    },
  };
}

/** A proposal whose shape is wrong is dropped, not repaired and not run. */
function validProposal(input: unknown, kinds: AiActionKind[]): AiProposal | null {
  if (typeof input !== 'object' || input === null) return null;
  const raw = input as Record<string, unknown>;
  const kind = typeof raw.kind === 'string' ? raw.kind : null;
  const summary = typeof raw.summary_ar === 'string' ? raw.summary_ar.trim() : '';

  if (!kind || summary.length < 2) return null;
  if (!kinds.some((k) => k.kind === kind && k.permission !== 'restricted' && k.is_enabled)) return null;

  const params = typeof raw.params === 'object' && raw.params !== null
    ? (raw.params as Record<string, unknown>)
    : {};

  return { kind, summary_ar: summary.slice(0, 400), params };
}

export async function askClaude(input: {
  context: unknown;
  history: { role: 'user' | 'assistant'; content: string }[];
  prompt: string;
  kinds: AiActionKind[];
}): Promise<AiAnswer> {
  if (!aiConfigured()) {
    return {
      text: '',
      proposals: [],
      model: null,
      error_ar:
        'المساعد غير موصول بمزوّد نموذج في هذه البيئة (ANTHROPIC_API_KEY غير مضبوط). '
        + 'المحادثة والذاكرة والإجراءات تعمل، لكن لا يوجد من يجيب بعد.',
    };
  }

  const client = new Anthropic();

  try {
    // Streaming, because the context can be long and a chat request that sits
    // silent for a minute looks broken. `.finalMessage()` is read inside the
    // same try as the stream, since that is where a malformed tool input lands.
    const stream = client.messages.stream({
      model: AI_MODEL,
      max_tokens: 4096,
      thinking: { type: 'adaptive' },
      output_config: { effort: 'medium' },
      system: systemPrompt(input.kinds, input.context),
      tools: [proposalTool(input.kinds)],
      messages: [
        ...input.history.map((m) => ({ role: m.role, content: m.content })),
        { role: 'user' as const, content: input.prompt },
      ],
    });

    const message = await stream.finalMessage();

    const text = message.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('\n')
      .trim();

    // A turn cut off at max_tokens, or refused, may carry a half-written tool
    // input. Nothing from it is proposed.
    const trustTools = message.stop_reason !== 'max_tokens' && message.stop_reason !== 'refusal';

    const proposals = trustTools
      ? message.content
          .filter((block) => block.type === 'tool_use' && block.name === 'propose_action')
          .map((block) => validProposal((block as Anthropic.ToolUseBlock).input, input.kinds))
          .filter((p): p is AiProposal => p !== null)
      : [];

    return {
      text: text || 'لم يصلني ردّ نصّي. أعد صياغة سؤالك.',
      proposals,
      model: message.model ?? AI_MODEL,
      error_ar: null,
    };
  } catch (error) {
    if (error instanceof Anthropic.APIError) {
      return {
        text: '', proposals: [], model: null,
        error_ar: `تعذّر الوصول إلى النموذج (${error.status ?? 'خطأ'}). حاول بعد قليل.`,
      };
    }

    return {
      text: '', proposals: [], model: null,
      error_ar: 'تعذّر قراءة ردّ النموذج. حاول مرّة أخرى.',
    };
  }
}
