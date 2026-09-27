/**
 * Exercises src/lib/ai-claude.ts against a stub that speaks the Messages API
 * wire format, so the request it builds and the answer it parses are checked
 * without a provider key and without spending anything.
 *
 * Usage: node scripts/ai-smoke.mjs
 */
import http from 'node:http';
import assert from 'node:assert/strict';

let captured = null;
let script = [];

function sse(res, events) {
  res.writeHead(200, {
    'content-type': 'text/event-stream',
    'cache-control': 'no-cache',
    connection: 'keep-alive',
  });
  for (const event of events) {
    res.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
  }
  res.end();
}

function message({ text, tools = [], stopReason = 'end_turn', toolName = 'propose_action' }) {
  const events = [
    {
      type: 'message_start',
      message: {
        id: 'msg_stub', type: 'message', role: 'assistant', model: 'claude-opus-5',
        content: [], stop_reason: null, stop_sequence: null,
        usage: { input_tokens: 10, output_tokens: 1 },
      },
    },
    { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } },
    { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text } },
    { type: 'content_block_stop', index: 0 },
  ];

  tools.forEach((input, i) => {
    const index = i + 1;
    events.push(
      { type: 'content_block_start', index,
        content_block: { type: 'tool_use', id: `toolu_${index}`, name: toolName, input: {} } },
      { type: 'content_block_delta', index,
        delta: { type: 'input_json_delta', partial_json: JSON.stringify(input) } },
      { type: 'content_block_stop', index },
    );
  });

  events.push(
    { type: 'message_delta', delta: { stop_reason: stopReason, stop_sequence: null },
      usage: { output_tokens: 20 } },
    { type: 'message_stop' },
  );

  return events;
}

const server = http.createServer((req, res) => {
  let body = '';
  req.on('data', (chunk) => { body += chunk; });
  req.on('end', () => {
    captured = JSON.parse(body);
    sse(res, script);
  });
});

await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const { port } = server.address();

process.env.ANTHROPIC_BASE_URL = `http://127.0.0.1:${port}`;
process.env.ANTHROPIC_API_KEY = 'stub-key-not-a-real-credential';

const { askClaude, aiConfigured, assessForAdmin } = await import('../src/lib/ai-claude.ts');

const KINDS = [
  { kind: 'add_canvas_card', title_ar: 'يضيف بطاقة', detail_ar: null,
    permission: 'act', refusal_ar: null, is_enabled: true, sort_order: 5 },
  { kind: 'update_bio', title_ar: 'يكتب نبذتك', detail_ar: null,
    permission: 'act', refusal_ar: null, is_enabled: true, sort_order: 8 },
  { kind: 'send_money', title_ar: 'إرسال أموال', detail_ar: null,
    permission: 'restricted', refusal_ar: 'المساعد لا يحرّك مالًا بأي حال.', is_enabled: true, sort_order: 21 },
];

const call = (extra = {}) => askClaude({
  context: { me: { name: 'سارة يوسف' }, page: { kind: 'canvas', title: 'Lean' } },
  history: [{ role: 'user', content: 'مرحباً' }, { role: 'assistant', content: 'أهلاً' }],
  prompt: 'أكمل هذه اللوحة',
  kinds: KINDS,
  ...extra,
});

let passed = 0;
const ok = (label) => { console.log(`ok   ${label}`); passed += 1; };

// 1 — the request the SDK actually puts on the wire
script = message({
  text: 'اقترحت بطاقة واحدة للخانة الفارغة.',
  tools: [{ kind: 'add_canvas_card', summary_ar: 'أضيف بطاقة إلى خانة الحل',
            params: { canvas_id: 'c1', block: 'solution', body: 'تطبيق يسجّل الزيارة صوتياً' } }],
  stopReason: 'tool_use',
});

let answer = await call();

assert.equal(captured.model, 'claude-opus-5');
assert.deepEqual(captured.thinking, { type: 'adaptive' });
assert.deepEqual(captured.output_config, { effort: 'medium' });
assert.equal(captured.stream, true);
assert.equal(captured.max_tokens, 4096);
assert.equal(captured.budget_tokens, undefined);
ok('1 the request carries the model, adaptive thinking, effort and streaming — and no budget_tokens');

assert.equal(captured.tools.length, 1);
assert.equal(captured.tools[0].name, 'propose_action');
assert.equal(captured.tools[0].eager_input_streaming, true);
ok('2 the one client tool streams its input eagerly');

assert.deepEqual(
  captured.tools[0].input_schema.properties.kind.enum,
  ['add_canvas_card', 'update_bio'],
);
ok('3 and the restricted kind is not even offered to the model');

assert.ok(captured.system.includes('المساعد لا يحرّك مالًا بأي حال.'));
assert.ok(captured.system.includes('سارة يوسف'));
ok('4 the refusal and the caller-scoped context are both in the system prompt');

