// ai-gemini — every call TechMood makes to Google Gemini (0130, 0139, 0140).
//
// The Gemini key lives in Supabase Vault (`gemini_api_key`); this function
// reads it with the service role the platform injects, so it is never in the
// app, a table or this file. The app calls it as the member (their JWT), and
// each kind of call is first claimed as that member, in the database, which
// decides whether it may happen at all:
//
//   * the assistant  — claim_ai_model_call: one model call per question the
//                      member actually asked, against their daily limit, or an
//                      admin's reading of a case or ticket. The app builds the
//                      request; Google's answer goes back as is.
//   * a lesson quiz  — claim_quiz_generation: a lesson with no quiz yet. The
//                      request is built in the database from the lesson's own
//                      material; the quiz is saved with the service role.
//   * a first look   — claim_submission_precheck: the owner's newest submitted
//                      version, once. The brief and links come from the
//                      database; a public GitHub repository's README and file
//                      list are read here; the checklist is saved with the
//                      service role. It never grades.
//
// Anything not claimed is refused before Google is reached.
import { createClient } from 'npm:@supabase/supabase-js@2';

const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';
// Tried in turn when the configured model is busy.
const FALLBACKS = ['gemini-flash-latest', 'gemini-3.5-flash', 'gemini-flash-lite-latest'];

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

type Part = { text?: string; thought?: boolean };
type GeminiData = { candidates?: { content?: { parts?: Part[] } }[] } | null;

const service = () => createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false },
});

/** The configured model first, then the other current Flash models, each once. */
async function gemini(request: unknown): Promise<{ status: number; data: GeminiData; model: string | null }> {
  const { data: config } = await service().rpc('ai_gemini_config').single();
  const cfg = config as { api_key: string | null; model: string } | null;
  if (!cfg?.api_key) return { status: 503, data: null, model: null };

  const models = [cfg.model, ...FALLBACKS.filter((m) => m !== cfg.model)];
  let last = 504;
  for (const [index, model] of models.entries()) {
    if (index > 0) await new Promise((resolve) => setTimeout(resolve, 800));
    const upstream = await fetch(`${ENDPOINT}/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': cfg.api_key },
      body: JSON.stringify(request),
      signal: AbortSignal.timeout(25_000),
    }).catch(() => null);
    if (!upstream) continue;
    if (upstream.status === 503 || upstream.status === 429) {
      last = upstream.status; // busy: the app says so, rather than "unreachable"
      continue;
    }
    return { status: upstream.status, data: await upstream.json().catch(() => null), model };
  }
  return { status: last, data: null, model: null };
}

/** The JSON a structured answer carries in its text part. */
function answerJson(data: GeminiData): unknown {
  const text = data?.candidates?.[0]?.content?.parts?.find((p) => p.text && !p.thought)?.text;
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// A first look: what a public GitHub repository shows of itself
// ---------------------------------------------------------------------------
async function readGithub(url: string): Promise<string | null> {
  const match = url.match(/github\.com\/([\w.-]+)\/([\w.-]+?)(?:\.git)?(?:[/?#]|$)/i);
  if (!match) return null;
  const [, owner, repo] = match;
  const headers = { 'User-Agent': 'TechMood-precheck', Accept: 'application/vnd.github+json' };

  const [tree, readme] = await Promise.all([
    fetch(`https://api.github.com/repos/${owner}/${repo}/git/trees/HEAD?recursive=1`, { headers, signal: AbortSignal.timeout(8000) })
      .then((r) => (r.ok ? r.json() : null)).catch(() => null),
    (async () => {
      for (const name of ['README.md', 'readme.md', 'Readme.md', 'README']) {
        const r = await fetch(`https://raw.githubusercontent.com/${owner}/${repo}/HEAD/${name}`, { signal: AbortSignal.timeout(8000) }).catch(() => null);
        if (r?.ok) return (await r.text()).slice(0, 12_000);
      }
      return null;
    })(),
  ]);

  const files = Array.isArray(tree?.tree)
    ? (tree.tree as { path: string; type: string }[]).filter((f) => f.type === 'blob').map((f) => f.path).slice(0, 300)
    : null;
  if (!files && !readme) return `GitHub ${owner}/${repo}: تعذّر فتح المستودع (قد يكون خاصاً أو غير موجود).`;
  return [
    `GitHub ${owner}/${repo}`,
    files ? `الملفات (${files.length}):\n${files.join('\n')}` : 'قائمة الملفات: تعذّر قراءتها.',
    readme ? `README:\n${readme}` : 'README: غير موجود.',
  ].join('\n\n');
}

