const DB_NAME = 'workout-planner-ledger';
const DB_VERSION = 1;
const SCHEMA_VERSION = 2;

let db;
let model = { entities: [], events: [], meta: {} };
let activeTab = 'training';
let activeView = 'microcycle';
let selectedMicroId = null;
let selectedDate = null;

const $ = (id) => document.getElementById(id);
const clone = (value) => JSON.parse(JSON.stringify(value));
const uid = (prefix) => `${prefix}-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`}`;
const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[char]));

function dateKey(value) {
  const date = value instanceof Date ? new Date(value) : new Date(`${String(value).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(date.getTime())) throw new Error(`Invalid date: ${value}`);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseDate(value, label = 'date') {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`${label} must use YYYY-MM-DD.`);
  }
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime()) || dateKey(date) !== value) throw new Error(`${label} is not a valid date.`);
  return date;
}

function addDays(value, days) {
  const date = value instanceof Date ? new Date(value) : parseDate(dateKey(value));
  date.setDate(date.getDate() + Number(days));
  return date;
}

function inclusiveDays(start, end) {
  return Math.floor((parseDate(end).getTime() - parseDate(start).getTime()) / 86400000) + 1;
}

function addMonths(value, months) {
  const date = parseDate(value);
  const day = date.getDate();
  date.setDate(1);
  date.setMonth(date.getMonth() + months);
  const last = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  date.setDate(Math.min(day, last));
  return date;
}

function mondayOf(value = new Date()) {
  const date = value instanceof Date ? new Date(value) : parseDate(dateKey(value));
  date.setHours(0, 0, 0, 0);
  const day = date.getDay();
  date.setDate(date.getDate() + (day === 0 ? -6 : 1 - day));
  return date;
}

function formatDate(value, options = { month: 'short', day: 'numeric' }) {
  if (!value) return '—';
  return new Intl.DateTimeFormat(undefined, options).format(parseDate(dateKey(value)));
}

function formatRange(start, end) {
  if (!start || !end) return '—';
  return `${formatDate(start)} – ${formatDate(end)}`;
}

function pick(object, ...keys) {
  for (const key of keys) {
    if (object?.[key] !== undefined) return object[key];
  }
  return undefined;
}

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains('entities')) {
        const entities = database.createObjectStore('entities', { keyPath: 'id' });
        entities.createIndex('type', 'type', { unique: false });
        entities.createIndex('parentId', 'parentId', { unique: false });
        entities.createIndex('startDate', 'startDate', { unique: false });
      }
      if (!database.objectStoreNames.contains('events')) {
        const events = database.createObjectStore('events', { keyPath: 'id' });
        events.createIndex('category', 'category', { unique: false });
        events.createIndex('entityId', 'entityId', { unique: false });
        events.createIndex('occurredAt', 'occurredAt', { unique: false });
        events.createIndex('date', 'date', { unique: false });
      }
      if (!database.objectStoreNames.contains('meta')) {
        database.createObjectStore('meta', { keyPath: 'key' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Could not open the coaching ledger.'));
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
const dbClear = (store) => storeRequest(store, 'readwrite', (s) => s.clear());

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
  await dbPut('meta', { key, value: clone(value) });
  model.meta[key] = clone(value);
}

async function migrateAwaySeededDemo() {
  if (!model.meta.seeded || model.meta.agentOwnedSchemaVersion) return;
  await Promise.all([dbClear('entities'), dbClear('events'), dbClear('meta')]);
  await dbPut('meta', { key: 'schemaVersion', value: SCHEMA_VERSION });
  await dbPut('meta', { key: 'agentOwnedSchemaVersion', value: 1 });
  await loadModel();
}

function commitBatch({ entityPuts = [], eventPuts = [], metaPuts = [], entityDeletes = [], eventDeletes = [] }) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['entities', 'events', 'meta'], 'readwrite');
    const entityStore = transaction.objectStore('entities');
    const eventStore = transaction.objectStore('events');
    const metaStore = transaction.objectStore('meta');

    try {
      entityPuts.forEach((item) => entityStore.put(clone(item)));
      eventPuts.forEach((item) => eventStore.put(clone(item)));
      metaPuts.forEach(({ key, value }) => metaStore.put({ key, value: clone(value) }));
      entityDeletes.forEach((id) => entityStore.delete(id));
      eventDeletes.forEach((id) => eventStore.delete(id));
    } catch (error) {
      transaction.abort();
      reject(error);
      return;
    }

    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error || new Error('Could not commit ledger changes.'));
    transaction.onabort = () => reject(transaction.error || new Error('Ledger transaction aborted.'));
  });
}

function makeEvent(category, action, entityId = null, data = {}, date = null, extra = {}) {
  return {
    id: uid('event'),
    category,
    action,
    domain: extra.domain || null,
    entityId: entityId || null,
    occurredAt: new Date().toISOString(),
    date: date ? dateKey(date) : dateKey(new Date()),
    data: clone(data),
    tags: Array.isArray(extra.tags) ? [...extra.tags] : [],
    note: extra.note || '',
  };
}

async function appendEvent(category, action, entityId = null, data = {}, date = null, extra = {}) {
  const event = makeEvent(category, action, entityId, data, date, extra);
  await dbPut('events', event);
  model.events.push(event);
  return clone(event);
}

function entity(id) {
  return model.entities.find((item) => item.id === id) || null;
}

function entities(type = null) {
  return model.entities.filter((item) => !type || item.type === type);
}

function children(parentId, type = null) {
  return model.entities
    .filter((item) => item.parentId === parentId && (!type || item.type === type))
    .sort((a, b) => String(a.startDate || a.date || '').localeCompare(String(b.startDate || b.date || '')));
}

function eventList({ category = null, domain = null, entityId = null, action = null, startDate = null, endDate = null } = {}) {
  return model.events
    .filter((item) => (!category || item.category === category)
      && (!domain || item.domain === domain || item.action === domain)
      && (!entityId || item.entityId === entityId)
      && (!action || item.action === action)
      && (!startDate || item.date >= startDate)
      && (!endDate || item.date <= endDate))
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
}

function latestEvent(query) {
  return eventList(query)[0] || null;
}

function normalizeRange(raw, label) {
  const startDate = pick(raw, 'startDate', 'start_date');
  const endDate = pick(raw, 'endDate', 'end_date');
  if (!startDate || !endDate) throw new Error(`${label} requires startDate and endDate.`);
  parseDate(startDate, `${label}.startDate`);
  parseDate(endDate, `${label}.endDate`);
  if (endDate < startDate) throw new Error(`${label}.endDate cannot be before startDate.`);
  return { startDate, endDate };
}

function normalizeActivity(raw, index) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error(`Activity ${index + 1} must be an object.`);
  const name = String(raw.name || raw.title || raw.type || '').trim();
  if (!name) throw new Error(`Activity ${index + 1} requires name, title, or type.`);
  return clone(raw);
}

function normalizePrescription(raw, parentId) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Prescription must be an object.');
  const domain = String(raw.domain || '').trim().toLowerCase();
  if (!domain) throw new Error('Prescription requires a domain.');
  const now = new Date().toISOString();
  return {
    id: raw.id || uid('prescription'),
    type: 'prescription',
    parentId: raw.parentId || raw.parent_id || parentId || null,
    domain,
    label: raw.label || domain,
    target: raw.target ?? raw.value ?? null,
    unit: raw.unit || '',
    startDate: pick(raw, 'startDate', 'start_date') || null,
    endDate: pick(raw, 'endDate', 'end_date') || null,
    metadata: clone(raw.metadata || {}),
    status: raw.status || 'active',
    createdAt: now,
    updatedAt: now,
  };
}

