const DB_NAME = 'security-study-ledger';
const DB_VERSION = 1;
const SCHEMA_VERSION = 1;
const MAX_ATTACHMENT_BYTES = 2 * 1024 * 1024;

let db;
let records = [];
let meta = {};
let activeView = 'debrief';
let searchQuery = '';
let recognition = null;

const $ = (id) => document.getElementById(id);
const clone = (value) => JSON.parse(JSON.stringify(value));
const uid = (prefix = 'record') => `${prefix}-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`}`;
const nowIso = () => new Date().toISOString();
const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[char]));

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains('records')) {
        const store = database.createObjectStore('records', { keyPath: 'id' });
        store.createIndex('type', 'type', { unique: false });
        store.createIndex('updatedAt', 'updatedAt', { unique: false });
        store.createIndex('status', 'status', { unique: false });
      }
      if (!database.objectStoreNames.contains('meta')) database.createObjectStore('meta', { keyPath: 'key' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Could not open local storage.'));
  });
}

function storeRequest(storeName, mode, operation) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, mode);
    const store = transaction.objectStore(storeName);
    let request;
    try { request = operation(store); }
    catch (error) { reject(error); return; }
    transaction.oncomplete = () => resolve(request?.result);
    transaction.onerror = () => reject(transaction.error || request?.error || new Error('Storage operation failed.'));
    transaction.onabort = () => reject(transaction.error || new Error('Storage operation aborted.'));
  });
}

const dbPut = (store, value) => storeRequest(store, 'readwrite', (s) => s.put(clone(value)));
const dbDelete = (store, key) => storeRequest(store, 'readwrite', (s) => s.delete(key));
const dbGetAll = (store) => storeRequest(store, 'readonly', (s) => s.getAll());
const dbClear = (store) => storeRequest(store, 'readwrite', (s) => s.clear());

async function loadModel() {
  const [recordRows, metaRows] = await Promise.all([dbGetAll('records'), dbGetAll('meta')]);
  records = recordRows.sort((a, b) => String(b.updatedAt || b.createdAt || '').localeCompare(String(a.updatedAt || a.createdAt || '')));
  meta = Object.fromEntries(metaRows.map((row) => [row.key, row.value]));
}

async function setMeta(key, value) {
  await dbPut('meta', { key, value: clone(value) });
  meta[key] = clone(value);
}

function normalizeTags(tags) {
  if (!Array.isArray(tags)) return [];
  return [...new Set(tags.map((tag) => String(tag).trim().toLowerCase()).filter(Boolean))].slice(0, 50);
}

function commonRecord(raw, type, existing = null) {
  const createdAt = existing?.createdAt || raw.createdAt || nowIso();
  return {
    ...(existing || {}),
    ...clone(raw),
    id: existing?.id || raw.id || uid(type),
    type,
    title: String(raw.title || existing?.title || 'Untitled').trim(),
    domain: String(raw.domain || existing?.domain || 'general').trim().toLowerCase(),
    tags: normalizeTags(raw.tags ?? existing?.tags ?? []),
    createdAt,
    updatedAt: nowIso(),
  };
}

async function saveRecord(record) {
  await dbPut('records', record);
  await loadModel();
  render();
  return clone(record);
}

function byId(id) {
  return records.find((record) => record.id === id) || null;
}

function recordsOf(type) {
  return records.filter((record) => record.type === type);
}

function sourceRecords(ids = []) {
  return ids.map(byId).filter((record) => record?.type === 'source');
}

function truncate(value, length = 190) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  return text.length > length ? `${text.slice(0, length - 1)}…` : text;
}

function displayDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'short', day: 'numeric' }).format(date);
}

function recordText(record) {
  const safe = { ...record, attachments: (record.attachments || []).map(({ dataUrl, ...rest }) => rest) };
  return JSON.stringify(safe).toLowerCase();
}

function matchesSearch(record) {
  const query = searchQuery.trim().toLowerCase();
  if (!query) return true;
  return query.split(/\s+/).every((token) => recordText(record).includes(token));
}

function sanitizeForAgent(record) {
  const clean = clone(record);
  if (Array.isArray(clean.attachments)) {
    clean.attachments = clean.attachments.map(({ dataUrl, ...attachment }) => ({ ...attachment, storedLocally: Boolean(dataUrl) }));
  }
  return clean;
}

function renderStats() {
  const counts = {
    inbox: records.filter((record) => record.type === 'capture' && record.status !== 'processed').length,
    knowledge: recordsOf('note').length,
    challenges: recordsOf('challenge').length,
    sources: recordsOf('source').length,
  };
  $('stats').innerHTML = [
    ['Inbox', counts.inbox],
    ['Notes', counts.knowledge],
    ['Practice', counts.challenges],
    ['Sources', counts.sources],
  ].map(([label, value]) => `<div class="stat"><strong>${value}</strong><span>${label}</span></div>`).join('');
}

const viewMeta = {
  debrief: ['Guided study session', 'Debrief'],
  inbox: ['Staging queue', 'Inbox'],
  knowledge: ['Structured memory', 'Notes'],
  challenges: ['Practice ledger', 'Practice'],
  sources: ['Evidence trail', 'Sources'],
};

function card(record, description = '') {
  const tags = [record.domain, ...(record.tags || [])].filter(Boolean).slice(0, 5);
  const badge = record.type === 'capture' && record.status !== 'processed' ? '<span class="badge accent">unprocessed</span>' : '';
  return `<button class="record-card" type="button" data-open-record="${esc(record.id)}">
    <div>
      <span class="eyebrow">${esc(record.type)}</span>
      <h3>${esc(record.title)}</h3>
      <p>${esc(truncate(description || record.summary || record.content || record.rawText || record.overview || record.notes || record.url || 'No summary yet.'))}</p>
      <div class="record-meta">${badge}${tags.map((tag) => `<span class="badge">${esc(tag)}</span>`).join('')}</div>
    </div>
    <span class="record-date">${esc(displayDate(record.updatedAt || record.createdAt))}</span>
  </button>`;
}

function emptyState(message) {
  return `<div class="empty-state">${esc(message)}</div>`;
}

function renderInbox() {
  const captures = records.filter((record) => record.type === 'capture' && matchesSearch(record));
  const pending = captures.filter((record) => record.status !== 'processed');
  const processed = captures.filter((record) => record.status === 'processed');
  return `<section class="capture-panel">
    <p class="eyebrow">Raw capture</p>
    <h2>Drop material. Structure it later.</h2>
    <p>Paste notes, narrate a thought, attach screenshots or files, and add the source URL if there is one. The agent can turn these captures into structured records through WebMCP.</p>
    <form id="captureForm">
      <div class="capture-grid">
        <textarea id="captureText" name="text" placeholder="Narration, lecture notes, lab observations, worked problems, copied documentation…" required></textarea>
        <div class="capture-side">
          <input id="captureTitle" name="title" placeholder="Optional title" />
          <input id="captureUrl" name="url" type="url" placeholder="Source URL" />
          <input id="captureDomain" name="domain" placeholder="Subject e.g. calculus, web security, biology" />
          <input id="captureTags" name="tags" placeholder="Tags, comma separated" />
          <label class="file-field">Attachments <input id="captureFiles" type="file" multiple /></label>
        </div>
      </div>
      <div class="capture-actions">
        <button class="primary-button" type="submit">Stage capture</button>
        <button id="narrateButton" class="secondary-button" type="button">Narrate</button>
        <span id="captureHelper" class="helper">Files up to 2 MB each are stored locally in this browser.</span>
      </div>
    </form>
  </section>
  <div class="section-head"><h2>Pending</h2><span>${pending.length}</span></div>
  <div class="list">${pending.length ? pending.map((record) => card(record)).join('') : emptyState('Nothing waiting for the agent.')}</div>
  ${processed.length ? `<div class="section-head"><h2>Processed</h2><span>${processed.length}</span></div><div class="list">${processed.map((record) => card(record)).join('')}</div>` : ''}`;
}

function renderKnowledge() {
  const notes = records.filter((record) => record.type === 'note' && matchesSearch(record));
  return `<div class="list">${notes.length ? notes.map((record) => card(record, record.summary || record.abstraction || record.content)).join('') : emptyState('No structured notes yet. Ask the agent to process your inbox.')}</div>`;
}

function renderChallenges() {
  const challenges = records.filter((record) => record.type === 'challenge' && matchesSearch(record));
  const solves = records.filter((record) => record.type === 'solve' && matchesSearch(record));
  return `<div class="section-head"><h2>Practice items</h2><span>${challenges.length}</span></div>
    <div class="list">${challenges.length ? challenges.map((record) => card(record, [record.platform, record.category, record.objective].filter(Boolean).join(' · '))).join('') : emptyState('No practice items yet.')}</div>
    <div class="section-head"><h2>Study sessions</h2><span>${solves.length}</span></div>
    <div class="list">${solves.length ? solves.map((record) => card(record, record.overview || (record.lessons || []).join(' '))).join('') : emptyState('No study sessions yet.')}</div>`;
}

function renderSources() {
  const sources = records.filter((record) => record.type === 'source' && matchesSearch(record));
  return `<div class="list">${sources.length ? sources.map((record) => card(record, [record.author, record.publisher, record.url, record.notes].filter(Boolean).join(' · '))).join('') : emptyState('No sources yet. Structured notes should keep their evidence trail here.')}</div>`;
}

function render() {
  const [eyebrow, title] = viewMeta[activeView];
  $('viewEyebrow').textContent = eyebrow;
  $('viewTitle').textContent = title;
  document.querySelectorAll('.tab').forEach((button) => {
    const active = button.dataset.view === activeView;
    button.classList.toggle('active', active);
    button.toggleAttribute('aria-current', active);
  });
  renderStats();
  const renderers = { debrief: renderDebrief, inbox: renderInbox, knowledge: renderKnowledge, challenges: renderChallenges, sources: renderSources };
  $('content').innerHTML = renderers[activeView]();
  if (activeView === 'inbox') bindCaptureForm();
  if (activeView === 'debrief') bindDebrief();
  $('searchInput').closest('label').hidden = activeView === 'debrief';
}

function listSection(title, items, ordered = false, code = false) {
  if (!Array.isArray(items) || !items.length) return '';
  const tag = ordered ? 'ol' : 'ul';
  const body = code
    ? items.map((item) => `<pre>${esc(typeof item === 'string' ? item : JSON.stringify(item, null, 2))}</pre>`).join('')
    : `<${tag}>${items.map((item) => `<li>${esc(typeof item === 'string' ? item : JSON.stringify(item))}</li>`).join('')}</${tag}>`;
  return `<section class="record-section"><h3>${esc(title)}</h3>${body}</section>`;
}

function textSection(title, value, code = false) {
  if (value === undefined || value === null || value === '') return '';
  return `<section class="record-section"><h3>${esc(title)}</h3>${code ? `<pre>${esc(typeof value === 'string' ? value : JSON.stringify(value, null, 2))}</pre>` : `<p>${esc(String(value))}</p>`}</section>`;
}

function sourceSection(record) {
  const linked = sourceRecords(record.sourceIds || record.source_ids || []);
  if (!linked.length) return '';
  return `<section class="record-section"><h3>Sources</h3>${linked.map((source) => {
    const label = source.title || source.url || source.id;
    return source.url
      ? `<a class="source-link" href="${esc(source.url)}" target="_blank" rel="noreferrer">${esc(label)}</a>`
      : `<div class="source-link">${esc(label)}</div>`;
  }).join('')}</section>`;
}

function attachmentSection(record) {
  const attachments = Array.isArray(record.attachments) ? record.attachments : [];
  if (!attachments.length) return '';
  return `<section class="record-section"><h3>Attachments</h3><div class="attachment-grid">${attachments.map((attachment) => {
    const image = attachment.dataUrl?.startsWith('data:image/') ? `<img src="${esc(attachment.dataUrl)}" alt="${esc(attachment.name || 'attachment')}" />` : '';
    const link = attachment.dataUrl ? `<a href="${esc(attachment.dataUrl)}" download="${esc(attachment.name || 'attachment')}">${esc(attachment.name || 'Download attachment')}</a>` : `<span>${esc(attachment.name || 'Attachment')}</span>`;
    return `<div class="attachment">${image}${link}<div class="muted">${esc(attachment.type || '')}</div></div>`;
  }).join('')}</div></section>`;
}

function renderRecordBody(record) {
  const shared = sourceSection(record) + attachmentSection(record);
  if (record.type === 'capture') {
    return textSection('Raw material', record.rawText)
      + textSection('Source URL', record.url)
      + shared
      + listSection('Generated records', record.generatedRecordIds || [])
      + textSection('Status', record.status || 'unprocessed');
  }
  if (record.type === 'note') {
    return textSection('Summary', record.summary)
      + textSection('Abstraction', record.abstraction)
      + textSection('Detailed notes', record.content)
      + listSection('Patterns', record.patterns || [])
      + listSection('Commands / syntax', record.commands || [], false, true)
      + shared;
  }
  if (record.type === 'challenge') {
    return textSection('Course / platform', record.platform)
      + textSection('Category', record.category)
      + textSection('Difficulty', record.difficulty)
      + textSection('Status', record.status)
      + textSection('Objective', record.objective)
      + textSection('Notes', record.notes)
      + listSection('Flags / markers', record.flags || [])
      + shared;
  }
  if (record.type === 'solve') {
    const challenge = byId(record.challengeId || record.challenge_id);
    return textSection('Practice item', challenge?.title || record.challengeId || record.challenge_id)
      + textSection('Overview', record.overview)
      + listSection('Steps', record.steps || [], true)
      + listSection('Commands', record.commands || [], false, true)
      + listSection('Payloads', record.payloads || [], false, true)
      + listSection('Failed attempts', record.failedAttempts || record.failed_attempts || [], true)
      + listSection('Lessons', record.lessons || [])
      + listSection('Artifacts', record.artifacts || [], false, true)
      + listSection('Open questions', record.openQuestions || [])
      + listSection('Agent suggestions — unverified', record.agentSuggestions || [])
      + textSection('Original narration', record.originalTranscript)
      + textSection('Review status', record.reviewStatus)
      + shared;
  }
  if (record.type === 'source') {
    return textSection('URL', record.url)
      + textSection('Author', record.author)
      + textSection('Publisher', record.publisher)
      + textSection('Citation', record.citation)
      + textSection('Notes', record.notes)
      + textSection('Accessed', record.accessedAt || record.accessed_at);
  }
  return textSection('Record', record, true);
}

function openRecord(id) {
  const record = byId(id);
  if (!record) return;
  $('recordType').textContent = [record.type, record.domain].filter(Boolean).join(' · ');
  $('recordTitle').textContent = record.title;
  $('recordBody').innerHTML = renderRecordBody(record) + `<div class="dialog-actions"><button class="danger-button" type="button" data-delete-record="${esc(record.id)}">Delete record</button></div>`;
  $('recordDialog').showModal();
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error || new Error(`Could not read ${file.name}.`));
    reader.readAsDataURL(file);
  });
}

async function filesToAttachments(fileList) {
  const files = [...fileList];
  const attachments = [];
  for (const file of files) {
    if (file.size > MAX_ATTACHMENT_BYTES) throw new Error(`${file.name} is larger than 2 MB.`);
    attachments.push({
      id: uid('attachment'),
      name: file.name,
      type: file.type || 'application/octet-stream',
      size: file.size,
      dataUrl: await readFileAsDataUrl(file),
    });
  }
  return attachments;
}

function bindCaptureForm() {
  const form = $('captureForm');
  if (!form) return;
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const helper = $('captureHelper');
    try {
      helper.textContent = 'Saving locally…';
      const rawText = $('captureText').value.trim();
      if (!rawText) throw new Error('Add some raw material first.');
      const attachments = await filesToAttachments($('captureFiles').files);
      await createCapture({
        title: $('captureTitle').value.trim(),
        text: rawText,
        url: $('captureUrl').value.trim(),
        domain: $('captureDomain').value.trim(),
        tags: $('captureTags').value.split(',').map((tag) => tag.trim()).filter(Boolean),
        attachments,
      });
      form.reset();
      helper.textContent = 'Capture staged. The agent can read it through WebMCP.';
    } catch (error) {
      helper.textContent = error.message;
    }
  });

  const narrate = $('narrateButton');
  const SpeechRecognition = globalThis.SpeechRecognition || globalThis.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    narrate.hidden = true;
    return;
  }
  narrate.addEventListener('click', () => {
    if (recognition) {
      recognition.stop();
      return;
    }
    recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    let stable = $('captureText').value.trim();
    recognition.onstart = () => { narrate.classList.add('recording'); narrate.textContent = 'Stop narration'; };
    recognition.onresult = (event) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const text = event.results[i][0].transcript;
        if (event.results[i].isFinal) stable = `${stable} ${text}`.trim();
        else interim += text;
      }
      $('captureText').value = `${stable}${interim ? ` ${interim}` : ''}`.trim();
    };
    recognition.onerror = () => {};
    recognition.onend = () => {
      recognition = null;
      narrate.classList.remove('recording');
      narrate.textContent = 'Narrate';
    };
    recognition.start();
  });
}

async function createCapture({ title = '', text, url = '', domain = 'general', tags = [], attachments = [] }) {
  if (!String(text || '').trim()) throw new Error('text is required.');
  const record = commonRecord({
    title: title || truncate(text, 70) || 'Raw capture',
    domain,
    tags,
    rawText: String(text).trim(),
    url: String(url || '').trim(),
    attachments: Array.isArray(attachments) ? attachments : [],
    status: 'unprocessed',
    generatedRecordIds: [],
  }, 'capture');
  return saveRecord(record);
}

async function upsertSource({ source }) {
  if (!source || typeof source !== 'object') throw new Error('source is required.');
  const existing = source.id ? byId(source.id) : recordsOf('source').find((item) => source.url && item.url === source.url);
  const record = commonRecord({
    ...source,
    title: source.title || source.url || existing?.title || 'Untitled source',
    url: String(source.url || existing?.url || '').trim(),
    author: source.author || existing?.author || '',
    publisher: source.publisher || existing?.publisher || '',
    citation: source.citation || existing?.citation || '',
    notes: source.notes || existing?.notes || '',
    accessedAt: source.accessedAt || source.accessed_at || existing?.accessedAt || nowIso(),
  }, 'source', existing);
  return saveRecord(record);
}

async function upsertNote({ note }) {
  if (!note || typeof note !== 'object') throw new Error('note is required.');
  const existing = note.id ? byId(note.id) : null;
  const record = commonRecord({
    ...note,
    title: note.title || existing?.title || 'Untitled note',
    topic: note.topic || existing?.topic || '',
    summary: note.summary || existing?.summary || '',
    abstraction: note.abstraction || existing?.abstraction || '',
    content: note.content || existing?.content || '',
    patterns: Array.isArray(note.patterns) ? note.patterns : (existing?.patterns || []),
    commands: Array.isArray(note.commands) ? note.commands : (existing?.commands || []),
    sourceIds: Array.isArray(note.sourceIds || note.source_ids) ? (note.sourceIds || note.source_ids) : (existing?.sourceIds || []),
    challengeIds: Array.isArray(note.challengeIds || note.challenge_ids) ? (note.challengeIds || note.challenge_ids) : (existing?.challengeIds || []),
    relatedIds: Array.isArray(note.relatedIds || note.related_ids) ? (note.relatedIds || note.related_ids) : (existing?.relatedIds || []),
  }, 'note', existing);
  return saveRecord(record);
}

async function upsertChallenge({ challenge }) {
  if (!challenge || typeof challenge !== 'object') throw new Error('challenge is required.');
  const existing = challenge.id ? byId(challenge.id) : null;
  const record = commonRecord({
    ...challenge,
    title: challenge.title || existing?.title || 'Untitled practice item',
    platform: challenge.platform || existing?.platform || '',
    url: challenge.url || existing?.url || '',
    category: challenge.category || existing?.category || '',
    difficulty: challenge.difficulty || existing?.difficulty || '',
    status: challenge.status || existing?.status || 'active',
    objective: challenge.objective || existing?.objective || '',
    notes: challenge.notes || existing?.notes || '',
    flags: Array.isArray(challenge.flags) ? challenge.flags : (existing?.flags || []),
    sourceIds: Array.isArray(challenge.sourceIds || challenge.source_ids) ? (challenge.sourceIds || challenge.source_ids) : (existing?.sourceIds || []),
  }, 'challenge', existing);
  return saveRecord(record);
}

async function recordSolve({ solve }) {
  if (!solve || typeof solve !== 'object') throw new Error('solve is required.');
  const challengeId = solve.challengeId || solve.challenge_id || null;
  if (challengeId && byId(challengeId)?.type !== 'challenge') throw new Error('challengeId must identify an existing challenge.');
  const existing = solve.id ? byId(solve.id) : null;
  const challenge = challengeId ? byId(challengeId) : null;
  const record = commonRecord({
    ...solve,
    title: solve.title || existing?.title || (challenge ? `${challenge.title} — session` : 'Study session'),
    challengeId,
    overview: solve.overview || existing?.overview || '',
    steps: Array.isArray(solve.steps) ? solve.steps : (existing?.steps || []),
    commands: Array.isArray(solve.commands) ? solve.commands : (existing?.commands || []),
    payloads: Array.isArray(solve.payloads) ? solve.payloads : (existing?.payloads || []),
    failedAttempts: Array.isArray(solve.failedAttempts || solve.failed_attempts) ? (solve.failedAttempts || solve.failed_attempts) : (existing?.failedAttempts || []),
    lessons: Array.isArray(solve.lessons) ? solve.lessons : (existing?.lessons || []),
    artifacts: Array.isArray(solve.artifacts) ? solve.artifacts : (existing?.artifacts || []),
    sourceIds: Array.isArray(solve.sourceIds || solve.source_ids) ? (solve.sourceIds || solve.source_ids) : (existing?.sourceIds || []),
    completedAt: solve.completedAt || solve.completed_at || existing?.completedAt || nowIso(),
  }, 'solve', existing);
  return saveRecord(record);
}

async function markInboxProcessed({ capture_id, generated_record_ids = [] }) {
  const capture = byId(capture_id);
  if (!capture || capture.type !== 'capture') throw new Error('capture_id must identify an inbox capture.');
  const updated = { ...capture, status: 'processed', generatedRecordIds: [...new Set(generated_record_ids)], updatedAt: nowIso() };
  return saveRecord(updated);
}

async function linkRecords({ record_id, source_ids, challenge_ids, related_ids }) {
  const record = byId(record_id);
  if (!record) throw new Error('record_id not found.');
  const updated = {
    ...record,
    sourceIds: source_ids ? [...new Set(source_ids)] : (record.sourceIds || []),
    challengeIds: challenge_ids ? [...new Set(challenge_ids)] : (record.challengeIds || []),
    relatedIds: related_ids ? [...new Set(related_ids)] : (record.relatedIds || []),
    updatedAt: nowIso(),
  };
  return saveRecord(updated);
}

function getSecurityState({ scope = 'summary', limit = 100 } = {}) {
  const safeLimit = Math.max(1, Math.min(1000, Number(limit) || 100));
  if (scope === 'full') return { schemaVersion: SCHEMA_VERSION, records: records.slice(0, safeLimit).map(sanitizeForAgent) };
  if (scope === 'summary') {
    return {
      schemaVersion: SCHEMA_VERSION,
      totals: {
        inboxPending: records.filter((record) => record.type === 'capture' && record.status !== 'processed').length,
        notes: recordsOf('note').length,
        challenges: recordsOf('challenge').length,
        solves: recordsOf('solve').length,
        sources: recordsOf('source').length,
      },
      recent: records.slice(0, Math.min(safeLimit, 25)).map(sanitizeForAgent),
    };
  }
  return { records: records.filter((record) => record.type === scope).slice(0, safeLimit).map(sanitizeForAgent) };
}

function getInbox({ status = 'unprocessed', limit = 100 } = {}) {
  const safeLimit = Math.max(1, Math.min(500, Number(limit) || 100));
  return records
    .filter((record) => record.type === 'capture' && (status === 'all' || record.status === status || (!record.status && status === 'unprocessed')))
    .slice(0, safeLimit)
    .map(sanitizeForAgent);
}

function searchKnowledge({ query = '', types = [], domains = [], limit = 50 } = {}) {
  const terms = String(query).trim().toLowerCase().split(/\s+/).filter(Boolean);
  const wantedTypes = Array.isArray(types) ? types.map((item) => String(item).toLowerCase()) : [];
  const wantedDomains = Array.isArray(domains) ? domains.map((item) => String(item).toLowerCase()) : [];
  const safeLimit = Math.max(1, Math.min(500, Number(limit) || 50));
  return records
    .filter((record) => record.type !== 'capture')
    .filter((record) => !wantedTypes.length || wantedTypes.includes(record.type))
    .filter((record) => !wantedDomains.length || wantedDomains.includes(String(record.domain || '').toLowerCase()))
    .filter((record) => !terms.length || terms.every((term) => recordText(record).includes(term)))
    .slice(0, safeLimit)
    .map(sanitizeForAgent);
}

async function deleteRecord({ id }) {
  if (!byId(id)) throw new Error('Record not found.');
  await dbDelete('records', id);
  await loadModel();
  render();
  return { deleted: id };
}

function toolResult(data) {
  return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
}

async function registerWebMcp() {
  const modelContext = document.modelContext || navigator.modelContext;
  const status = $('webmcpStatus');
  if (!modelContext?.registerTool) {
    status.className = 'mcp-status unavailable';
    status.innerHTML = '<i></i><span>Agent tools unavailable</span>';
    return;
  }

  const tools = [
    {
      name: 'get_study_state',
      description: 'Read Study Ledger totals, recent records, or records of a specific type across any subject.',
      inputSchema: { type: 'object', properties: { scope: { type: 'string' }, limit: { type: 'number' } } },
      annotations: { readOnlyHint: true },
      execute: async (input = {}) => toolResult(getSecurityState(input)),
    },
    {
      name: 'get_security_state',
      description: 'Backward-compatible alias for the study ledger state. Read totals, recent records, or records of a specific type.',
      inputSchema: { type: 'object', properties: { scope: { type: 'string' }, limit: { type: 'number' } } },
      annotations: { readOnlyHint: true },
      execute: async (input = {}) => toolResult(getSecurityState(input)),
    },
    {
      name: 'get_inbox',
      description: 'Read raw material staged by the learner for later structuring. Use this before creating notes, sources, practice items, or study-session records from captured material.',
      inputSchema: { type: 'object', properties: { status: { type: 'string', enum: ['unprocessed', 'processed', 'all'] }, limit: { type: 'number' } } },
      annotations: { readOnlyHint: true },
      execute: async (input = {}) => toolResult(getInbox(input)),
    },
    {
      name: 'search_knowledge',
      description: 'Search structured notes, sources, practice items, and study-session records across any subject. CTFs and labs remain supported practice contexts.',
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string' },
          types: { type: 'array', items: { type: 'string', enum: ['note', 'source', 'challenge', 'solve'] } },
          domains: { type: 'array', items: { type: 'string' } },
          limit: { type: 'number' },
        },
      },
      annotations: { readOnlyHint: true },
      execute: async (input = {}) => toolResult(searchKnowledge(input)),
    },
    {
      name: 'capture_material',
      description: 'Stage raw text or a URL in the inbox. Use when information should be preserved before it is fully structured.',
      inputSchema: {
        type: 'object',
        properties: {
          title: { type: 'string' }, text: { type: 'string' }, url: { type: 'string' }, domain: { type: 'string' },
          tags: { type: 'array', items: { type: 'string' } },
        },
        required: ['text'],
      },
      annotations: { readOnlyHint: false },
      execute: async (input) => toolResult(await createCapture(input)),
    },
    {
      name: 'upsert_source',
      description: 'Create or update a source record so derived notes and solves retain an evidence trail.',
      inputSchema: { type: 'object', properties: { source: { type: 'object', additionalProperties: true } }, required: ['source'] },
      annotations: { readOnlyHint: false },
      execute: async (input) => toolResult(await upsertSource(input)),
    },
    {
      name: 'upsert_note',
      description: 'Create or update a structured study note. Keep summary, abstraction, detail, patterns, useful syntax or commands, and source IDs distinct when possible.',
      inputSchema: { type: 'object', properties: { note: { type: 'object', additionalProperties: true } }, required: ['note'] },
      annotations: { readOnlyHint: false },
      execute: async (input) => toolResult(await upsertNote(input)),
    },
    {
      name: 'upsert_challenge',
      description: 'Create or update a practice item such as a problem, lab, exercise, assignment task, CTF challenge, or revision objective. Stored as the legacy challenge type for compatibility.',
      inputSchema: { type: 'object', properties: { challenge: { type: 'object', additionalProperties: true } }, required: ['challenge'] },
      annotations: { readOnlyHint: false },
      execute: async (input) => toolResult(await upsertChallenge(input)),
    },
    {
      name: 'record_solve',
      description: 'Create or update a study or practice session, including steps, attempts, lessons, sources, and optional technical commands, payloads, or artifacts. Stored as the legacy solve type for compatibility.',
      inputSchema: { type: 'object', properties: { solve: { type: 'object', additionalProperties: true } }, required: ['solve'] },
      annotations: { readOnlyHint: false },
      execute: async (input) => toolResult(await recordSolve(input)),
    },
    {
      name: 'upsert_practice',
      description: 'Generic alias for creating or updating a practice item. The record is stored with the legacy challenge type so existing data and tools remain compatible.',
      inputSchema: { type: 'object', properties: { practice: { type: 'object', additionalProperties: true } }, required: ['practice'] },
      annotations: { readOnlyHint: false },
      execute: async (input) => toolResult(await upsertChallenge({ challenge: input.practice })),
    },
    {
      name: 'record_study_session',
      description: 'Generic alias for creating or updating a study, revision, problem-solving, lab, or CTF session. The record is stored with the legacy solve type for compatibility.',
      inputSchema: { type: 'object', properties: { session: { type: 'object', additionalProperties: true } }, required: ['session'] },
      annotations: { readOnlyHint: false },
      execute: async (input) => toolResult(await recordSolve({ solve: input.session })),
    },
    {
      name: 'mark_inbox_processed',
      description: 'Mark a raw inbox capture as processed and optionally link the structured records generated from it.',
      inputSchema: {
        type: 'object',
        properties: { capture_id: { type: 'string' }, generated_record_ids: { type: 'array', items: { type: 'string' } } },
        required: ['capture_id'],
      },
      annotations: { readOnlyHint: false },
      execute: async (input) => toolResult(await markInboxProcessed(input)),
    },
    {
      name: 'link_records',
      description: 'Attach sources, challenges, or related records to an existing record without rewriting its content.',
      inputSchema: {
        type: 'object',
        properties: {
          record_id: { type: 'string' },
          source_ids: { type: 'array', items: { type: 'string' } },
          challenge_ids: { type: 'array', items: { type: 'string' } },
          related_ids: { type: 'array', items: { type: 'string' } },
        },
        required: ['record_id'],
      },
      annotations: { readOnlyHint: false },
      execute: async (input) => toolResult(await linkRecords(input)),
    },
    {
      name: 'delete_record',
      description: 'Permanently delete one explicitly selected local record.',
      inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
      annotations: { readOnlyHint: false, destructiveHint: true },
      execute: async (input) => toolResult(await deleteRecord(input)),
    },
  ];

  try {
    for (const tool of tools) await modelContext.registerTool(tool);
    status.className = 'mcp-status ready';
    status.innerHTML = `<i></i><span>${tools.length} agent tools ready</span>`;
  } catch (error) {
    console.error(error);
    status.className = 'mcp-status unavailable';
    status.innerHTML = '<i></i><span>WebMCP registration failed</span>';
  }
}

function bindUi() {
  document.querySelector('.tabs').addEventListener('click', (event) => {
    const button = event.target.closest('button[data-view]');
    if (!button) return;
    if (activeView === 'debrief' && debriefBusy()) return;
    activeView = button.dataset.view;
    render();
  });

  $('searchInput').addEventListener('input', (event) => {
    searchQuery = event.target.value;
    render();
    $('searchInput').value = searchQuery;
    $('searchInput').focus();
  });

  $('guideButton').addEventListener('click', () => $('agentGuide').showModal());

  document.addEventListener('click', async (event) => {
    const openButton = event.target.closest('[data-open-record]');
    if (openButton) openRecord(openButton.dataset.openRecord);

    const closeButton = event.target.closest('[data-close-dialog]');
    if (closeButton) closeButton.closest('dialog').close();

    const deleteButton = event.target.closest('[data-delete-record]');
    if (deleteButton && confirm('Delete this local record permanently?')) {
      const id = deleteButton.dataset.deleteRecord;
      deleteButton.closest('dialog').close();
      await deleteRecord({ id });
    }

    const settings = document.querySelector('.settings');
    if (settings.open && !settings.contains(event.target)) settings.open = false;
  });

  $('exportButton').addEventListener('click', () => {
    const payload = { schemaVersion: SCHEMA_VERSION, exportedAt: nowIso(), records, meta };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `study-ledger-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(link.href);
  });

  $('importButton').addEventListener('click', () => $('importInput').click());
  $('importInput').addEventListener('change', async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const payload = JSON.parse(await file.text());
      if (!Array.isArray(payload.records)) throw new Error('Backup does not contain a records array.');
      await dbClear('records');
      for (const record of payload.records) await dbPut('records', record);
      await dbClear('meta');
      for (const [key, value] of Object.entries(payload.meta || {})) await dbPut('meta', { key, value });
      await setMeta('schemaVersion', SCHEMA_VERSION);
      await loadModel();
      debriefState = null;
      render();
      $('storageStatus').textContent = `Restored ${records.length} records.`;
    } catch (error) {
      $('storageStatus').textContent = `Restore failed: ${error.message}`;
    } finally {
      event.target.value = '';
    }
  });

  $('resetButton').addEventListener('click', () => {
    if (!confirm('Permanently delete the entire local Study Ledger?')) return;
    db.close();
    const request = indexedDB.deleteDatabase(DB_NAME);
    request.onsuccess = () => location.reload();
    request.onerror = () => { $('storageStatus').textContent = 'Could not delete local data.'; };
  });
}

async function start() {
  db = await openDb();
  await loadModel();
  if (!meta.schemaVersion) await setMeta('schemaVersion', SCHEMA_VERSION);
  if (navigator.storage?.persist) {
    try {
      const persistent = await navigator.storage.persist();
      $('storageStatus').textContent = persistent ? 'Persistent browser storage granted.' : 'Browser storage is not marked persistent.';
    } catch (_) {}
  }
  bindUi();
  render();
  registerWebMcp();

  const ledgerApi = {
    get records() { return records.map(sanitizeForAgent); },
    createCapture,
    upsertSource,
    upsertNote,
    upsertChallenge,
    recordSolve,
    markInboxProcessed,
    linkRecords,
    getStudyState: getSecurityState,
    getSecurityState,
    upsertPractice: (practice) => upsertChallenge({ challenge: practice?.practice || practice }),
    recordStudySession: (session) => recordSolve({ solve: session?.session || session }),
    getInbox,
    searchKnowledge,
    deleteRecord,
  };
  window.StudyLedger = ledgerApi;
  window.SecurityLedger = ledgerApi;
}

start().catch((error) => {
  console.error(error);
  $('appError').hidden = false;
  $('appError').textContent = `Could not load Study Ledger: ${error.message}`;
});