assert.equal(captured.messages.length, 3);
assert.equal(captured.messages.at(-1).content, 'أكمل هذه اللوحة');
ok('5 the history is replayed and the question is the last turn');

// 2 — what comes back
assert.equal(answer.error_ar, null);
assert.equal(answer.text, 'اقترحت بطاقة واحدة للخانة الفارغة.');
assert.equal(answer.proposals.length, 1);
assert.equal(answer.proposals[0].kind, 'add_canvas_card');
assert.equal(answer.proposals[0].params.block, 'solution');
ok('6 the text and the proposal are read back off the stream');

// 3 — a proposal the model should not have made
script = message({
  text: 'حسناً.',
  tools: [{ kind: 'send_money', summary_ar: 'أحوّل المبلغ', params: { amount: 100 } }],
  stopReason: 'tool_use',
});
answer = await call();
assert.equal(answer.proposals.length, 0);
ok('7 a restricted kind the model reached for anyway is dropped before it is stored');

// 4 — malformed input from eager streaming
script = message({
  text: 'حسناً.',
  tools: [{ kind: 'add_canvas_card', params: {} }, { summary_ar: 'بلا نوع', params: {} }],
  stopReason: 'tool_use',
});
answer = await call();
assert.equal(answer.proposals.length, 0);
ok('8 a proposal missing its summary or its kind is dropped, not repaired');

// 5 — a turn cut off mid tool input
script = message({
  text: 'حسناً.',
  tools: [{ kind: 'update_bio', summary_ar: 'أكتب نبذتك', params: { bio: 'نص' } }],
  stopReason: 'max_tokens',
});
answer = await call();
assert.equal(answer.proposals.length, 0);
ok('9 nothing is proposed from a turn that ran out of tokens');

// 6 — AI Assist for the administration: a reading, never a decision
script = message({
  text: '',
  toolName: 'record_assessment',
  tools: [{ summary_ar: 'يدّعي المستخدم أنه دفع 25$ والدفعة قيد المراجعة.', evidence: ['إيصال مرفق', 'الحجز TM-821'],
            next_step_ar: 'تحقق من الدفعة يدوياً.', category: 'payment', confidence: 92 }],
  stopReason: 'tool_use',
});
let assessed = await assessForAdmin({
  kind: 'ticket',
  facts: { code: 'TM-10482', category: 'payment' },
  conversation: [{ author: 'user', body: 'دفعت ولم يتأكد الحجز' }],
});
assert.deepEqual(captured.tool_choice, { type: 'tool', name: 'record_assessment' });
assert.equal(captured.thinking, undefined);
assert.equal(captured.tools[0].eager_input_streaming, true);
assert.ok(captured.system.includes('القرار للإدارة وحدها'));
ok('11 AI Assist forces its one recording tool, streams it eagerly, and is told the decision is not its own');

assert.equal(assessed.error_ar, null);
assert.equal(assessed.assessment.category, 'payment');
assert.equal(assessed.assessment.confidence, 92);
assert.deepEqual(assessed.assessment.evidence, ['إيصال مرفق', 'الحجز TM-821']);
ok('12 its reading comes back as summary, evidence, next step, category and confidence');

script = message({
  text: '',
  toolName: 'record_assessment',
  tools: [{ summary_ar: 'ملخص', evidence: [], next_step_ar: 'خطوة', category: 'not-a-category', confidence: 250 }],
  stopReason: 'tool_use',
});
assessed = await assessForAdmin({ kind: 'case', facts: {}, conversation: [] });
assert.equal(assessed.assessment.category, null);
assert.equal(assessed.assessment.confidence, 100);
ok('13 an unknown category is dropped and a confidence is held to 0–100');

script = message({ text: '', toolName: 'record_assessment', tools: [{ evidence: [] }], stopReason: 'tool_use' });
assessed = await assessForAdmin({ kind: 'case', facts: {}, conversation: [] });
assert.equal(assessed.assessment, null);
assert.ok(assessed.error_ar);
ok('14 a reading missing its summary is refused, not repaired');

// 7 — no key at all
delete process.env.ANTHROPIC_API_KEY;
assert.equal(aiConfigured(), false);
answer = await call();
assert.equal(answer.proposals.length, 0);
assert.ok(answer.error_ar.includes('ANTHROPIC_API_KEY'));
assessed = await assessForAdmin({ kind: 'case', facts: {}, conversation: [] });
assert.equal(assessed.assessment, null);
assert.ok(assessed.error_ar.includes('ANTHROPIC_API_KEY'));
ok('10 without a key it says so plainly instead of pretending — the assistant and AI Assist alike');

server.close();
console.log(`\n${passed} assistant provider checks passed against the stub`);