const PRECHECK_SYSTEM = [
  'أنت مساعد «الفحص الأولي» في أكاديمية TechMood. تنظر في عمل سلّمه طالب لتكليف، قبل أن يراجعه المنتور.',
  'مهمتك قائمة تحقق فقط: استخرج من نص التكليف ما يطلبه (3 إلى 8 بنود)، وقل لكل بند هل يظهر فيما سُلّم:',
  'found = يظهر بوضوح في الملفات أو README، missing = غير موجود، unclear = لا يمكن التحقق (رابط Drive أو مستودع لم يُفتح أو غير واضح).',
  'لا تعطِ درجة ولا نجوماً، ولا تقل إن العمل مقبول أو مرفوض؛ القرار للمنتور.',
  'اكتب بالعربية بإيجاز ولطف، والمصطلحات التقنية بالإنجليزية. note سطر واحد عملي لكل بند.',
  'summary جملتان على الأكثر. next أهم خطوة واحدة يفعلها الطالب الآن.',
].join('\n');

const PRECHECK_SCHEMA = {
  type: 'OBJECT',
  properties: {
    summary: { type: 'STRING' },
    items: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          item: { type: 'STRING' },
          status: { type: 'STRING', enum: ['found', 'missing', 'unclear'] },
          note: { type: 'STRING' },
        },
        required: ['item', 'status', 'note'],
      },
    },
    next: { type: 'STRING' },
  },
  required: ['summary', 'items', 'next'],
};

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  const auth = req.headers.get('Authorization') ?? '';
  if (!auth.startsWith('Bearer ')) return json({ error: 'not authenticated' }, 401);

  let payload: { task?: string; thread?: string | null; request?: unknown; lesson?: string; submission?: string };
  try {
    payload = await req.json();
  } catch {
    return json({ error: 'bad request' }, 400);
  }

  // As the member: may this call be made?
  const asMember = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false },
  });

  // ----- a lesson quiz -----
  if (payload.task === 'quiz') {
    if (typeof payload.lesson !== 'string') return json({ error: 'bad request' }, 400);
    const { error } = await asMember.rpc('claim_quiz_generation', { p_lesson: payload.lesson });
    if (error) return json({ ok: false, error: error.message }, 409);

    const { data: request } = await service().rpc('lesson_quiz_request', { p_lesson: payload.lesson });
    if (!request) return json({ ok: false, error: 'no lesson' }, 404);
    const answer = await gemini(request);
    if (answer.status !== 200) return json({ ok: false, status: answer.status }, 502);
    const { data: saved } = await service().rpc('save_lesson_quiz', {
      p_lesson: payload.lesson, p_questions: answerJson(answer.data), p_model: answer.model,
    });
    return json({ ok: saved === true });
  }

  // ----- a first look at submitted work -----
  if (payload.task === 'precheck') {
    if (typeof payload.submission !== 'string') return json({ error: 'bad request' }, 400);
    const { data: version, error } = await asMember.rpc('claim_submission_precheck', { p_submission: payload.submission });
    if (error || !version) return json({ ok: false, error: error?.message }, 409);

    const { data: material } = await service().rpc('precheck_material', { p_version: version });
    const m = material as { assignment: string; brief: string | null; lesson: string | null; course: string | null;
      note: string | null; evidence: { kind: string; url: string }[] } | null;
    if (!m) return json({ ok: false }, 404);

    const read = await Promise.all(m.evidence.map(async (e) => {
      if (e.kind === 'github' || /github\.com/i.test(e.url)) return (await readGithub(e.url)) ?? `${e.kind}: ${e.url}`;
      return `${e.kind}: ${e.url} — رابط لا يمكن فتح محتواه هنا.`;
    }));

    const answer = await gemini({
      systemInstruction: { parts: [{ text: PRECHECK_SYSTEM }] },
      contents: [{ role: 'user', parts: [{ text: [
        `الدورة: ${m.course ?? '—'}`,
        `الدرس: ${m.lesson ?? '—'}`,
        `التكليف: ${m.assignment}`,
        `نص التكليف:\n${m.brief ?? '—'}`,
        m.note ? `ملاحظة الطالب: ${m.note}` : '',
        `ما سلّمه الطالب:\n${read.join('\n\n---\n\n')}`,
      ].filter(Boolean).join('\n\n') }] }],
      generationConfig: { temperature: 0.2, maxOutputTokens: 8192, responseMimeType: 'application/json', responseSchema: PRECHECK_SCHEMA },
    });
    const result = answer.status === 200 ? answerJson(answer.data) : null;
    const { data: saved } = await service().rpc('save_submission_precheck', {
      p_version: version,
      p_result: result && typeof result === 'object'
        ? { ...(result as Record<string, unknown>), read: m.evidence.map((e) => e.kind) }
        : null,
      p_model: answer.model,
    });
    return json({ ok: saved === true });
  }

  // ----- the assistant -----
  if (typeof payload.request !== 'object' || payload.request === null) return json({ error: 'bad request' }, 400);
  const { error: claimError } = await asMember.rpc('claim_ai_model_call', { p_thread: payload.thread ?? null });
  if (claimError) return json({ error: 'no question waiting', status: 409 }, 409);

  const answer = await gemini(payload.request);
  // Google's answer, as is: the app validates every proposal before showing it.
  return json({ status: answer.status, data: answer.data });
});
