import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../server.mjs';
import { validateDraft } from '../server/debrief.mjs';

const transcript = 'I compared two responses. The second request returned 403. I learned to check authorization.';
const draft = { summary: 'Compared responses in a lab.', steps: [{ text: 'Compared responses.', evidence: 'I compared two responses.' }], failedAttempts: [], lessons: [], suggestions: ['Check the test scope.'], gaps: ['Objective'], question: 'What was the objective?' };
async function fixture(t, options = {}) {
  const app = createApp(options); await new Promise(r => app.listen(0, '127.0.0.1', r));
  t.after(() => new Promise(r => app.close(r)));
  return (path, init) => fetch(`http://127.0.0.1:${app.address().port}${path}`, init);
}
const env = { ASSEMBLYAI_API_KEY: 'test-provider-key', APP_ACCESS_TOKEN: 'test-service-password' };
const request = (body, extra = {}) => ({ method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Ledger-Token': env.APP_ACCESS_TOKEN, ...extra }, body: JSON.stringify(body) });

test('server fails closed without credentials and never serves server files', async t => {
  const call = await fixture(t, { env: {} });
  assert.equal((await call('/')).status, 200);
  for (const path of ['/server.mjs', '/.env', '/server/debrief.mjs', '/package.json']) assert.equal((await call(path)).status, 404);
  assert.equal((await call('/api/voice/token', request({}))).status, 503);
});
test('authentication and origin checks prevent unauthorized paid requests', async t => {
  let calls = 0;
  const call = await fixture(t, { env, upstreamFetch: async () => { calls++; throw new Error(); } });
  assert.equal((await call('/api/debrief', request({ transcript }, { 'X-Ledger-Token': 'wrong' }))).status, 401);
  assert.equal((await call('/api/debrief', request({ transcript }, { Origin: 'https://untrusted.example' }))).status, 403);
  assert.equal(calls, 0);
});
test('streaming token is short-lived and permanent key stays server-side', async t => {
  const call = await fixture(t, { env, upstreamFetch: async (url, options) => {
    assert.match(url, /expires_in_seconds=60&max_session_duration_seconds=600/);
    assert.equal(options.headers.authorization, env.ASSEMBLYAI_API_KEY);
    return Response.json({ token: 'temporary-token', secret: env.ASSEMBLYAI_API_KEY });
  } });
  const result = await call('/api/voice/token', request({}));
  assert.deepEqual(await result.json(), { token: 'temporary-token' });
});
test('review carries questions and evidence through the actual route', async t => {
  const call = await fixture(t, { env, upstreamFetch: async (url, options) => {
    assert.equal(url, 'https://llm-gateway.assemblyai.com/v1/chat/completions');
    const body = JSON.parse(options.body);
    assert.equal(JSON.parse(body.messages[1].content).transcript, transcript);
    return Response.json({ choices: [{ message: { content: JSON.stringify(draft) } }] });
  } });
  const result = await call('/api/debrief', request({ transcript, questions: ['one', 'two', 'three'], sources: ['https://example.org/lab'] }));
  assert.equal(result.status, 200);
  const data = await result.json(); assert.equal(data.draft.question, '');
  assert.deepEqual(data.draft.steps, draft.steps);
});
test('fabricated evidence is rejected rather than silently saved', () => {
  assert.throws(() => validateDraft({ ...draft, steps: [{ text: 'Got administrator.', evidence: 'I got administrator.' }] }, transcript), /evidence missing/);
  assert.deepEqual(validateDraft(draft, transcript).steps, draft.steps);
});
test('invalid input is rejected before any provider call', async t => {
  let calls = 0;
  const call = await fixture(t, { env, upstreamFetch: async () => { calls++; throw new Error(); } });
  for (const body of [{ transcript: '' }, { transcript: 'x'.repeat(24001) }, { transcript, sources: ['javascript:alert(1)'] }]) {
    assert.equal((await call('/api/debrief', request(body))).status, 400);
  }
  assert.equal(calls, 0);
});
test('provider failures do not expose response bodies or keys', async t => {
  const call = await fixture(t, { env, upstreamFetch: async () => new Response('secret-provider-diagnostic', { status: 401 }) });
  const result = await call('/api/debrief', request({ transcript }));
  assert.equal(result.status, 502); const body = await result.text();
  assert.ok(!body.includes('secret-provider-diagnostic')); assert.ok(!body.includes(env.ASSEMBLYAI_API_KEY));
});
