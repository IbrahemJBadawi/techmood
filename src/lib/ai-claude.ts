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
export function claudeConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

/** Shared by every provider (src/lib/ai.ts): the same rules whoever answers. */
export function systemPrompt(kinds: AiActionKind[], context: unknown): string {
  const allowed = kinds.filter((k) => k.permission !== 'restricted' && k.is_enabled);
  const restricted = kinds.filter((k) => k.permission === 'restricted');

  return [
    'أنت مساعد TechMood: منصّة عربية تأخذ المتعلّم من التعلّم إلى الممارسة إلى بناء مشروع',
    'إلى التقييم إلى فريق إلى ملف مهني إلى عمل إلى شركة ناشئة.',
    '',
    'كيف تتحدّث:',
    '- بلغة آخر رسالة كتبها صاحب الحساب ولهجتها، مهما كانت لغة ما قبلها: إن كتب بالإنجليزية فبالإنجليزية كاملة، وإن كتب بلهجة شامية أو خليجية أو مصرية فبعربية قريبة منها.',
    '- بإيجاز وبضمير المخاطب: جملة أو جملتان ثم نقاط قصيرة عند الحاجة. لا مقدّمات ولا اعتذارات ولا تكرار للسؤال.',
    '- التنسيق: **عريض** لأسماء ما تنصح به، وقوائم نقطية قصيرة. لا جداول ولا عناوين ولا خطوط فاصلة.',
    '- حين تذكر صفحة في المنصة فاكتبها رابطًا بهذا الشكل: [اسم الصفحة](/المسار) — من الروابط الموجودة في البيانات أدناه فقط، ولا تضع روابط خارجية.',
    '',
    'ما تعرفه:',
    '- البيانات أدناه هي كل ما تعرفه: ملف صاحب الحساب وتعلّمه، و catalogue (المسارات والدورات المفتوحة)، و mentors (المنتورز المتاحون)، و rules (الأسعار والقواعد).',
    '- حين يسأل عن مسار أو دورة أو منتور فاختر من هذه القوائم بالاسم والرابط، وقل لماذا يناسبه. لا تخترع اسم مسار أو دورة أو منتور أو سعرًا غير موجود.',
    '- الأرقام (ساعات، أسعار، مُدد) تأتي من البيانات كما هي. إن لم تجد الرقم فلا تقدّره.',
    '- لا تقل «سياقي» أو «البيانات المتاحة لي». إن لم تعرف شيئًا فقل ذلك ببساطة ودلّه على الصفحة التي يجده فيها، أو على [الدعم](/support).',
    '- أنت ترى ما يراه صاحب الحساب فقط؛ ما لا يظهر لك قد يكون غير متاح له، لا غير موجود.',
    '- صفحات المنصة: [الأكاديمية](/academy)، [المنتورز](/mentors)، [المعرض](/gallery)، [السوق](/marketplace)، [الفرق](/teams)، [الرسائل](/messages)، [الحجوزات](/bookings)، [المحفظة](/wallet)، [ملفي المهني](/passport)، [الإعدادات](/settings/profile)، [الدعم](/support)، [السياسات](/policies).',
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
    'إن طُلب منك أحدها فلا تنفّذه، لكن أنجز الجزء المفيد: مثلًا سمِّ المنتور المناسب من mentors برابطه وسعره وخطوات الحجز، أو اكتب له المسودّة، ودلّه على الصفحة التي يتمّ منها.',
    'وأجب دائمًا عن سؤاله نصًّا، حتى حين تقترح إجراءً.',
    '',
    'البيانات (لا تعرضها كما هي؛ استخدمها لتجيب):',
    JSON.stringify(context ?? {}),
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
export function validProposal(input: unknown, kinds: AiActionKind[]): AiProposal | null {
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
  if (!claudeConfigured()) {
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

/* -------------------------------------------------------------------------
 * AI Assist for the administration (0084)
 *
 * The model reads a case or a ticket — the facts the database gathered and
 * the conversation — and returns a summary, the evidence that matters and a
 * suggested next step. It is a reading, not a verdict: the result is stored
 * beside the case as a suggestion, nothing acts on it, and the admin decides.
 * ------------------------------------------------------------------------- */

export const ADMIN_SYSTEM = [
  'أنت مساعد لفريق إدارة TechMood يقرأ بلاغاً أو قضية ويلخّصها للموظف.',
  '- لا تحكم على أي شخص ولا تتخذ قراراً: القرار للإدارة وحدها.',
  '- اعتمد على الحقائق والمحادثة المعطاة فقط، ولا تخترع أرقاماً أو أحداثاً.',
  '- إن كان هناك نقص في المعلومات فاذكره واجعل الخطوة التالية جمعه.',
  '- اكتب بالعربية وبإيجاز، ثم سجّل قراءتك بالأداة record_assessment.',
].join('\n');

export type AdminAssessment = {
  summary_ar: string;
  evidence: string[];
  next_step_ar: string;
  category: string | null;
  confidence: number | null;
};

export const CATEGORIES = [
  'payment', 'booking', 'mentor', 'mentee', 'freelancer', 'client',
  'content', 'account', 'behavior', 'fraud', 'copyright', 'technical', 'other',
] as const;

export function validAssessment(raw: unknown): AdminAssessment | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const input = raw as Record<string, unknown>;
  if (typeof input.summary_ar !== 'string' || typeof input.next_step_ar !== 'string') return null;
  const evidence = Array.isArray(input.evidence) ? input.evidence.filter((item): item is string => typeof item === 'string') : [];
  const category = typeof input.category === 'string' && (CATEGORIES as readonly string[]).includes(input.category)
    ? input.category : null;
  const confidence = typeof input.confidence === 'number' && Number.isFinite(input.confidence)
    ? Math.max(0, Math.min(100, Math.round(input.confidence))) : null;
  return {
    summary_ar: input.summary_ar.slice(0, 2000),
    evidence: evidence.slice(0, 10).map((item) => item.slice(0, 300)),
    next_step_ar: input.next_step_ar.slice(0, 600),
    category,
    confidence,
  };
}

export async function assessWithClaude(input: {
  kind: 'case' | 'ticket';
  facts: unknown;
  conversation: { author: string; body: string }[];
}): Promise<{ assessment: AdminAssessment | null; error_ar: string | null }> {
  if (!claudeConfigured()) {
    return {
      assessment: null,
      error_ar: 'AI Assist غير موصول بمزوّد نموذج في هذه البيئة (ANTHROPIC_API_KEY غير مضبوط). الحقائق المجمّعة أدناه من قاعدة البيانات مباشرة.',
    };
  }

  const client = new Anthropic();
  try {
    const stream = client.messages.stream({
      model: AI_MODEL,
      max_tokens: 2048,
      system: ADMIN_SYSTEM,
      tools: [{
        name: 'record_assessment',
        description: 'سجّل قراءتك للبلاغ أو القضية: ملخص، الأدلة المهمة، الخطوة التالية المقترحة، التصنيف ودرجة الثقة.',
        eager_input_streaming: true,
        input_schema: {
          type: 'object' as const,
          properties: {
            summary_ar: { type: 'string', description: 'ملخص القضية في 2–4 جمل.' },
            evidence: { type: 'array', items: { type: 'string' }, description: 'الأدلة ذات الصلة كما وردت في الحقائق.' },
            next_step_ar: { type: 'string', description: 'الخطوة التالية المقترحة على الموظف، جملة واحدة.' },
            category: { type: 'string', enum: [...CATEGORIES], description: 'التصنيف الأنسب.' },
            confidence: { type: 'integer', minimum: 0, maximum: 100, description: 'ثقتك في التصنيف.' },
          },
          required: ['summary_ar', 'evidence', 'next_step_ar', 'category', 'confidence'],
        },
      }],
      tool_choice: { type: 'tool', name: 'record_assessment' },
      messages: [{
        role: 'user',
        content: JSON.stringify({ kind: input.kind, facts: input.facts, conversation: input.conversation }),
      }],
    });

    const message = await stream.finalMessage();
    if (message.stop_reason === 'max_tokens' || message.stop_reason === 'refusal') {
      return { assessment: null, error_ar: 'لم تكتمل قراءة الذكاء الاصطناعي. حاول مرة أخرى.' };
    }
    const block = message.content.find((item) => item.type === 'tool_use' && item.name === 'record_assessment');
    const assessment = block ? validAssessment((block as Anthropic.ToolUseBlock).input) : null;
    return assessment
      ? { assessment, error_ar: null }
      : { assessment: null, error_ar: 'جاء ردّ النموذج بصيغة غير صالحة. حاول مرة أخرى.' };
  } catch (error) {
    if (error instanceof Anthropic.APIError) {
      return { assessment: null, error_ar: `تعذّر الوصول إلى النموذج (${error.status ?? 'خطأ'}). حاول بعد قليل.` };
    }
    return { assessment: null, error_ar: 'تعذّر قراءة ردّ النموذج. حاول مرّة أخرى.' };
  }
}