function normalizeKpi(raw, parentId) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('KPI must be an object.');
  const name = String(raw.name || raw.label || '').trim();
  if (!name) throw new Error('KPI requires a name.');
  const now = new Date().toISOString();
  return {
    id: raw.id || uid('kpi'),
    type: 'kpi',
    parentId: raw.parentId || raw.parent_id || parentId || null,
    name,
    unit: raw.unit || '',
    targetValue: raw.targetValue ?? raw.target_value ?? raw.target ?? null,
    direction: raw.direction || (raw.lowerBetter || raw.lower_better ? 'lower' : 'higher'),
    metadata: clone(raw.metadata || {}),
    status: raw.status || 'active',
    createdAt: now,
    updatedAt: now,
  };
}

function normalizeProgram(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('program must be an object.');
  const now = new Date().toISOString();
  const result = [];
  const programId = raw.id || uid('program');
  const blocksRaw = Array.isArray(raw.blocks) ? raw.blocks : [];
  const programRange = raw.startDate || raw.start_date
    ? normalizeRange(raw, 'program')
    : blocksRaw.length
      ? {
          startDate: blocksRaw.map((item) => pick(item, 'startDate', 'start_date')).filter(Boolean).sort()[0],
          endDate: blocksRaw.map((item) => pick(item, 'endDate', 'end_date')).filter(Boolean).sort().at(-1),
        }
      : { startDate: null, endDate: null };

  result.push({
    id: programId,
    type: 'program',
    parentId: null,
    title: raw.title || 'Untitled program',
    objective: raw.objective || raw.goal || '',
    startDate: programRange.startDate,
    endDate: programRange.endDate,
    status: raw.status || 'active',
    metadata: clone(raw.metadata || {}),
    createdAt: now,
    updatedAt: now,
  });

  const addNestedPrescriptions = (items, parentId) => {
    (Array.isArray(items) ? items : []).forEach((item) => result.push(normalizePrescription(item, parentId)));
  };
  const addNestedKpis = (items, parentId) => {
    (Array.isArray(items) ? items : []).forEach((item) => result.push(normalizeKpi(item, parentId)));
  };

  addNestedPrescriptions(raw.prescriptions, programId);
  addNestedKpis(raw.kpis, programId);

  blocksRaw.forEach((blockRaw, blockIndex) => {
    const range = normalizeRange(blockRaw, `block ${blockIndex + 1}`);
    const blockId = blockRaw.id || uid('block');
    result.push({
      id: blockId,
      type: 'block',
      parentId: programId,
      title: blockRaw.title || `Block ${blockIndex + 1}`,
      objective: blockRaw.objective || blockRaw.outcome || blockRaw.goal || '',
      outcome: blockRaw.outcome || blockRaw.objective || '',
      startDate: range.startDate,
      endDate: range.endDate,
      order: blockRaw.order ?? blockIndex + 1,
      metadata: clone(blockRaw.metadata || {}),
      status: blockRaw.status || 'active',
      createdAt: now,
      updatedAt: now,
    });

    addNestedPrescriptions(blockRaw.prescriptions, blockId);
    addNestedKpis(blockRaw.kpis, blockId);

    const mesos = Array.isArray(blockRaw.mesocycles) ? blockRaw.mesocycles : [];
    mesos.forEach((mesoRaw, mesoIndex) => {
      const mesoRange = normalizeRange(mesoRaw, `mesocycle ${mesoIndex + 1}`);
      const mesoId = mesoRaw.id || uid('meso');
      result.push({
        id: mesoId,
        type: 'mesocycle',
        parentId: blockId,
        title: mesoRaw.title || `Mesocycle ${mesoIndex + 1}`,
        objective: mesoRaw.objective || mesoRaw.focus || '',
        focus: mesoRaw.focus || mesoRaw.objective || '',
        startDate: mesoRange.startDate,
        endDate: mesoRange.endDate,
        order: mesoRaw.order ?? mesoIndex + 1,
        metadata: clone(mesoRaw.metadata || {}),
        status: mesoRaw.status || 'active',
        createdAt: now,
        updatedAt: now,
      });

      const micros = Array.isArray(mesoRaw.microcycles) ? mesoRaw.microcycles : [];
      micros.forEach((microRaw, microIndex) => {
        const microRange = normalizeRange(microRaw, `microcycle ${microIndex + 1}`);
        const microId = microRaw.id || uid('micro');
        result.push({
          id: microId,
          type: 'microcycle',
          parentId: mesoId,
          title: microRaw.title || `Microcycle ${microIndex + 1}`,
          objective: microRaw.objective || '',
          kind: String(microRaw.kind || microRaw.type_label || 'training').toLowerCase(),
          startDate: microRange.startDate,
          endDate: microRange.endDate,
          order: microRaw.order ?? microIndex + 1,
          metadata: clone(microRaw.metadata || {}),
          status: microRaw.status || 'active',
          createdAt: now,
          updatedAt: now,
        });

        const sessions = Array.isArray(microRaw.sessions) ? microRaw.sessions : [];
        sessions.forEach((sessionRaw, sessionIndex) => {
          const date = pick(sessionRaw, 'date', 'startDate', 'start_date');
          if (!date) throw new Error(`Session ${sessionIndex + 1} requires a date.`);
          parseDate(date, `session ${sessionIndex + 1}.date`);
          const sessionId = sessionRaw.id || uid('session');
          const activities = Array.isArray(sessionRaw.activities)
            ? sessionRaw.activities.map(normalizeActivity)
            : Array.isArray(sessionRaw.prescriptions)
              ? sessionRaw.prescriptions.map((item, index) => normalizeActivity({ name: item.exercise || item.name || `Activity ${index + 1}`, ...item }, index))
              : [];
          result.push({
            id: sessionId,
            type: 'session',
            parentId: microId,
            date,
            startDate: date,
            title: sessionRaw.title || `Session ${sessionIndex + 1}`,
            objective: sessionRaw.objective || '',
            durationMinutes: Number(sessionRaw.durationMinutes ?? sessionRaw.duration_minutes ?? 0) || 0,
            activities,
            metadata: clone(sessionRaw.metadata || {}),
            status: sessionRaw.status || 'planned',
            createdAt: now,
            updatedAt: now,
          });
        });
      });
    });
  });

  validateEntities(result);
  return { programId, entities: result };
}

function validateEntities(records) {
  const map = new Map(records.map((item) => [item.id, item]));
  if (map.size !== records.length) throw new Error('Entity ids must be unique.');

  const insideParent = (item, parent, label) => {
    if (item.startDate && parent.startDate && item.startDate < parent.startDate) {
      throw new Error(`${label} starts before its parent.`);
    }
    if (item.endDate && parent.endDate && item.endDate > parent.endDate) {
      throw new Error(`${label} ends after its parent.`);
    }
  };

  for (const item of records) {
    if (!item.id || !item.type) throw new Error('Every entity requires id and type.');
    if (item.startDate) parseDate(item.startDate, `${item.type}.startDate`);
    if (item.endDate) parseDate(item.endDate, `${item.type}.endDate`);

    if (item.type === 'block') {
      const parent = map.get(item.parentId);
      if (!parent || parent.type !== 'program') throw new Error('Every block must belong to a program.');
      insideParent(item, parent, 'Block');
      const maxEnd = dateKey(addDays(addMonths(item.startDate, 6), -1));
      if (item.endDate > maxEnd) throw new Error('Training blocks cannot exceed six calendar months.');
    }

    if (item.type === 'mesocycle') {
      const parent = map.get(item.parentId);
      if (!parent || parent.type !== 'block') throw new Error('Every mesocycle must belong to a block.');
      insideParent(item, parent, 'Mesocycle');
      if (inclusiveDays(item.startDate, item.endDate) > 28) throw new Error('Mesocycles cannot exceed four weeks.');
    }

    if (item.type === 'microcycle') {
      const parent = map.get(item.parentId);
      if (!parent || parent.type !== 'mesocycle') throw new Error('Every microcycle must belong to a mesocycle.');
      insideParent(item, parent, 'Microcycle');
      if (inclusiveDays(item.startDate, item.endDate) > 7) throw new Error('Microcycles cannot exceed one week.');
    }

    if (item.type === 'session') {
      const parent = map.get(item.parentId);
      if (!parent || parent.type !== 'microcycle') throw new Error('Every session must belong to a microcycle.');
      if (item.date < parent.startDate || item.date > parent.endDate) throw new Error('Session date must fall inside its microcycle.');
      if (!Array.isArray(item.activities)) throw new Error('Session activities must be an array.');
    }

    if (item.type === 'prescription' && item.parentId && !map.has(item.parentId) && !entity(item.parentId)) {
      throw new Error(`Prescription parent not found: ${item.parentId}`);
    }

    if (item.type === 'kpi' && item.parentId && !map.has(item.parentId) && !entity(item.parentId)) {
      throw new Error(`KPI parent not found: ${item.parentId}`);
    }
  }
}

