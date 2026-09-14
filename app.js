const DB_NAME = 'workout-planner-ledger';
const DB_VERSION = 1;
const LEGACY_KEY = 'workout-planner.v2';

let db;
let model = { entities: [], events: [], meta: {} };
let activeTab = 'training';
let activeView = 'microcycle';

const $ = (id) => document.getElementById(id);
const uid = (prefix) => `${prefix}-${crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`}`;
const clone = (value) => JSON.parse(JSON.stringify(value));
const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));

function dateKey(value) {
  const date = new Date(value);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function addDays(value, days) {
  const date = new Date(value);
  date.setDate(date.getDate() + days);
  return date;
}

function mondayOf(value = new Date()) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  const day = date.getDay();
  date.setDate(date.getDate() + (day === 0 ? -6 : 1 - day));
  return date;
}

function formatDate(value, options = { month: 'short', day: 'numeric' }) {
  return new Intl.DateTimeFormat(undefined, options).format(new Date(value));
}

function formatRange(start, end) {
  return `${formatDate(start)} – ${formatDate(end)}`;
}

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      const entities = database.createObjectStore('entities', { keyPath: 'id' });
      entities.createIndex('type', 'type', { unique: false });
      entities.createIndex('parentId', 'parentId', { unique: false });
      entities.createIndex('startDate', 'startDate', { unique: false });

      const events = database.createObjectStore('events', { keyPath: 'id' });
      events.createIndex('category', 'category', { unique: false });
      events.createIndex('entityId', 'entityId', { unique: false });
      events.createIndex('occurredAt', 'occurredAt', { unique: false });
      events.createIndex('date', 'date', { unique: false });

      database.createObjectStore('meta', { keyPath: 'key' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
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
    transaction.onerror = () => reject(transaction.error || request?.error);
    transaction.onabort = () => reject(transaction.error || new Error('Database transaction aborted.'));
  });
}

const dbPut = (store, value) => storeRequest(store, 'readwrite', (s) => s.put(clone(value)));
const dbDelete = (store, key) => storeRequest(store, 'readwrite', (s) => s.delete(key));
const dbGetAll = (store) => storeRequest(store, 'readonly', (s) => s.getAll());

async function loadModel() {
  const [entities, events, metaRows] = await Promise.all([
    dbGetAll('entities'),
    dbGetAll('events'),
    dbGetAll('meta'),
  ]);
  model = {
    entities,
    events,
    meta: Object.fromEntries(metaRows.map((row) => [row.key, row.value])),
  };
}

async function setMeta(key, value) {
  await dbPut('meta', { key, value });
  model.meta[key] = value;
}

async function appendEvent(category, action, entityId, data = {}, date = null) {
  const event = {
    id: uid('event'),
    category,
    action,
    entityId: entityId || null,
    occurredAt: new Date().toISOString(),
    date: date || dateKey(new Date()),
    data: clone(data),
  };
  await dbPut('events', event);
  model.events.push(event);
  return clone(event);
}

function entity(id) { return model.entities.find((item) => item.id === id) || null; }
function entities(type) { return model.entities.filter((item) => item.type === type); }
function children(parentId, type = null) {
  return model.entities
    .filter((item) => item.parentId === parentId && (!type || item.type === type))
    .sort((a, b) => String(a.startDate || a.date || '').localeCompare(String(b.startDate || b.date || '')));
}

async function putEntity(record, logChange = false) {
  const existing = entity(record.id);
  const next = { ...record, updatedAt: new Date().toISOString() };
  if (!next.createdAt) next.createdAt = existing?.createdAt || next.updatedAt;
  if (logChange && existing) {
    await appendEvent('program', 'entity_updated', record.id, { before: existing, after: next }, next.startDate || next.date);
  }
  await dbPut('entities', next);
  const index = model.entities.findIndex((item) => item.id === next.id);
  if (index >= 0) model.entities[index] = next;
  else model.entities.push(next);
  return clone(next);
}

function eventList({ category = null, entityId = null, action = null } = {}) {
  return model.events
    .filter((item) => (!category || item.category === category) && (!entityId || item.entityId === entityId) && (!action || item.action === action))
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
}

function latestEvent(query) { return eventList(query)[0] || null; }

function currentContext() {
  const today = dateKey(new Date());
  const blocks = entities('block').sort((a, b) => a.startDate.localeCompare(b.startDate));
  let block = blocks.find((item) => item.startDate <= today && item.endDate >= today) || entity(model.meta.activeBlockId) || blocks[0] || null;
  if (!block) return { block: null, mesocycle: null, microcycle: null };

  const mesos = children(block.id, 'mesocycle');
  let mesocycle = mesos.find((item) => item.startDate <= today && item.endDate >= today) || mesos[0] || null;
  const micros = mesocycle ? children(mesocycle.id, 'microcycle') : [];
  let microcycle = micros.find((item) => item.startDate <= today && item.endDate >= today) || micros[0] || null;
  return { block, mesocycle, microcycle };
}

function makePrescription(exercise, sets, reps, loadKg = null, rir = 2, note = '') {
  return { exercise, sets, reps, loadKg, rir, note };
}

function sessionTemplate(kind, dayIndex) {
  if (kind === 'deload') {
    const templates = {
      0: ['UPPER DELOAD', 45, [makePrescription('Bench press', 3, '5', 55, 4), makePrescription('Row', 2, '8', null, 4)]],
      1: ['LOWER DELOAD', 45, [makePrescription('Squat', 3, '5', 70, 4), makePrescription('RDL', 2, '6', null, 4)]],
      3: ['TECHNIQUE', 35, [makePrescription('Bench press', 3, '3', 50, 5), makePrescription('Squat', 3, '3', 60, 5)]],
    };
    return templates[dayIndex] || null;
  }

  if (kind === 'test') {
    const templates = {
      0: ['BENCH TEST', 60, [makePrescription('Bench press', 5, '1–3', null, 1, 'Build to a strong technical top set')]],
      2: ['SQUAT TEST', 70, [makePrescription('Squat', 5, '1–3', null, 1)]],
      4: ['DEADLIFT TEST', 70, [makePrescription('Deadlift', 4, '1–3', null, 1)]],
    };
    return templates[dayIndex] || null;
  }

  const templates = {
    0: ['UPPER STRENGTH', 65, [makePrescription('Bench press', 6, '3', 80, 2), makePrescription('Barbell row', 4, '6', null, 2), makePrescription('Triceps', 3, '10', null, 2)]],
    1: ['LOWER STRENGTH', 75, [makePrescription('Squat', 5, '5', 100, 2), makePrescription('RDL', 4, '6', null, 2), makePrescription('Calves', 3, '12', null, 2)]],
    2: ['RECOVERY', 30, [makePrescription('Zone 2', 1, '30 min', null, 5), makePrescription('Mobility', 1, '10 min', null, 5)]],
    3: ['UPPER VOLUME', 60, [makePrescription('Bench press', 5, '8', 65, 3), makePrescription('Pull-up', 4, '6–10', null, 2), makePrescription('Lateral raise', 3, '15', null, 2)]],
    4: ['HINGE', 70, [makePrescription('Deadlift', 5, '3', 120, 2), makePrescription('Split squat', 3, '8 / leg', null, 2), makePrescription('Hamstring curl', 3, '12', null, 2)]],
  };
  return templates[dayIndex] || null;
}

async function seedDemo() {
  if (model.meta.seeded) return;
  const start = mondayOf(new Date());
  const blockId = uid('block');
  const block = {
    id: blockId,
    type: 'block',
    parentId: null,
    title: 'MAX STRENGTH',
    outcome: 'strength',
    startDate: dateKey(start),
    endDate: dateKey(addDays(start, 83)),
    goal: 'Increase the major lifts while preserving work capacity.',
  };
  await putEntity(block);

  const mesoNames = ['BASE STRENGTH', 'HEAVY STRENGTH', 'PEAK STRENGTH'];
  const mesoFocus = ['Build repeatable volume and technical consistency.', 'Increase intensity and specific strength.', 'Reduce noise and express strength.'];
  const microKinds = ['training', 'training', 'training', 'deload', 'training', 'training', 'training', 'deload', 'training', 'training', 'training', 'test'];

  for (let mesoIndex = 0; mesoIndex < 3; mesoIndex += 1) {
    const mesoStart = addDays(start, mesoIndex * 28);
    const meso = {
      id: uid('meso'),
      type: 'mesocycle',
      parentId: blockId,
      title: mesoNames[mesoIndex],
      focus: mesoFocus[mesoIndex],
      startDate: dateKey(mesoStart),
      endDate: dateKey(addDays(mesoStart, 27)),
      order: mesoIndex + 1,
    };
    await putEntity(meso);

    for (let weekIndex = 0; weekIndex < 4; weekIndex += 1) {
      const absoluteWeek = mesoIndex * 4 + weekIndex;
      const weekStart = addDays(start, absoluteWeek * 7);
      const kind = microKinds[absoluteWeek];
      const micro = {
        id: uid('micro'),
        type: 'microcycle',
        parentId: meso.id,
        title: kind === 'deload' ? `DELOAD ${mesoIndex + 1}` : kind === 'test' ? 'TEST WEEK' : `WEEK ${absoluteWeek + 1}`,
        kind,
        startDate: dateKey(weekStart),
        endDate: dateKey(addDays(weekStart, 6)),
        order: absoluteWeek + 1,
      };
      await putEntity(micro);

      for (let dayIndex = 0; dayIndex < 7; dayIndex += 1) {
        const template = sessionTemplate(kind, dayIndex);
        if (!template) continue;
        const [title, durationMinutes, prescriptions] = template;
        await putEntity({
          id: uid('session'),
          type: 'session',
          parentId: micro.id,
          date: dateKey(addDays(weekStart, dayIndex)),
          startDate: dateKey(addDays(weekStart, dayIndex)),
          title,
          durationMinutes,
          prescriptions,
        });
      }
    }
  }

  const kpis = [
    ['BENCH E1RM', 'kg', 93.3, 110, false],
    ['SQUAT E1RM', 'kg', 116.7, 140, false],
    ['DEADLIFT E1RM', 'kg', 140, 170, false],
    ['1 MILE', 'min', 7.5, 6.75, true],
  ];
  for (const [name, unit, initial, target, lowerBetter] of kpis) {
    const item = await putEntity({ id: uid('kpi'), type: 'kpi', parentId: blockId, name, unit, targetValue: target, lowerBetter });
    await appendEvent('kpi', 'measurement', item.id, { value: initial, unit }, block.startDate);
  }

  const profile = {
    proteinTargetG: 160,
    sleepTargetHours: 8,
    bodyMassKg: 80,
    goals: ['strength'],
  };
  await setMeta('profile', profile);
  await setMeta('activeBlockId', blockId);
  await setMeta('seeded', true);

  const today = dateKey(new Date());
  await appendEvent('protein', 'intake', null, { grams: 155, targetGrams: profile.proteinTargetG }, today);
  await appendEvent('sleep', 'sleep', null, { hours: 7.5, targetHours: profile.sleepTargetHours, readiness: 7, soreness: 2 }, today);

  const current = currentContext();
  const todaysSession = current.microcycle ? children(current.microcycle.id, 'session').find((item) => item.date === today) : null;
  if (todaysSession) {
    await appendEvent('training', 'session_completed', todaysSession.id, {
      plannedMinutes: todaysSession.durationMinutes,
      actualMinutes: todaysSession.durationMinutes,
      completion: 1,
      rir: 2,
      notes: 'Demo completion record.',
    }, today);
  }

  try {
    const legacy = JSON.parse(localStorage.getItem(LEGACY_KEY));
    if (legacy) await appendEvent('system', 'legacy_import', null, { source: LEGACY_KEY, snapshot: legacy }, today);
  } catch { /* legacy data is optional */ }
}

function sessionResult(sessionId) {
  return latestEvent({ category: 'training', entityId: sessionId, action: 'session_completed' })
    || latestEvent({ category: 'training', entityId: sessionId, action: 'session_missed' });
}

function microStats(microId) {
  const sessions = children(microId, 'session');
  const results = sessions.map((item) => sessionResult(item.id)).filter(Boolean);
  const completed = results.filter((item) => item.action === 'session_completed').length;
  const plannedMinutes = sessions.reduce((sum, item) => sum + Number(item.durationMinutes || 0), 0);
  const actualMinutes = results.reduce((sum, item) => sum + Number(item.data.actualMinutes || 0), 0);
  return {
    sessions: sessions.length,
    completed,
    adherence: sessions.length ? completed / sessions.length : 0,
    plannedMinutes,
    actualMinutes,
  };
}

function mesoStats(mesoId) {
  const micros = children(mesoId, 'microcycle');
  const stats = micros.map((item) => microStats(item.id));
  const sessions = stats.reduce((sum, item) => sum + item.sessions, 0);
  const completed = stats.reduce((sum, item) => sum + item.completed, 0);
  return { weeks: micros.length, sessions, completed, adherence: sessions ? completed / sessions : 0 };
}

function blockMicros(blockId) {
  return children(blockId, 'mesocycle').flatMap((meso) => children(meso.id, 'microcycle'));
}

function statusForSession(session) {
  const result = sessionResult(session.id);
  if (!result) return { mark: '·', label: 'PLANNED', cls: 'status-planned', duration: session.durationMinutes };
  if (result.action === 'session_missed') return { mark: '✕', label: 'MISSED', cls: 'status-missed', duration: result.data.actualMinutes || 0 };
  return { mark: '✓', label: 'DONE', cls: 'status-complete', duration: result.data.actualMinutes || session.durationMinutes };
}

function renderContext() {
  const context = currentContext();
  $('contextBlock').textContent = context.block ? `${context.block.title} · ${formatRange(context.block.startDate, context.block.endDate)}` : '—';
  $('contextMeso').textContent = context.mesocycle ? `${context.mesocycle.title} · ${formatRange(context.mesocycle.startDate, context.mesocycle.endDate)}` : '—';
  $('contextMicro').textContent = context.microcycle ? `${context.microcycle.title} · ${formatRange(context.microcycle.startDate, context.microcycle.endDate)}` : '—';
}

function renderMicrocycle(micro) {
  if (!micro) return '<div class="empty">NO MICROCYCLE</div>';
  const sessions = children(micro.id, 'session');
  const byDate = Object.fromEntries(sessions.map((item) => [item.date, item]));
  const stats = microStats(micro.id);
  let html = `<div class="view-head"><div><span>${esc(micro.kind.toUpperCase())}</span><h2>${esc(micro.title)}</h2></div><small>${esc(formatRange(micro.startDate, micro.endDate))}</small></div>`;
  html += `<div class="summary-line"><div><span>SESSIONS</span><strong>${stats.completed}/${stats.sessions}</strong></div><div><span>ADHERENCE</span><strong>${Math.round(stats.adherence * 100)}%</strong></div><div><span>PLANNED TIME</span><strong>${stats.plannedMinutes} min</strong></div><div><span>LOGGED TIME</span><strong>${stats.actualMinutes} min</strong></div></div>`;
  html += '<div class="week-grid">';
  for (let day = 0; day < 7; day += 1) {
    const date = dateKey(addDays(new Date(`${micro.startDate}T00:00:00`), day));
    const session = byDate[date];
    html += `<article class="day"><div class="day-head"><strong>${esc(new Intl.DateTimeFormat(undefined, { weekday: 'long' }).format(new Date(`${date}T00:00:00`)).toUpperCase())}</strong><span>${esc(formatDate(date))}</span></div>`;
    if (!session) {
      html += '<p class="empty">REST</p></article>';
      continue;
    }
    const status = statusForSession(session);
    html += `<h3 class="session-title">${esc(session.title)}</h3>`;
    for (const work of session.prescriptions || []) {
      const load = work.loadKg ? `${work.loadKg} kg · ` : '';
      html += `<div class="work-row"><strong>${esc(work.exercise)}</strong><span>${esc(`${work.sets} × ${work.reps} · ${load}RIR ${work.rir}`)}</span>${work.note ? `<span>${esc(work.note)}</span>` : ''}</div>`;
    }
    html += `<div class="day-status ${status.cls}"><strong>${status.mark}</strong><span>${status.label} · ${status.duration} min</span></div></article>`;
  }
  html += '</div>';
  return html;
}

function renderMesocycle(meso) {
  if (!meso) return '<div class="empty">NO MESOCYCLE</div>';
  const micros = children(meso.id, 'microcycle');
  const total = mesoStats(meso.id);
  let html = `<div class="view-head"><div><span>MESOCYCLE</span><h2>${esc(meso.title)}</h2></div><small>${esc(meso.focus || '')}</small></div>`;
  html += `<div class="summary-line"><div><span>WEEKS</span><strong>${total.weeks}</strong></div><div><span>SESSIONS</span><strong>${total.completed}/${total.sessions}</strong></div><div><span>ADHERENCE</span><strong>${Math.round(total.adherence * 100)}%</strong></div></div>`;
  html += '<table class="scale-table"><thead><tr><th>WEEK</th><th>TYPE</th><th>DATES</th><th>SESSIONS</th><th>ADHERENCE</th><th>TIME</th></tr></thead><tbody>';
  for (const micro of micros) {
    const stats = microStats(micro.id);
    const current = currentContext().microcycle?.id === micro.id ? ' current-row' : '';
    const deload = micro.kind === 'deload' ? ' deload-row' : '';
    html += `<tr class="${current}${deload}"><td><strong>${esc(micro.title)}</strong></td><td>${esc(micro.kind.toUpperCase())}</td><td>${esc(formatRange(micro.startDate, micro.endDate))}</td><td>${stats.completed}/${stats.sessions}</td><td>${Math.round(stats.adherence * 100)}%</td><td>${stats.actualMinutes}/${stats.plannedMinutes} min</td></tr>`;
  }
  html += '</tbody></table>';
  return html;
}

function renderDeload(block) {
  if (!block) return '<div class="empty">NO TRAINING BLOCK</div>';
  const deloads = blockMicros(block.id).filter((item) => item.kind === 'deload');
  let html = `<div class="view-head"><div><span>DELOADS</span><h2>${esc(block.title)}</h2></div><small>${deloads.length} scheduled</small></div>`;
  if (!deloads.length) return html + '<div class="empty">NO DELOADS SCHEDULED</div>';
  html += '<table class="scale-table"><thead><tr><th>DELOAD</th><th>DATES</th><th>SESSIONS</th><th>PLANNED TIME</th><th>STRUCTURE</th></tr></thead><tbody>';
  for (const micro of deloads) {
    const sessions = children(micro.id, 'session');
    const stats = microStats(micro.id);
    const structure = sessions.map((item) => item.title).join(' / ');
    html += `<tr><td><strong>${esc(micro.title)}</strong></td><td>${esc(formatRange(micro.startDate, micro.endDate))}</td><td>${stats.sessions}</td><td>${stats.plannedMinutes} min</td><td>${esc(structure)}</td></tr>`;
  }
  html += '</tbody></table>';
  return html;
}

function renderBlock(block) {
  if (!block) return '<div class="empty">NO TRAINING BLOCK</div>';
  const mesos = children(block.id, 'mesocycle');
  let html = `<div class="view-head"><div><span>TRAINING BLOCK · ${esc(block.outcome.toUpperCase())}</span><h2>${esc(block.title)}</h2></div><small>${esc(formatRange(block.startDate, block.endDate))}</small></div>`;
  html += `<div class="summary-line"><div><span>PRIMARY OUTCOME</span><strong>${esc(block.outcome.toUpperCase())}</strong></div><div><span>DURATION</span><strong>${blockMicros(block.id).length} weeks</strong></div><div><span>GOAL</span><strong>${esc(block.goal)}</strong></div></div>`;
  html += '<div class="block-bar">';
  for (const meso of mesos) {
    const micros = children(meso.id, 'microcycle');
    const stats = mesoStats(meso.id);
    html += `<section class="block-segment"><span>MESOCYCLE ${meso.order}</span><strong>${esc(meso.title)}</strong><span>${esc(formatRange(meso.startDate, meso.endDate))}</span><ul><li>${esc(meso.focus)}</li><li>${micros.length} microcycles</li><li>${stats.sessions} planned sessions</li><li>${Math.round(stats.adherence * 100)}% adherence</li></ul></section>`;
  }
  html += '</div>';
  return html;
}

function eventSummary(event) {
  const data = event.data || {};
  if (event.category === 'training') return `${data.actualMinutes ?? 0} min · completion ${Math.round((data.completion ?? 0) * 100)}% · RIR ${data.rir ?? '—'}`;
  if (event.category === 'protein') return `${data.grams ?? '—'} g / ${data.targetGrams ?? model.meta.profile?.proteinTargetG ?? '—'} g`;
  if (event.category === 'sleep') return `${data.hours ?? '—'} h · readiness ${data.readiness ?? '—'} · soreness ${data.soreness ?? '—'}`;
  if (event.category === 'kpi') return `${data.value ?? '—'} ${data.unit ?? ''}`;
  if (event.category === 'program') return 'Program entity changed; previous and new values retained.';
  if (event.category === 'system') return event.action;
  return JSON.stringify(data);
}

function renderLedger() {
  const list = [...model.events].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
  let html = `<div class="view-head"><div><span>APPEND-ONLY HISTORY</span><h2>LEDGER</h2></div><small>${list.length} records</small></div>`;
  html += '<table class="ledger-table"><thead><tr><th>TIME</th><th>DOMAIN</th><th>ACTION</th><th>DATA</th><th></th></tr></thead><tbody>';
  for (const event of list.slice(0, 200)) {
    html += `<tr><td>${esc(new Date(event.occurredAt).toLocaleString())}</td><td>${esc(event.category.toUpperCase())}</td><td>${esc(event.action)}</td><td>${esc(eventSummary(event))}</td><td><button class="ledger-delete" data-delete-event="${esc(event.id)}">DELETE</button></td></tr>`;
  }
  html += '</tbody></table>';
  return html;
}

function weekDates(micro) {
  return micro ? Array.from({ length: 7 }, (_, index) => dateKey(addDays(new Date(`${micro.startDate}T00:00:00`), index))) : [];
}

function latestDailyEvent(category, date) {
  return eventList({ category }).find((item) => item.date === date) || null;
}

function renderProtein(micro) {
  const target = model.meta.profile?.proteinTargetG ?? 0;
  let html = `<div class="view-head"><div><span>COACHING PRESCRIPTION</span><h2>PROTEIN</h2></div><small>${target} g / day</small></div>`;
  html += '<table class="domain-table"><thead><tr><th>DAY</th><th>DATE</th><th>TARGET</th><th>LOGGED</th><th>STATUS</th></tr></thead><tbody>';
  for (const date of weekDates(micro)) {
    const event = latestDailyEvent('protein', date);
    const grams = event?.data.grams;
    const status = grams == null ? '—' : grams >= target * 0.9 ? '✓' : '✕';
    html += `<tr><td>${esc(new Intl.DateTimeFormat(undefined, { weekday: 'long' }).format(new Date(`${date}T00:00:00`)).toUpperCase())}</td><td>${esc(formatDate(date))}</td><td>${target} g</td><td>${grams ?? '—'}${grams != null ? ' g' : ''}</td><td class="${status === '✓' ? 'status-complete' : status === '✕' ? 'status-missed' : ''}">${status}</td></tr>`;
  }
  html += '</tbody></table>';
  return html;
}

function renderSleep(micro) {
  const target = model.meta.profile?.sleepTargetHours ?? 0;
  let html = `<div class="view-head"><div><span>RECOVERY LEDGER</span><h2>SLEEP</h2></div><small>${target} h target</small></div>`;
  html += '<table class="domain-table"><thead><tr><th>DAY</th><th>DATE</th><th>TARGET</th><th>SLEEP</th><th>READINESS</th><th>SORENESS</th></tr></thead><tbody>';
  for (const date of weekDates(micro)) {
    const event = latestDailyEvent('sleep', date);
    html += `<tr><td>${esc(new Intl.DateTimeFormat(undefined, { weekday: 'long' }).format(new Date(`${date}T00:00:00`)).toUpperCase())}</td><td>${esc(formatDate(date))}</td><td>${target} h</td><td>${event?.data.hours ?? '—'}</td><td>${event?.data.readiness ?? '—'}</td><td>${event?.data.soreness ?? '—'}</td></tr>`;
  }
  html += '</tbody></table>';
  return html;
}

function renderKpis(block) {
  const kpis = entities('kpi').filter((item) => !block || item.parentId === block.id);
  let html = `<div class="view-head"><div><span>PERFORMANCE OUTCOMES</span><h2>KPI</h2></div><small>${kpis.length} tracked</small></div>`;
  html += '<table class="domain-table"><thead><tr><th>KPI</th><th>START</th><th>CURRENT</th><th>CHANGE</th><th>TARGET</th><th>LAST TEST</th></tr></thead><tbody>';
  for (const kpi of kpis) {
    const measurements = eventList({ category: 'kpi', entityId: kpi.id, action: 'measurement' }).sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
    const first = measurements[0];
    const last = measurements.at(-1);
    const start = Number(first?.data.value);
    const current = Number(last?.data.value);
    const change = Number.isFinite(start) && Number.isFinite(current) ? current - start : null;
    const sign = change > 0 ? '+' : '';
    html += `<tr><td><strong>${esc(kpi.name)}</strong><span>${esc(kpi.unit)}</span></td><td>${first ? `${start} ${esc(kpi.unit)}` : '—'}</td><td>${last ? `${current} ${esc(kpi.unit)}` : '—'}</td><td>${change == null ? '—' : `${sign}${Math.round(change * 100) / 100} ${esc(kpi.unit)}`}</td><td>${kpi.targetValue} ${esc(kpi.unit)}</td><td>${last ? esc(formatDate(last.date)) : '—'}</td></tr>`;
  }
  html += '</tbody></table>';
  return html;
}

function render() {
  const context = currentContext();
  renderContext();

  document.querySelectorAll('.tabs button').forEach((button) => button.classList.toggle('active', button.dataset.tab === activeTab));
  document.querySelectorAll('.tab-view').forEach((section) => section.classList.toggle('active', section.id === `${activeTab}Tab`));
  document.querySelectorAll('.subtabs button').forEach((button) => button.classList.toggle('active', button.dataset.view === activeView));

  if (activeView === 'microcycle') $('trainingView').innerHTML = renderMicrocycle(context.microcycle);
  else if (activeView === 'mesocycle') $('trainingView').innerHTML = renderMesocycle(context.mesocycle);
  else if (activeView === 'deload') $('trainingView').innerHTML = renderDeload(context.block);
  else if (activeView === 'block') $('trainingView').innerHTML = renderBlock(context.block);
  else $('trainingView').innerHTML = renderLedger();

  $('proteinView').innerHTML = renderProtein(context.microcycle);
  $('sleepView').innerHTML = renderSleep(context.microcycle);
  $('kpiView').innerHTML = renderKpis(context.block);
  $('storageStatus').textContent = `INDEXEDDB · ${model.entities.length} ENTITIES · ${model.events.length} LEDGER RECORDS`;
}

async function refresh() {
  await loadModel();
  render();
}

async function createTrainingBlock({ title, outcome, start_date, weeks = 12, mesocycle_weeks = 4, goal = '' }) {
  const weekCount = Math.max(1, Math.min(26, Number(weeks)));
  const mesoWeeks = Math.max(1, Math.min(4, Number(mesocycle_weeks)));
  const start = mondayOf(new Date(`${start_date}T00:00:00`));
  const block = await putEntity({
    id: uid('block'), type: 'block', parentId: null, title, outcome,
    startDate: dateKey(start), endDate: dateKey(addDays(start, weekCount * 7 - 1)), goal,
  });
  let mesoNumber = 0;
  for (let offset = 0; offset < weekCount; offset += mesoWeeks) {
    mesoNumber += 1;
    const length = Math.min(mesoWeeks, weekCount - offset);
    const mesoStart = addDays(start, offset * 7);
    const meso = await putEntity({
      id: uid('meso'), type: 'mesocycle', parentId: block.id,
      title: `MESOCYCLE ${mesoNumber}`, focus: outcome,
      startDate: dateKey(mesoStart), endDate: dateKey(addDays(mesoStart, length * 7 - 1)), order: mesoNumber,
    });
    for (let week = 0; week < length; week += 1) {
      const weekStart = addDays(mesoStart, week * 7);
      await putEntity({
        id: uid('micro'), type: 'microcycle', parentId: meso.id,
        title: `WEEK ${offset + week + 1}`, kind: 'training',
        startDate: dateKey(weekStart), endDate: dateKey(addDays(weekStart, 6)), order: offset + week + 1,
      });
    }
  }
  await appendEvent('program', 'block_created', block.id, { title, outcome, weeks: weekCount }, block.startDate);
  await setMeta('activeBlockId', block.id);
  await refresh();
  return block;
}

async function addSession({ microcycle_id, date, title, duration_minutes, prescriptions = [] }) {
  const micro = entity(microcycle_id);
  if (!micro || micro.type !== 'microcycle') throw new Error('microcycle_id must identify an existing microcycle.');
  if (date < micro.startDate || date > micro.endDate) throw new Error('Session date must fall inside the microcycle.');
  const session = await putEntity({
    id: uid('session'), type: 'session', parentId: micro.id,
    date, startDate: date, title, durationMinutes: Number(duration_minutes) || 0,
    prescriptions: Array.isArray(prescriptions) ? prescriptions : [],
  });
  await appendEvent('program', 'session_created', session.id, { session }, date);
  await refresh();
  return session;
}

async function updateProgramEntity({ entity_id, patch }) {
  const current = entity(entity_id);
  if (!current) throw new Error('Program entity not found.');
  const protectedKeys = new Set(['id', 'type', 'parentId', 'createdAt']);
  const clean = Object.fromEntries(Object.entries(patch || {}).filter(([key]) => !protectedKeys.has(key)));
  const updated = await putEntity({ ...current, ...clean }, true);
  await refresh();
  return updated;
}

async function logTrainingSession({ session_id, completed = true, actual_minutes = 0, completion = 1, rir = null, notes = '' }) {
  const session = entity(session_id);
  if (!session || session.type !== 'session') throw new Error('session_id must identify an existing session.');
  const event = await appendEvent('training', completed ? 'session_completed' : 'session_missed', session.id, {
    plannedMinutes: session.durationMinutes,
    actualMinutes: Number(actual_minutes) || 0,
    completion: Math.max(0, Math.min(1, Number(completion))),
    rir: rir == null ? null : Number(rir),
    notes,
  }, session.date);
  await refresh();
  return event;
}

async function logProtein({ date, grams }) {
  const event = await appendEvent('protein', 'intake', null, { grams: Number(grams), targetGrams: model.meta.profile?.proteinTargetG ?? null }, date);
  await refresh();
  return event;
}

async function logSleep({ date, hours, readiness = null, soreness = null }) {
  const event = await appendEvent('sleep', 'sleep', null, {
    hours: Number(hours), targetHours: model.meta.profile?.sleepTargetHours ?? null,
    readiness: readiness == null ? null : Number(readiness),
    soreness: soreness == null ? null : Number(soreness),
  }, date);
  await refresh();
  return event;
}

async function logKpi({ kpi_id, value, date = dateKey(new Date()) }) {
  const kpi = entity(kpi_id);
  if (!kpi || kpi.type !== 'kpi') throw new Error('kpi_id must identify an existing KPI.');
  const event = await appendEvent('kpi', 'measurement', kpi.id, { value: Number(value), unit: kpi.unit }, date);
  await refresh();
  return event;
}

async function updateProfile(patch) {
  const before = clone(model.meta.profile || {});
  const after = { ...before, ...(patch || {}) };
  await setMeta('profile', after);
  await appendEvent('program', 'profile_updated', null, { before, after });
  await refresh();
  return after;
}

async function deleteLedgerEntry(id) {
  const existing = model.events.find((item) => item.id === id);
  if (!existing) throw new Error('Ledger entry not found.');
  await dbDelete('events', id);
  await refresh();
  return { deleted: id };
}

function programView(scope = 'microcycle') {
  const context = currentContext();
  if (scope === 'block') return { block: context.block, mesocycles: context.block ? children(context.block.id, 'mesocycle').map((meso) => ({ ...meso, microcycles: children(meso.id, 'microcycle') })) : [] };
  if (scope === 'mesocycle') return { mesocycle: context.mesocycle, microcycles: context.mesocycle ? children(context.mesocycle.id, 'microcycle').map((micro) => ({ ...micro, stats: microStats(micro.id) })) : [] };
  if (scope === 'deload') return { deloads: context.block ? blockMicros(context.block.id).filter((micro) => micro.kind === 'deload').map((micro) => ({ ...micro, sessions: children(micro.id, 'session') })) : [] };
  return { microcycle: context.microcycle, sessions: context.microcycle ? children(context.microcycle.id, 'session').map((session) => ({ ...session, result: sessionResult(session.id) })) : [] };
}

function toolResult(data) {
  return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
}

async function registerWebMcp() {
  const modelContext = document.modelContext || navigator.modelContext;
  const status = $('webmcpStatus');
  if (!modelContext?.registerTool) {
    status.className = 'unavailable';
    status.innerHTML = '<i></i><span>WebMCP unavailable</span>';
    return;
  }

  const tools = [
    {
      name: 'get_program_view', description: 'Read the current training hierarchy at microcycle, mesocycle, deload, or block scale.',
      inputSchema: { type: 'object', properties: { scope: { type: 'string', enum: ['microcycle', 'mesocycle', 'deload', 'block'] } } },
      annotations: { readOnlyHint: true }, execute: async ({ scope = 'microcycle' }) => toolResult(programView(scope)),
    },
    {
      name: 'get_training_ledger', description: 'Read stored training, protein, sleep, KPI, program, and system history.',
      inputSchema: { type: 'object', properties: { category: { type: 'string' }, limit: { type: 'number' } } },
      annotations: { readOnlyHint: true }, execute: async ({ category = null, limit = 100 }) => toolResult(eventList({ category }).slice(0, Math.max(1, Math.min(500, Number(limit))))),
    },
    {
      name: 'get_coaching_profile', description: 'Read persistent coaching targets such as protein, sleep, body mass, and goals.',
      inputSchema: { type: 'object', properties: {} }, annotations: { readOnlyHint: true }, execute: async () => toolResult(model.meta.profile || {}),
    },
    {
      name: 'update_coaching_profile', description: 'Update coaching targets while preserving the previous value in the program ledger.',
      inputSchema: { type: 'object', properties: { patch: { type: 'object', additionalProperties: true } }, required: ['patch'] },
      annotations: { readOnlyHint: false }, execute: async ({ patch }) => toolResult(await updateProfile(patch)),
    },
    {
      name: 'create_training_block', description: 'Create a new training block and its mesocycle/microcycle hierarchy.',
      inputSchema: { type: 'object', properties: { title: { type: 'string' }, outcome: { type: 'string' }, start_date: { type: 'string' }, weeks: { type: 'number' }, mesocycle_weeks: { type: 'number' }, goal: { type: 'string' } }, required: ['title', 'outcome', 'start_date'] },
      annotations: { readOnlyHint: false }, execute: async (input) => toolResult(await createTrainingBlock(input)),
    },
    {
      name: 'add_training_session', description: 'Add a prescribed session to an existing microcycle.',
      inputSchema: { type: 'object', properties: { microcycle_id: { type: 'string' }, date: { type: 'string' }, title: { type: 'string' }, duration_minutes: { type: 'number' }, prescriptions: { type: 'array', items: { type: 'object', additionalProperties: true } } }, required: ['microcycle_id', 'date', 'title', 'duration_minutes'] },
      annotations: { readOnlyHint: false }, execute: async (input) => toolResult(await addSession(input)),
    },
    {
      name: 'update_program_entity', description: 'Change a block, mesocycle, microcycle, session, or KPI while logging before/after state.',
      inputSchema: { type: 'object', properties: { entity_id: { type: 'string' }, patch: { type: 'object', additionalProperties: true } }, required: ['entity_id', 'patch'] },
      annotations: { readOnlyHint: false }, execute: async (input) => toolResult(await updateProgramEntity(input)),
    },
    {
      name: 'log_training_session', description: 'Record completion, duration, effort, and notes for a prescribed session.',
      inputSchema: { type: 'object', properties: { session_id: { type: 'string' }, completed: { type: 'boolean' }, actual_minutes: { type: 'number' }, completion: { type: 'number' }, rir: { type: ['number', 'null'] }, notes: { type: 'string' } }, required: ['session_id'] },
      annotations: { readOnlyHint: false }, execute: async (input) => toolResult(await logTrainingSession(input)),
    },
    {
      name: 'log_protein', description: 'Append a daily protein intake record.',
      inputSchema: { type: 'object', properties: { date: { type: 'string' }, grams: { type: 'number' } }, required: ['date', 'grams'] },
      annotations: { readOnlyHint: false }, execute: async (input) => toolResult(await logProtein(input)),
    },
    {
      name: 'log_sleep', description: 'Append a sleep and recovery record.',
      inputSchema: { type: 'object', properties: { date: { type: 'string' }, hours: { type: 'number' }, readiness: { type: ['number', 'null'] }, soreness: { type: ['number', 'null'] } }, required: ['date', 'hours'] },
      annotations: { readOnlyHint: false }, execute: async (input) => toolResult(await logSleep(input)),
    },
    {
      name: 'log_kpi', description: 'Append a performance KPI measurement.',
      inputSchema: { type: 'object', properties: { kpi_id: { type: 'string' }, value: { type: 'number' }, date: { type: 'string' } }, required: ['kpi_id', 'value'] },
      annotations: { readOnlyHint: false }, execute: async (input) => toolResult(await logKpi(input)),
    },
    {
      name: 'delete_ledger_entry', description: 'Permanently delete one explicitly selected ledger record.',
      inputSchema: { type: 'object', properties: { event_id: { type: 'string' } }, required: ['event_id'] },
      annotations: { readOnlyHint: false, destructiveHint: true }, execute: async ({ event_id }) => toolResult(await deleteLedgerEntry(event_id)),
    },
  ];

  try {
    await Promise.all(tools.map((tool) => modelContext.registerTool(tool)));
    status.className = 'ready';
    status.innerHTML = `<i></i><span>${tools.length} WebMCP tools ready</span>`;
  } catch (error) {
    status.className = 'unavailable';
    status.innerHTML = `<i></i><span>WebMCP registration failed</span>`;
    console.error(error);
  }
}

function bindUi() {
  document.querySelector('.tabs').addEventListener('click', (event) => {
    const button = event.target.closest('button[data-tab]');
    if (!button) return;
    activeTab = button.dataset.tab;
    render();
  });

  document.querySelector('.subtabs').addEventListener('click', (event) => {
    const button = event.target.closest('button[data-view]');
    if (!button) return;
    activeView = button.dataset.view;
    render();
  });

  document.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-delete-event]');
    if (!button) return;
    if (!confirm('Delete this ledger record permanently?')) return;
    await deleteLedgerEntry(button.dataset.deleteEvent);
  });

  $('exportButton').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify({ schemaVersion: 1, exportedAt: new Date().toISOString(), ...model }, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `workout-planner-ledger-${dateKey(new Date())}.json`;
    link.click();
    URL.revokeObjectURL(link.href);
  });

  $('resetButton').addEventListener('click', () => {
    if (!confirm('Delete the entire local Workout Planner ledger and restore demo data?')) return;
    db.close();
    const request = indexedDB.deleteDatabase(DB_NAME);
    request.onsuccess = () => location.reload();
    request.onerror = () => alert('Could not reset IndexedDB.');
  });
}

async function start() {
  db = await openDb();
  await loadModel();
  await seedDemo();
  await loadModel();
  bindUi();
  render();
  registerWebMcp();

  window.WorkoutPlanner = {
    get model() { return clone(model); },
    programView,
    createTrainingBlock,
    addSession,
    updateProgramEntity,
    logTrainingSession,
    logProtein,
    logSleep,
    logKpi,
    updateProfile,
    deleteLedgerEntry,
  };
}

start().catch((error) => {
  console.error(error);
  $('storageStatus').textContent = `LEDGER ERROR · ${error.message}`;
});
