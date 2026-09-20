import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

const client = await readFile(new URL('../debrief.js', import.meta.url), 'utf8');
function harness({ failSave = false } = {}) {
  const rows = new Map(), elements = new Map(); let nextId = 0;
  const sandbox = {
    console, URL, Map, setTimeout, clearTimeout, SpeechSynthesisUtterance: class {},
    window: { addEventListener() {} }, document: { querySelectorAll: () => [] },
    meta: {}, uid: prefix => `${prefix}-${++nextId}`, nowIso: () => '2026-09-20T12:00:00Z',
    esc: value => String(value || '').replaceAll('<', '&lt;'),
    $: id => { if (!elements.has(id)) elements.set(id, {}); return elements.get(id); },
    setMeta: async (key, value) => { sandbox.meta[key] = structuredClone(value); },
    recordsOf: type => [...rows.values()].filter(r => r.type === type),
    commonRecord: (raw, type) => ({ id: raw.id || `${type}-${++nextId}`, type, ...raw }),
    loadModel: async () => {}, render: () => {},
    db: { transaction() {
      const pending = [];
      const tx = { objectStore: name => ({ put: value => pending.push([name, structuredClone(value)]) }) };
      queueMicrotask(() => {
        if (failSave) { tx.error = new Error('Disk full'); tx.onabort(); return; }
        for (const [name, value] of pending) name === 'records' ? rows.set(value.id, value) : sandbox.meta[value.key] = value.value;
        tx.oncomplete();
      }); return tx;
    } }
  };
  vm.createContext(sandbox); vm.runInContext(client, sandbox);
  return { rows, elements, sandbox, run: code => vm.runInContext(code, sandbox) };
}
const setup = `debriefState = { id: 'test-session', title: 'Practice lab', transcript: 'The response was 403.', sourceText: 'https://example.org/lab', questions: ['What happened?'], saved: false, draft: { summary: 'An authorization test.', steps: [{ text: 'Observed 403.', evidence: 'The response was 403.' }], failedAttempts: [], lessons: [], gaps: ['Objective'], question: '', suggestions: ['Review access controls.'] } };`;

test('saving preserves original evidence, links records, and is idempotent', async () => {
  const h = harness(); h.run(setup); await h.run('saveDebrief()');
  assert.equal(h.rows.size, 4);
  const session = [...h.rows.values()].find(x => x.type === 'session');
  assert.equal(session.originalTranscript, 'The response was 403.');
  assert.equal(session.completedAt, '');
  assert.equal(session.agentSuggestions[0], 'Review access controls.');
  assert.ok(h.rows.has(session.sourceIds[0]));
  assert.match(session.steps[0], /Evidence:.*403/);
  await h.run('saveDebrief()'); assert.equal(h.rows.size, 4);
  assert.ok(h.sandbox.meta.voiceDebrief.saved);
});
test('failed save remains retryable without partial records', async () => {
  const h = harness({ failSave: true }); h.run(setup); await h.run('saveDebrief()');
  assert.equal(h.rows.size, 0); assert.equal(h.run('sessionData().saved'), false);
  assert.equal(h.run('debriefBusy()'), false); assert.match(h.run('debriefMessage'), /Disk full/);
});
test('editing invalidates the old draft and password is not persisted', () => {
  const h = harness(); h.run(setup); h.run("debriefAccess = 'private-password'; sessionData().transcript += ' More detail.'; invalidateDebrief();");
  assert.equal(h.run('sessionData().draft'), null);
  assert.equal(h.elements.get('voiceSave').disabled, true);
  assert.ok(!JSON.stringify(h.sandbox.meta).includes('private-password'));
  assert.match(h.sandbox.meta.voiceDebrief.transcript, /More detail/);
});
test('rendered model content is escaped', () => {
  const h = harness(); h.run(setup); h.run("sessionData().draft.summary = '<script>alert(1)</script>'");
  const html = h.run('renderDebriefDraft()'); assert.ok(!html.includes('<script>')); assert.ok(html.includes('&lt;script>'));
});
test('PCM capture clips samples and flushes final audio', async () => {
  const sent = []; let Processor;
  const scope = { AudioWorkletProcessor: class { port = { postMessage: value => sent.push(value) }; }, registerProcessor: (_, Type) => { Processor = Type; }, Int16Array, Math };
  vm.runInNewContext(await readFile(new URL('../pcm-worklet.js', import.meta.url), 'utf8'), scope);
  const processor = new Processor(); processor.process([[new Float32Array([-2, -.5, 0, .5, 2])]]);
  processor.port.onmessage({ data: 'flush' });
  const pcm = new Int16Array(sent[0]); assert.deepEqual([...pcm.slice(0, 5)], [-32768, -16384, 0, 16383, 32767]);
  assert.equal(pcm.length, 800); assert.equal(sent[1].flushed, true);
});