function currentContext() {
  const today = dateKey(new Date());
  const programs = entities('program').filter((item) => item.status !== 'deleted');
  const program = entity(model.meta.activeProgramId)
    || programs.find((item) => (!item.startDate || item.startDate <= today) && (!item.endDate || item.endDate >= today))
    || programs.find((item) => item.status === 'active')
    || programs[0]
    || null;

  if (!program) return { program: null, block: null, mesocycle: null, microcycle: null };

  const blocks = children(program.id, 'block').filter((item) => item.status !== 'archived');
  const block = entity(model.meta.activeBlockId)
    || blocks.find((item) => item.startDate <= today && item.endDate >= today)
    || blocks[0]
    || null;
  if (!block) return { program, block: null, mesocycle: null, microcycle: null };

  const mesos = children(block.id, 'mesocycle').filter((item) => item.status !== 'archived');
  const mesocycle = mesos.find((item) => item.startDate <= today && item.endDate >= today) || mesos[0] || null;
  const micros = mesocycle ? children(mesocycle.id, 'microcycle').filter((item) => item.status !== 'archived') : [];
  const microcycle = micros.find((item) => item.startDate <= today && item.endDate >= today) || micros[0] || null;
  return { program, block, mesocycle, microcycle };
}

function descendants(rootId) {
  const found = [];
  const queue = [rootId];
  while (queue.length) {
    const parentId = queue.shift();
    const next = model.entities.filter((item) => item.parentId === parentId);
    found.push(...next);
    queue.push(...next.map((item) => item.id));
  }
  return found;
}

function buildProgramProjection(programId) {
  const program = entity(programId);
  if (!program || program.type !== 'program') return null;
  return {
    ...clone(program),
    prescriptions: children(program.id, 'prescription'),
    kpis: children(program.id, 'kpi'),
    blocks: children(program.id, 'block').map((block) => ({
      ...clone(block),
      prescriptions: children(block.id, 'prescription'),
      kpis: children(block.id, 'kpi'),
      mesocycles: children(block.id, 'mesocycle').map((meso) => ({
        ...clone(meso),
        microcycles: children(meso.id, 'microcycle').map((micro) => ({
          ...clone(micro),
          sessions: children(micro.id, 'session').map(clone),
        })),
      })),
    })),
  };
}

function relevantPrescriptions(domain, context = currentContext()) {
  const parentIds = [context.microcycle?.id, context.mesocycle?.id, context.block?.id, context.program?.id].filter(Boolean);
  const today = dateKey(new Date());
  return entities('prescription')
    .filter((item) => item.status !== 'archived'
      && item.domain === domain
      && (!item.parentId || parentIds.includes(item.parentId))
      && (!item.startDate || item.startDate <= today)
      && (!item.endDate || item.endDate >= today))
    .sort((a, b) => parentIds.indexOf(a.parentId) - parentIds.indexOf(b.parentId));
}

function kpisForContext(context = currentContext()) {
  const parentIds = [context.block?.id, context.program?.id].filter(Boolean);
  return entities('kpi').filter((item) => item.status !== 'archived' && (!item.parentId || parentIds.includes(item.parentId)));
}

function sessionResult(sessionId) {
  return latestEvent({ category: 'observation', domain: 'training', entityId: sessionId });
}

function statusForSession(session) {
  const result = sessionResult(session.id);
  if (!result) return { mark: '·', label: 'PLANNED', cls: 'status-planned', duration: session.durationMinutes || 0 };
  const status = String(result.data.status || '').toLowerCase();
  const completed = result.data.completed === true || status === 'completed' || status === 'done';
  const missed = result.data.completed === false || status === 'missed' || status === 'skipped';
  if (missed) return { mark: '✕', label: 'MISSED', cls: 'status-missed', duration: Number(result.data.actualMinutes ?? result.data.durationMinutes ?? 0) || 0 };
  if (completed) return { mark: '✓', label: 'DONE', cls: 'status-complete', duration: Number(result.data.actualMinutes ?? result.data.durationMinutes ?? session.durationMinutes ?? 0) || 0 };
  return { mark: '·', label: 'LOGGED', cls: 'status-planned', duration: Number(result.data.actualMinutes ?? session.durationMinutes ?? 0) || 0 };
}

