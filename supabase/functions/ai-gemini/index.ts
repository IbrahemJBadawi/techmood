// ai-gemini — the assistant's call to Google Gemini (0130).
//
// The Gemini key lives in Supabase Vault (`gemini_api_key`); this function
// reads it with the service role the platform injects, so it is never in the
// app, a table or this file. The app calls it as the member (their JWT), and
// the member's own client first claims the call (public.claim_ai_model_call):
// one model call per question they actually asked — counted against their
// daily limit — or per admin reading of a case or ticket. Anything else is
// refused before Google is reached.
import { createClient } from 'npm:@supabase/supabase-js@2';

const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';
// Tried in turn when the configured model is busy.
const FALLBACKS = ['gemini-flash-latest', 'gemini-3.5-flash', 'gemini-flash-lite-latest'];

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  const auth = req.headers.get('Authorization') ?? '';
  if (!auth.startsWith('Bearer ')) return json({ error: 'not authenticated' }, 401);

  let payload: { thread?: string | null; request?: unknown };
  try {
    payload = await req.json();
  } catch {
    return json({ error: 'bad request' }, 400);
  }
  if (typeof payload.request !== 'object' || payload.request === null) return json({ error: 'bad request' }, 400);

  // As the member: may this call be made?
  const asMember = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false },
  });
  const { error: claimError } = await asMember.rpc('claim_ai_model_call', { p_thread: payload.thread ?? null });
  if (claimError) return json({ error: 'no question waiting', status: 409 }, 409);

  // As the platform: the key and the model.
  const service = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  });
  const { data: config } = await service.rpc('ai_gemini_config').single();
  const cfg = config as { api_key: string | null; model: string } | null;
  if (!cfg?.api_key) return json({ error: 'no key', status: 503 }, 503);

  // Google's free models are sometimes busy for a moment. The configured model
  // first, then the other current Flash models, each once; a model that is
  // simply busy (429/503) hands over to the next, anything else is the answer.
  const models = [cfg.model, ...FALLBACKS.filter((m) => m !== cfg.model)];
  const call = (model: string) => fetch(`${ENDPOINT}/${encodeURIComponent(model)}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': cfg.api_key! },
    body: JSON.stringify(payload.request),
    signal: AbortSignal.timeout(25_000),
  }).catch(() => null);

  let upstream: Response | null = null;
  for (const [index, model] of models.entries()) {
    if (index > 0) await new Promise((resolve) => setTimeout(resolve, 800));
    upstream = await call(model);
    if (upstream && upstream.status !== 503 && upstream.status !== 429) break;
  }
  if (!upstream) return json({ status: 504, data: null });

  const data = await upstream.json().catch(() => null);
  // Google's answer, as is: the app validates every proposal before showing it.
  return json({ status: upstream.status, data });
});