function microStats(microId) {
  const sessions = children(microId, 'session');
  const results = sessions.map((item) => sessionResult(item.id)).filter(Boolean);
  const completed = sessions.filter((session) => statusForSession(session).label === 'DONE').length;
  const plannedMinutes = sessions.reduce((sum, item) => sum + Number(item.durationMinutes || 0), 0);
  const actualMinutes = results.reduce((sum, item) => sum + Number(item.data.actualMinutes ?? item.data.durationMinutes ?? 0), 0);
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

function renderContext() {
  const context = currentContext();
  $('programTitle').textContent = context.program?.title || '';
  document.querySelector('.subtabs').hidden = !context.block;
}

function displayValue(value) {
  if (value === null || value === undefined || value === '') return '—';
  if (Array.isArray(value)) return value.map(displayValue).join(', ');
  if (typeof value === 'object') return Object.entries(value).map(([key, val]) => `${key}: ${displayValue(val)}`).join(' · ');
  return String(value);
}

function activityDetails(activity) {
  const explicit = activity.prescription && typeof activity.prescription === 'object' ? activity.prescription : null;
  const omit = new Set(['name', 'title', 'type', 'prescription', 'metadata', 'note']);
  const source = explicit || Object.fromEntries(Object.entries(activity).filter(([key]) => !omit.has(key)));
  return Object.entries(source)
    .filter(([, value]) => value !== null && value !== undefined && value !== '')
    .map(([key, value]) => `${key.replace(/_/g, ' ')} ${displayValue(value)}`)
    .join(' · ');
}

function renderMicrocycle(currentMicro) {
  const context = currentContext();
  const weeks = context.block ? blockMicros(context.block.id).filter((week) => week.status !== 'archived').sort((a, b) => a.startDate.localeCompare(b.startDate)) : [];
  const micro = weeks.find((week) => week.id === selectedMicroId) || currentMicro;
  if (!micro) {
    return '<div class="empty welcome"><p class="eyebrow">Start here</p><h2>A place for your<br>next session.</h2><p>Build a plan with your agent, then keep your training and progress here.</p><div class="welcome-actions"><button class="primary-button" type="button" data-open-guide>Set up your plan <span aria-hidden="true">↗</span></button><button class="secondary-button" type="button" data-restore>Restore backup</button></div></div>';
  }
  const sessions = children(micro.id, 'session');
  const dates = datesForCurrentWeek(micro);
  const today = dateKey(new Date());
  if (!dates.includes(selectedDate)) selectedDate = dates.includes(today) ? today : dates[0];
  const stats = microStats(micro.id);
  const weekIndex = weeks.findIndex((week) => week.id === micro.id);
  let html = `<div class="week-heading"><div><h2>${esc(micro.title)}</h2><p>${esc(formatRange(micro.startDate, micro.endDate))}</p></div><div class="week-nav"><button class="icon-button" type="button" data-week-shift="-1" aria-label="Previous week" ${weekIndex <= 0 ? 'disabled' : ''}>‹</button><button class="icon-button" type="button" data-week-shift="1" aria-label="Next week" ${weekIndex < 0 || weekIndex >= weeks.length - 1 ? 'disabled' : ''}>›</button></div></div>`;
  html += '<div class="week-strip" role="group" aria-label="Select training day">';
  for (const date of dates) {
    const daySessions = sessions.filter((session) => session.date === date);
    const done = daySessions.filter((session) => statusForSession(session).label === 'DONE').length;
    const weekday = formatDate(date, { weekday: 'short' });
    const caption = !daySessions.length ? 'Rest' : done === daySessions.length ? 'Done' : daySessions.length > 1 ? `${daySessions.length} sessions` : 'Train';
    html += `<button type="button" class="day-button ${date === selectedDate ? 'selected' : ''} ${date === today ? 'today' : ''}" data-day="${date}" aria-pressed="${date === selectedDate}" aria-label="${esc(formatDate(date, { weekday: 'long', month: 'long', day: 'numeric' }))}${date === today ? ', today' : ''}, ${caption}"><span class="day-weekday">${esc(weekday)}</span><span class="day-number">${parseDate(date).getDate()}</span><span class="day-caption">${caption}</span></button>`;
  }
  html += '</div><div class="session-layout"><div class="session-stack">';
  const daySessions = sessions.filter((session) => session.date === selectedDate);
  if (!daySessions.length) html += '<div class="empty"><strong>No session scheduled.</strong><p>Your next training day is a tap away.</p></div>';
  for (const session of daySessions) {
    const status = statusForSession(session);
    const result = sessionResult(session.id);
    const activities = session.activities || [];
    const label = { DONE: 'Completed', MISSED: 'Missed', PLANNED: 'Planned', LOGGED: 'Logged' }[status.label];
    html += `<article class="session-card"><header class="session-card-head"><div><p class="eyebrow">${esc(formatDate(selectedDate, { weekday: 'long' }))}${selectedDate === today ? ' / Today' : ''}</p><h3>${esc(session.title)}</h3><div class="session-meta"><span>${activities.length} ${activities.length === 1 ? 'activity' : 'activities'}</span>${session.durationMinutes ? `<span>${esc(session.durationMinutes)} min planned</span>` : ''}</div></div><span class="session-badge ${status.cls}">${label}</span></header><ol class="activity-list">`;
    activities.forEach((activity, index) => {
      const explicit = activity.prescription && typeof activity.prescription === 'object' ? activity.prescription : null;
      const omit = new Set(['name', 'title', 'type', 'prescription', 'metadata', 'note']);
      const values = Object.entries(explicit || activity).filter(([key, value]) => !omit.has(key) && value !== null && value !== undefined && value !== '');
      html += `<li class="activity"><span class="activity-number" aria-hidden="true">${String(index + 1).padStart(2, '0')}</span><div><h4 class="activity-name" style="margin:0">${esc(activity.name || activity.title || activity.type || 'Activity')}</h4><div class="activity-values">${values.map(([key, value]) => `<span><b>${esc(displayValue(value))}</b> ${esc(key.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/_/g, ' ').toLowerCase())}</span>`).join('')}</div>${activity.note ? `<p class="activity-note">${esc(activity.note)}</p>` : ''}</div></li>`;
    });
    html += `</ol><footer class="session-footer"><div><p>${result ? `${label}${status.duration ? ` · ${status.duration} min logged` : ''}` : 'Ready when you are.'}</p>${result?.note ? `<p class="session-note">${esc(result.note)}</p>` : ''}</div><button class="${result ? 'secondary-button' : 'primary-button'}" type="button" data-log-session="${esc(session.id)}">${result ? 'Update log' : 'Log session'} <span aria-hidden="true">↗</span></button></footer></article>`;
  }
  html += `</div><aside class="week-overview" aria-label="Week summary"><p class="eyebrow">This week</p><div class="overview-number"><strong>${stats.completed}<span> / ${stats.sessions}</span></strong><span>sessions done</span></div><progress max="${Math.max(1, stats.sessions)}" value="${stats.completed}" aria-label="Completed sessions"></progress><dl class="overview-stats"><div><dt>Completion</dt><dd>${stats.sessions ? Math.round(stats.adherence * 100) + '%' : '—'}</dd></div><div><dt>Planned time</dt><dd>${stats.plannedMinutes} min</dd></div><div><dt>Logged time</dt><dd>${stats.actualMinutes} min</dd></div></dl>`;
  const meso = entity(micro.parentId);
  if (meso) html += `<div class="context-detail"><p class="eyebrow">Current cycle</p><h3>${esc(meso.title)}</h3><p>${esc(meso.objective || meso.focus || formatRange(meso.startDate, meso.endDate))}</p></div>`;
  if (context.block) html += `<div class="context-detail"><p class="eyebrow">Training block</p><h3>${esc(context.block.title)}</h3><p>${esc(context.block.objective || context.block.outcome || formatRange(context.block.startDate, context.block.endDate))}</p></div>`;
  return html + '</aside></div>';
}

function renderMesocycle(meso) {
  if (!meso) return '<div class="empty">No cycle planned yet.</div>';
  const micros = children(meso.id, 'microcycle');
  const total = mesoStats(meso.id);
  let html = `<div class="view-head"><div><span>MESOCYCLE</span><h2>${esc(meso.title)}</h2></div><small>${esc(meso.objective || meso.focus || '')}</small></div>`;
  html += `<div class="summary-line"><div><span>WEEKS</span><strong>${total.weeks}</strong></div><div><span>SESSIONS</span><strong>${total.completed}/${total.sessions}</strong></div><div><span>ADHERENCE</span><strong>${Math.round(total.adherence * 100)}%</strong></div></div>`;
  html += '<table class="scale-table"><thead><tr><th>WEEK</th><th>TYPE</th><th>DATES</th><th>SESSIONS</th><th>ADHERENCE</th><th>TIME</th></tr></thead><tbody>';
  for (const micro of micros) {
    const stats = microStats(micro.id);
    const current = currentContext().microcycle?.id === micro.id ? ' current-row' : '';
    const deload = String(micro.kind).toLowerCase() === 'deload' ? ' deload-row' : '';
    html += `<tr class="${current}${deload}"><td><strong>${esc(micro.title)}</strong></td><td>${esc(String(micro.kind || 'training').toUpperCase())}</td><td>${esc(formatRange(micro.startDate, micro.endDate))}</td><td>${stats.completed}/${stats.sessions}</td><td>${Math.round(stats.adherence * 100)}%</td><td>${stats.actualMinutes}/${stats.plannedMinutes} min</td></tr>`;
  }
  html += '</tbody></table>';
  return html;
}

function renderDeload(block) {
  if (!block) return '<div class="empty">No training block planned yet.</div>';
  const deloads = blockMicros(block.id).filter((item) => String(item.kind).toLowerCase() === 'deload');
  let html = `<div class="view-head"><div><span>DELOADS</span><h2>${esc(block.title)}</h2></div><small>${deloads.length} recorded</small></div>`;
  if (!deloads.length) return html + '<div class="empty">No deload scheduled in this block.</div>';
  html += '<table class="scale-table"><thead><tr><th>DELOAD</th><th>DATES</th><th>SESSIONS</th><th>PLANNED TIME</th><th>CONTENTS</th></tr></thead><tbody>';
  for (const micro of deloads) {
    const sessions = children(micro.id, 'session');
    const stats = microStats(micro.id);
    html += `<tr><td><strong>${esc(micro.title)}</strong></td><td>${esc(formatRange(micro.startDate, micro.endDate))}</td><td>${stats.sessions}</td><td>${stats.plannedMinutes} min</td><td>${esc(sessions.map((item) => item.title).join(' / ') || '—')}</td></tr>`;
  }
  html += '</tbody></table>';
  return html;
}

function renderBlock(block) {
  if (!block) return '<div class="empty">No training block planned yet.</div>';
  const mesos = children(block.id, 'mesocycle');
  let html = `<div class="view-head"><div><span>TRAINING BLOCK</span><h2>${esc(block.title)}</h2></div><small>${esc(formatRange(block.startDate, block.endDate))}</small></div>`;
  html += `<div class="summary-line"><div><span>PRIMARY OBJECTIVE</span><strong>${esc(block.objective || block.outcome || '—')}</strong></div><div><span>DURATION</span><strong>${blockMicros(block.id).length} microcycles</strong></div></div>`;
  html += '<div class="block-bar">';
  for (const meso of mesos) {
    const micros = children(meso.id, 'microcycle');
    const stats = mesoStats(meso.id);
    html += `<section class="block-segment"><span>MESOCYCLE ${esc(meso.order ?? '')}</span><strong>${esc(meso.title)}</strong><span>${esc(formatRange(meso.startDate, meso.endDate))}</span><ul><li>${esc(meso.objective || meso.focus || 'No objective supplied.')}</li><li>${micros.length} microcycles</li><li>${stats.sessions} planned sessions</li><li>${Math.round(stats.adherence * 100)}% adherence</li></ul></section>`;
  }
  html += '</div>';
  return html;
}

function eventSummary(event) {
  if (event.category === 'observation') return `${event.domain || event.action}: ${displayValue(event.data)}`;
  if (event.category === 'measurement') return `${displayValue(event.data.value)} ${event.data.unit || ''}`;
  if (event.category === 'program') return event.data?.summary || event.action;
  if (event.category === 'system') return event.action;
  return displayValue(event.data);
}

function renderLedger() {
  const list = [...model.events].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
  let html = `<div class="view-head"><div><span>HISTORICAL RECORD</span><h2>History</h2></div><small>${list.length} records</small></div>`;
  if (!list.length) return html + '<div class="empty">No history yet. Your completed sessions, measurements, and plan changes will appear here.</div>';
  html += '<table class="ledger-table"><thead><tr><th>TIME</th><th>DOMAIN</th><th>ACTION</th><th>DATA</th><th></th></tr></thead><tbody>';
  for (const event of list.slice(0, 300)) {
    const domain = event.domain || event.category;
    html += `<tr><td>${esc(new Date(event.occurredAt).toLocaleString())}</td><td>${esc(String(domain).toUpperCase())}</td><td>${esc(event.action)}</td><td>${esc(eventSummary(event))}</td><td><button class="ledger-delete" data-delete-event="${esc(event.id)}" aria-label="Delete history record">Delete</button></td></tr>`;
  }
  html += '</tbody></table>';
  return html;
}

function datesForCurrentWeek(micro) {
  if (micro) {
    const start = parseDate(micro.startDate);
    return Array.from({ length: Math.min(7, inclusiveDays(micro.startDate, micro.endDate)) }, (_, index) => dateKey(addDays(start, index)));
  }
  const start = mondayOf(new Date());
  return Array.from({ length: 7 }, (_, index) => dateKey(addDays(start, index)));
}

function latestDailyObservation(domain, date) {
  return eventList({ category: 'observation', domain }).find((item) => item.date === date) || null;
}

function targetNumber(prescription) {
  const value = prescription?.target;
  if (typeof value === 'number') return value;
  if (value && typeof value === 'object') {
    const candidate = value.grams ?? value.hours ?? value.value ?? value.target;
    return Number.isFinite(Number(candidate)) ? Number(candidate) : null;
  }
  return Number.isFinite(Number(value)) ? Number(value) : null;
}

function renderProtein(micro) {
  const prescription = relevantPrescriptions('protein')[0] || null;
  const target = targetNumber(prescription);
  const unit = prescription?.unit || 'g';
  let html = `<div class="view-head"><div><span>AGENT-AUTHORED PRESCRIPTION</span><h2>Protein</h2></div><small>${prescription ? esc(`${displayValue(prescription.target)} ${unit}`) : 'No prescription'}</small></div>`;
  if (!prescription && !eventList({ category: 'observation', domain: 'protein' }).length) {
    return html + '<div class="empty">No protein target yet. Ask your agent to add a target and record your intake.</div>';
  }
  html += '<table class="domain-table"><thead><tr><th>DAY</th><th>DATE</th><th>TARGET</th><th>LOGGED</th><th>STATUS</th></tr></thead><tbody>';
  for (const date of datesForCurrentWeek(micro)) {
    const event = latestDailyObservation('protein', date);
    const logged = Number(event?.data.grams ?? event?.data.value);
    const hasLogged = Number.isFinite(logged);
    const status = target == null || !hasLogged ? '—' : logged >= target * 0.9 ? '✓' : '✕';
    html += `<tr><td>${esc(new Intl.DateTimeFormat(undefined, { weekday: 'long' }).format(parseDate(date)).toUpperCase())}</td><td>${esc(formatDate(date))}</td><td>${prescription ? esc(`${displayValue(prescription.target)} ${unit}`) : '—'}</td><td>${hasLogged ? `${logged} ${esc(event?.data.unit || unit)}` : '—'}</td><td class="${status === '✓' ? 'status-complete' : status === '✕' ? 'status-missed' : ''}">${status}</td></tr>`;
  }
  html += '</tbody></table>';
  return html;
}

function renderSleep(micro) {
  const prescription = relevantPrescriptions('sleep')[0] || null;
  const target = targetNumber(prescription);
  const unit = prescription?.unit || 'h';
  let html = `<div class="view-head"><div><span>RECOVERY LEDGER</span><h2>Sleep</h2></div><small>${prescription ? esc(`${displayValue(prescription.target)} ${unit}`) : 'No prescription'}</small></div>`;
  if (!prescription && !eventList({ category: 'observation', domain: 'sleep' }).length) {
    return html + '<div class="empty">No sleep recorded yet. Ask your agent to add a sleep target and log your nights.</div>';
  }
  html += '<table class="domain-table"><thead><tr><th>DAY</th><th>DATE</th><th>TARGET</th><th>SLEEP</th><th>READINESS</th><th>NOTES</th></tr></thead><tbody>';
  for (const date of datesForCurrentWeek(micro)) {
    const event = latestDailyObservation('sleep', date);
    const hours = event?.data.hours ?? event?.data.value ?? '—';
    html += `<tr><td>${esc(new Intl.DateTimeFormat(undefined, { weekday: 'long' }).format(parseDate(date)).toUpperCase())}</td><td>${esc(formatDate(date))}</td><td>${prescription ? esc(`${displayValue(prescription.target)} ${unit}`) : '—'}</td><td>${esc(hours)}</td><td>${esc(event?.data.readiness ?? '—')}</td><td>${esc(event?.note || event?.data.notes || '')}</td></tr>`;
  }
  html += '</tbody></table>';
  return html;
}

function renderKpis(block) {
  const context = currentContext();
  const kpis = kpisForContext(context);
  let html = `<div class="view-head"><div><span>AGENT-DEFINED PERFORMANCE OUTCOMES</span><h2>Progress</h2></div><small>${kpis.length} tracked</small></div>`;
  if (!kpis.length) return html + '<div class="empty">Your progress starts with a baseline. Ask your agent to add the measurements you want to track.</div>';
  html += '<table class="domain-table"><thead><tr><th>MEASUREMENT</th><th>START</th><th>CURRENT</th><th>CHANGE</th><th>TARGET</th><th>LAST TEST</th></tr></thead><tbody>';
  for (const kpi of kpis) {
    const measurements = eventList({ category: 'measurement', entityId: kpi.id }).sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
    const first = measurements[0];
    const last = measurements.at(-1);
    const start = Number(first?.data.value);
    const current = Number(last?.data.value);
    const change = Number.isFinite(start) && Number.isFinite(current) ? current - start : null;
    const sign = change > 0 ? '+' : '';
    html += `<tr><td><strong>${esc(kpi.name)}</strong><span>${esc(kpi.unit)}</span></td><td>${first ? `${start} ${esc(kpi.unit)}` : '—'}</td><td>${last ? `${current} ${esc(kpi.unit)}` : '—'}</td><td>${change == null ? '—' : `${sign}${Math.round(change * 100) / 100} ${esc(kpi.unit)}`}</td><td>${esc(kpi.targetValue ?? '—')} ${esc(kpi.unit)}</td><td>${last ? esc(formatDate(last.date)) : '—'}</td></tr>`;
  }
  html += '</tbody></table>';
  return html;
}

function render() {
  const context = currentContext();
  renderContext();
  document.querySelectorAll('.tabs button').forEach((button) => {
    const active = button.dataset.tab === activeTab;
    button.classList.toggle('active', active);
    if (active) button.setAttribute('aria-current', 'page');
    else button.removeAttribute('aria-current');
  });
  document.querySelectorAll('.tab-view').forEach((section) => section.classList.toggle('active', section.id === `${activeTab}Tab`));
  document.querySelectorAll('.subtabs button').forEach((button) => {
    const active = button.dataset.view === activeView;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });
  const tableView = (html) => html.replace(/<table /g, '<div class="table-scroll" role="region" aria-label="Scrollable data table" tabindex="0"><table ').replace(/<\/table>/g, '</table></div>');
  if (activeView === 'microcycle') $('trainingView').innerHTML = renderMicrocycle(context.microcycle);
  else if (activeView === 'mesocycle') $('trainingView').innerHTML = tableView(renderMesocycle(context.mesocycle));
  else if (activeView === 'deload') $('trainingView').innerHTML = tableView(renderDeload(context.block));
  else if (activeView === 'block') $('trainingView').innerHTML = renderBlock(context.block);
  else $('trainingView').innerHTML = tableView(renderLedger());
  $('proteinView').innerHTML = tableView(renderProtein(context.microcycle));
  $('sleepView').innerHTML = tableView(renderSleep(context.microcycle));
  $('kpiView').innerHTML = tableView(renderKpis(context.block));
  $('historyView').innerHTML = tableView(renderLedger());
  $('storageStatus').textContent = 'Saved in this browser';
}


async function refresh() {
  await loadModel();
  render();
}

async function applyProgram({ program, activate = true }) {
  const normalized = normalizeProgram(program);
  const oldProgram = entity(model.meta.activeProgramId);
  const entityPuts = [...normalized.entities];
  const eventPuts = [];

  if (oldProgram && oldProgram.id !== normalized.programId && oldProgram.status === 'active') {
    const archived = { ...oldProgram, status: 'superseded', updatedAt: new Date().toISOString() };
    entityPuts.push(archived);
    eventPuts.push(makeEvent('program', 'program_superseded', oldProgram.id, {
      before: oldProgram,
      after: archived,
      summary: `Superseded ${oldProgram.title}.`,
    }));
  }

  eventPuts.push(makeEvent('program', 'program_applied', normalized.programId, {
    summary: `Applied ${normalized.entities.filter((item) => item.type === 'block').length} block(s), ${normalized.entities.filter((item) => item.type === 'mesocycle').length} mesocycle(s), ${normalized.entities.filter((item) => item.type === 'microcycle').length} microcycle(s), and ${normalized.entities.filter((item) => item.type === 'session').length} session(s).`,
    entityIds: normalized.entities.map((item) => item.id),
  }, normalized.entities[0].startDate || dateKey(new Date())));

  const metaPuts = [
    { key: 'schemaVersion', value: SCHEMA_VERSION },
    { key: 'agentOwnedSchemaVersion', value: 1 },
  ];
  if (activate) {
    metaPuts.push({ key: 'activeProgramId', value: normalized.programId });
    const firstBlock = normalized.entities.find((item) => item.type === 'block');
    metaPuts.push({ key: 'activeBlockId', value: firstBlock?.id || null });
  }

  await commitBatch({ entityPuts, eventPuts, metaPuts });
  await refresh();
  return buildProgramProjection(normalized.programId);
}

async function patchProgram({ patches }) {
  if (!Array.isArray(patches) || !patches.length) throw new Error('patches must contain at least one change.');
  const protectedKeys = new Set(['id', 'type', 'parentId', 'createdAt']);
  const finalMap = new Map(model.entities.map((item) => [item.id, clone(item)]));
  const eventPuts = [];
  const entityPuts = [];

  for (const change of patches) {
    const current = finalMap.get(change.entity_id || change.entityId);
    if (!current) throw new Error(`Program entity not found: ${change.entity_id || change.entityId}`);
    const clean = Object.fromEntries(Object.entries(change.patch || {}).filter(([key]) => !protectedKeys.has(key)));
    const updated = { ...current, ...clone(clean), updatedAt: new Date().toISOString() };
    finalMap.set(updated.id, updated);
    entityPuts.push(updated);
    eventPuts.push(makeEvent('program', 'entity_updated', updated.id, {
      before: current,
      after: updated,
      summary: `Updated ${updated.type} ${updated.title || updated.name || updated.id}.`,
    }, updated.date || updated.startDate || dateKey(new Date())));
  }

  validateEntities([...finalMap.values()].filter((item) => ['program', 'block', 'mesocycle', 'microcycle', 'session', 'prescription', 'kpi'].includes(item.type)));
  await commitBatch({ entityPuts, eventPuts });
  await refresh();
  return entityPuts.map(clone);
}

async function appendObservations({ observations }) {
  if (!Array.isArray(observations) || !observations.length) throw new Error('observations must contain at least one item.');
  const eventPuts = observations.map((raw) => {
    const domain = String(raw.domain || '').trim().toLowerCase();
    if (!domain) throw new Error('Every observation requires a domain.');
    const entityId = raw.entity_id || raw.entityId || null;
    if (entityId && !entity(entityId)) throw new Error(`Observation entity not found: ${entityId}`);
    const date = raw.date || dateKey(new Date());
    parseDate(date, 'observation.date');
    return makeEvent('observation', domain, entityId, raw.data || {}, date, {
      domain,
      tags: raw.tags,
      note: raw.note || '',
    });
  });
  await commitBatch({ eventPuts });
  await refresh();
  return eventPuts.map(clone);
}

async function appendMeasurements({ measurements }) {
  if (!Array.isArray(measurements) || !measurements.length) throw new Error('measurements must contain at least one item.');
  const eventPuts = measurements.map((raw) => {
    const kpiId = raw.kpi_id || raw.kpiId || raw.entity_id || raw.entityId;
    const kpi = entity(kpiId);
    if (!kpi || kpi.type !== 'kpi') throw new Error(`KPI not found: ${kpiId}`);
    const value = Number(raw.value);
    if (!Number.isFinite(value)) throw new Error(`Measurement for ${kpi.name} requires a finite value.`);
    const date = raw.date || dateKey(new Date());
    parseDate(date, 'measurement.date');
    return makeEvent('measurement', 'measurement', kpi.id, {
      value,
      unit: raw.unit || kpi.unit || '',
      metadata: clone(raw.metadata || {}),
    }, date, { domain: 'kpi', note: raw.note || '' });
  });
  await commitBatch({ eventPuts });
  await refresh();
  return eventPuts.map(clone);
}

async function setPrescriptions({ prescriptions }) {
  if (!Array.isArray(prescriptions) || !prescriptions.length) throw new Error('prescriptions must contain at least one item.');
  const context = currentContext();
  const entityPuts = [];
  const eventPuts = [];

  for (const raw of prescriptions) {
    const parentId = raw.parent_id || raw.parentId || context.block?.id || context.program?.id || null;
    const normalized = normalizePrescription(raw, parentId);
    const existing = raw.id
      ? entity(raw.id)
      : entities('prescription').find((item) => item.domain === normalized.domain && item.parentId === normalized.parentId && item.status !== 'archived');

    if (existing) {
      const updated = {
        ...existing,
        ...normalized,
        id: existing.id,
        createdAt: existing.createdAt,
        updatedAt: new Date().toISOString(),
      };
      entityPuts.push(updated);
      eventPuts.push(makeEvent('program', 'prescription_updated', existing.id, {
        before: existing,
        after: updated,
        summary: `Updated ${updated.domain} prescription.`,
      }, updated.startDate || dateKey(new Date())));
    } else {
      entityPuts.push(normalized);
      eventPuts.push(makeEvent('program', 'prescription_created', normalized.id, {
        after: normalized,
        summary: `Created ${normalized.domain} prescription.`,
      }, normalized.startDate || dateKey(new Date())));
    }
  }

  validateEntities([...model.entities.filter((item) => !entityPuts.some((next) => next.id === item.id)), ...entityPuts]);
  await commitBatch({ entityPuts, eventPuts });
  await refresh();
  return entityPuts.map(clone);
}

async function setKpiSchema({ kpis, replace = false }) {
  if (!Array.isArray(kpis)) throw new Error('kpis must be an array.');
  const context = currentContext();
  const parentId = context.block?.id || context.program?.id || null;
  if (!parentId && kpis.length) throw new Error('A program must exist before KPIs can be attached.');

  const entityPuts = [];
  const eventPuts = [];
  if (replace) {
    for (const existing of kpisForContext(context)) {
      const archived = { ...existing, status: 'archived', updatedAt: new Date().toISOString() };
      entityPuts.push(archived);
      eventPuts.push(makeEvent('program', 'kpi_archived', existing.id, { before: existing, after: archived, summary: `Archived KPI ${existing.name}.` }));
    }
  }

  for (const raw of kpis) {
    const existing = raw.id ? entity(raw.id) : null;
    const normalized = normalizeKpi(raw, raw.parent_id || raw.parentId || parentId);
    if (existing) {
      const updated = { ...existing, ...normalized, id: existing.id, createdAt: existing.createdAt, updatedAt: new Date().toISOString() };
      entityPuts.push(updated);
      eventPuts.push(makeEvent('program', 'kpi_updated', existing.id, { before: existing, after: updated, summary: `Updated KPI ${updated.name}.` }));
    } else {
      entityPuts.push(normalized);
      eventPuts.push(makeEvent('program', 'kpi_created', normalized.id, { after: normalized, summary: `Created KPI ${normalized.name}.` }));
    }
  }

  await commitBatch({ entityPuts, eventPuts });
  await refresh();
  return entityPuts.filter((item) => item.type === 'kpi').map(clone);
}

function getCoachingState({ scope = 'current' } = {}) {
  const context = currentContext();
  if (scope === 'full') return clone(model);
  if (scope === 'program') {
    return {
      activeProgramId: context.program?.id || null,
      program: context.program ? buildProgramProjection(context.program.id) : null,
    };
  }
  return {
    context: clone(context),
    program: context.program ? buildProgramProjection(context.program.id) : null,
    prescriptions: entities('prescription').filter((item) => item.status !== 'archived'),
    kpis: kpisForContext(context),
    recentHistory: eventList().slice(0, 50),
  };
}

function getHistory({ domains = [], start_date = null, end_date = null, limit = 200 } = {}) {
  if (start_date) parseDate(start_date, 'start_date');
  if (end_date) parseDate(end_date, 'end_date');
  const wanted = Array.isArray(domains) ? domains.map((item) => String(item).toLowerCase()) : [];
  return eventList({ startDate: start_date, endDate: end_date })
    .filter((item) => !wanted.length || wanted.includes(String(item.domain || item.category).toLowerCase()))
    .slice(0, Math.max(1, Math.min(1000, Number(limit) || 200)))
    .map(clone);
}

async function setActiveProgram({ program_id, block_id = null }) {
  const program = entity(program_id);
  if (!program || program.type !== 'program') throw new Error('program_id must identify a program.');
  const metaPuts = [{ key: 'activeProgramId', value: program.id }];
  if (block_id) {
    const block = entity(block_id);
    if (!block || block.type !== 'block' || block.parentId !== program.id) throw new Error('block_id must identify a block inside the program.');
    metaPuts.push({ key: 'activeBlockId', value: block.id });
  } else {
    metaPuts.push({ key: 'activeBlockId', value: children(program.id, 'block')[0]?.id || null });
  }
  await commitBatch({ metaPuts, eventPuts: [makeEvent('program', 'active_program_changed', program.id, { summary: `Activated ${program.title}.` })] });
  await refresh();
  return getCoachingState({ scope: 'current' });
}

async function deleteRecord({ record_type, id, cascade = false }) {
  if (record_type === 'event') {
    if (!model.events.some((item) => item.id === id)) throw new Error('Ledger event not found.');
    await commitBatch({ eventDeletes: [id] });
    await refresh();
    return { deleted: id, record_type: 'event' };
  }

  if (record_type !== 'entity') throw new Error('record_type must be event or entity.');
  const target = entity(id);
  if (!target) throw new Error('Entity not found.');
  const nested = descendants(id);
  if (nested.length && !cascade) throw new Error('Entity has children. Set cascade=true to delete the entire subtree explicitly.');
  const entityIds = [id, ...nested.map((item) => item.id)];
  const relatedEvents = model.events.filter((item) => item.entityId && entityIds.includes(item.entityId)).map((item) => item.id);
  await commitBatch({
    entityDeletes: entityIds,
    eventDeletes: relatedEvents,
    eventPuts: [makeEvent('system', 'entity_deleted', null, { deletedEntityIds: entityIds, relatedEventCount: relatedEvents.length })],
  });
  await refresh();
  return { deleted: entityIds, relatedEventsDeleted: relatedEvents.length };
}

function toolResult(data) {
  return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
}

async function registerWebMcp() {
  const modelContext = document.modelContext || navigator.modelContext;
  const status = $('webmcpStatus');
  if (!modelContext?.registerTool) {
    status.className = 'mcp-status unavailable';
    status.innerHTML = '<i></i><span>Agent connection unavailable</span>';
    return;
  }

  const tools = [
    {
      name: 'get_coaching_state',
      description: 'Read the current agent-authored coaching state or the full local coaching model.',
      inputSchema: { type: 'object', properties: { scope: { type: 'string', enum: ['current', 'program', 'full'] } } },
      annotations: { readOnlyHint: true },
      execute: async (input = {}) => toolResult(getCoachingState(input)),
    },
    {
      name: 'get_history',
      description: 'Read the growing coaching ledger, optionally filtered by domain and date range.',
      inputSchema: {
        type: 'object',
        properties: {
          domains: { type: 'array', items: { type: 'string' } },
          start_date: { type: ['string', 'null'] },
          end_date: { type: ['string', 'null'] },
          limit: { type: 'number' },
        },
      },
      annotations: { readOnlyHint: true },
      execute: async (input = {}) => toolResult(getHistory(input)),
    },
    {
      name: 'apply_program',
      description: 'Author an entire coaching program from conversation. The site validates and stores the supplied structure but does not invent programming decisions.',
      inputSchema: {
        type: 'object',
        properties: {
          program: { type: 'object', additionalProperties: true },
          activate: { type: 'boolean' },
        },
        required: ['program'],
      },
      annotations: { readOnlyHint: false },
      execute: async (input) => toolResult(await applyProgram(input)),
    },
    {
      name: 'patch_program',
      description: 'Patch one or more future/current program entities while preserving before/after changes in the ledger.',
      inputSchema: {
        type: 'object',
        properties: {
          patches: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                entity_id: { type: 'string' },
                patch: { type: 'object', additionalProperties: true },
              },
              required: ['entity_id', 'patch'],
            },
          },
        },
        required: ['patches'],
      },
      annotations: { readOnlyHint: false },
      execute: async (input) => toolResult(await patchProgram(input)),
    },
    {
      name: 'append_observation',
      description: 'Append lived data to the coaching ledger, such as a completed session, protein intake, sleep, soreness, readiness, pain, or any other relevant observation.',
      inputSchema: {
        type: 'object',
        properties: {
          observations: { type: 'array', items: { type: 'object', additionalProperties: true } },
        },
        required: ['observations'],
      },
      annotations: { readOnlyHint: false },
      execute: async (input) => toolResult(await appendObservations(input)),
    },
    {
      name: 'append_measurement',
      description: 'Append one or more measurements for KPIs defined by the agent.',
      inputSchema: {
        type: 'object',
        properties: {
          measurements: { type: 'array', items: { type: 'object', additionalProperties: true } },
        },
        required: ['measurements'],
      },
      annotations: { readOnlyHint: false },
      execute: async (input) => toolResult(await appendMeasurements(input)),
    },
    {
      name: 'set_prescriptions',
      description: 'Set or update coaching prescriptions such as protein, sleep, recovery, or other agent-defined targets.',
      inputSchema: {
        type: 'object',
        properties: {
          prescriptions: { type: 'array', items: { type: 'object', additionalProperties: true } },
        },
        required: ['prescriptions'],
      },
      annotations: { readOnlyHint: false },
      execute: async (input) => toolResult(await setPrescriptions(input)),
    },
    {
      name: 'set_kpi_schema',
      description: 'Define or revise the user-specific KPI schema. KPIs are not hardcoded by the website.',
      inputSchema: {
        type: 'object',
        properties: {
          kpis: { type: 'array', items: { type: 'object', additionalProperties: true } },
          replace: { type: 'boolean' },
        },
        required: ['kpis'],
      },
      annotations: { readOnlyHint: false },
      execute: async (input) => toolResult(await setKpiSchema(input)),
    },
    {
      name: 'set_active_program',
      description: 'Select which stored program and optional block should be projected in the interface.',
      inputSchema: {
        type: 'object',
        properties: { program_id: { type: 'string' }, block_id: { type: ['string', 'null'] } },
        required: ['program_id'],
      },
      annotations: { readOnlyHint: false },
      execute: async (input) => toolResult(await setActiveProgram(input)),
    },
    {
      name: 'delete_record',
      description: 'Permanently delete an explicitly selected event or program entity. Entity subtrees require cascade=true.',
      inputSchema: {
        type: 'object',
        properties: {
          record_type: { type: 'string', enum: ['event', 'entity'] },
          id: { type: 'string' },
          cascade: { type: 'boolean' },
        },
        required: ['record_type', 'id'],
      },
      annotations: { readOnlyHint: false, destructiveHint: true },
      execute: async (input) => toolResult(await deleteRecord(input)),
    },
  ];

  try {
    for (const tool of tools) await modelContext.registerTool(tool);
    status.className = 'mcp-status ready';
    status.innerHTML = `<i></i><span>Agent tools available</span>`;
  } catch (error) {
    status.className = 'mcp-status unavailable';
    status.innerHTML = '<i></i><span>WebMCP registration failed</span>';
    console.error(error);
  }
}

function bindUi() {

  document.addEventListener('click', (event) => {
    const button = event.target.closest('button');
    if (!button) return;
    if (button.hasAttribute('data-open-guide')) {
      document.querySelector('.settings').open = false;
      $('agentGuide').showModal();
    }
    if (button.hasAttribute('data-close-dialog')) button.closest('dialog').close();
    if (button.hasAttribute('data-restore')) $('importButton').click();
    if (button.dataset.day) {
      selectedDate = button.dataset.day;
      render();
      document.querySelector(`[data-day="${selectedDate}"]`)?.focus();
    }
    if (button.dataset.weekShift) {
      const context = currentContext();
      const weeks = context.block ? blockMicros(context.block.id).filter((week) => week.status !== 'archived').sort((a, b) => a.startDate.localeCompare(b.startDate)) : [];
      const currentId = weeks.some((week) => week.id === selectedMicroId) ? selectedMicroId : context.microcycle?.id;
      const index = weeks.findIndex((week) => week.id === currentId);
      const next = weeks[index + Number(button.dataset.weekShift)];
      if (index >= 0 && next) {
        selectedMicroId = next.id;
        selectedDate = null;
        render();
        const replacement = document.querySelector(`[data-week-shift="${button.dataset.weekShift}"]`);
        if (replacement && !replacement.disabled) replacement.focus();
        else document.querySelector('[data-day]')?.focus();
      }
    }
    if (button.dataset.logSession) {
      const session = entity(button.dataset.logSession);
      if (!session || session.type !== 'session') return;
      const result = sessionResult(session.id);
      $('logSessionId').value = session.id;
      $('logTitle').textContent = session.title;
      $('logStatus').value = statusForSession(session).label === 'MISSED' ? 'missed' : 'completed';
      $('logMinutes').value = result?.data.actualMinutes ?? session.durationMinutes ?? '';
      $('logNotes').value = result?.note || '';
      $('logError').textContent = '';
      $('sessionDialog').showModal();
    }
  });
  document.addEventListener('click', (event) => {
    const settings = document.querySelector('.settings');
    if (!settings.contains(event.target)) settings.open = false;
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') document.querySelector('.settings').open = false;
  });
  $('logStatus').addEventListener('change', () => {
    if ($('logStatus').value === 'missed') $('logMinutes').value = '0';
  });
  $('sessionForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    if ($('saveSession').disabled) return;
    const session = entity($('logSessionId').value);
    const actualMinutes = Number($('logMinutes').value);
    if (!session || !Number.isInteger(actualMinutes) || actualMinutes < 0 || actualMinutes > 1440) {
      $('logError').textContent = 'Enter a valid session duration.';
      return;
    }
    $('saveSession').disabled = true;
    try {
      await appendObservations({ observations: [{
        domain: 'training', entity_id: session.id, date: session.date,
        data: { status: $('logStatus').value, actualMinutes },
        note: $('logNotes').value.trim(),
      }] });
      $('sessionDialog').close();
      Array.from(document.querySelectorAll('[data-log-session]')).find((button) => button.dataset.logSession === session.id)?.focus();
    } catch (error) {
      $('logError').textContent = error.message || 'Could not save. Please try again.';
    } finally {
      $('saveSession').disabled = false;
    }
  });

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
    await deleteRecord({ record_type: 'event', id: button.dataset.deleteEvent });
  });

  $('exportButton').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify({
      schemaVersion: SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      ...model,
    }, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `workout-planner-ledger-${dateKey(new Date())}.json`;
    link.click();
    URL.revokeObjectURL(link.href);
  });

  $('resetButton').addEventListener('click', () => {
    if (!confirm('Permanently delete the entire local coaching ledger?')) return;
    db.close();
    const request = indexedDB.deleteDatabase(DB_NAME);
    request.onsuccess = () => location.reload();
    request.onerror = () => alert('Could not delete the local ledger.');
  });
}

async function start() {
  db = await openDb();
  await loadModel();
  await migrateAwaySeededDemo();
  if (!model.meta.schemaVersion) await setMeta('schemaVersion', SCHEMA_VERSION);
  if (!model.meta.agentOwnedSchemaVersion) await setMeta('agentOwnedSchemaVersion', 1);
  await loadModel();
  bindUi();
  render();
  registerWebMcp();

  window.WorkoutPlanner = {
    get model() { return clone(model); },
    getCoachingState,
    getHistory,
    applyProgram,
    patchProgram,
    appendObservations,
    appendMeasurements,
    setPrescriptions,
    setKpiSchema,
    setActiveProgram,
    deleteRecord,
  };
}

start().catch((error) => {
  console.error(error);
  $('storageStatus').textContent = 'Storage unavailable';
  $('appError').hidden = false;
  $('appError').textContent = `Could not load your training data: ${error.message}. Check that browser storage is enabled, then reload.`;
});
