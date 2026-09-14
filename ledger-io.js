const LEDGER_DB_NAME = 'workout-planner-ledger';
const LEDGER_DB_VERSION = 1;

async function requestLedgerPersistence() {
  if (!navigator.storage?.persist) return false;
  try {
    if (await navigator.storage.persisted?.()) return true;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}

function openLedgerDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(LEDGER_DB_NAME, LEDGER_DB_VERSION);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Could not open ledger database.'));
  });
}

function validateLedgerBackup(value) {
  if (!value || typeof value !== 'object') throw new Error('Backup must be a JSON object.');
  if (!Array.isArray(value.entities)) throw new Error('Backup is missing entities[].');
  if (!Array.isArray(value.events)) throw new Error('Backup is missing events[].');
  if (!value.meta || typeof value.meta !== 'object' || Array.isArray(value.meta)) throw new Error('Backup is missing meta{}.');

  const entityIds = new Set();
  for (const item of value.entities) {
    if (!item?.id || !item?.type) throw new Error('Every entity requires id and type.');
    if (entityIds.has(item.id)) throw new Error(`Duplicate entity id: ${item.id}`);
    entityIds.add(item.id);
  }

  const eventIds = new Set();
  for (const event of value.events) {
    if (!event?.id || !event?.category || !event?.action || !event?.occurredAt) {
      throw new Error('Every ledger event requires id, category, action, and occurredAt.');
    }
    if (eventIds.has(event.id)) throw new Error(`Duplicate event id: ${event.id}`);
    eventIds.add(event.id);
  }

  return {
    entities: value.entities,
    events: value.events,
    meta: value.meta,
  };
}

function replaceLedger(db, backup) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['entities', 'events', 'meta'], 'readwrite');
    const entities = tx.objectStore('entities');
    const events = tx.objectStore('events');
    const meta = tx.objectStore('meta');

    entities.clear();
    events.clear();
    meta.clear();

    for (const row of backup.entities) entities.put(row);
    for (const row of backup.events) events.put(row);
    for (const [key, value] of Object.entries(backup.meta)) meta.put({ key, value });

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error('Could not restore ledger.'));
    tx.onabort = () => reject(tx.error || new Error('Ledger restore was aborted.'));
  });
}

async function importLedgerBackup(file) {
  const parsed = JSON.parse(await file.text());
  const backup = validateLedgerBackup(parsed);
  const db = await openLedgerDb();
  try {
    await replaceLedger(db, backup);
  } finally {
    db.close();
  }
}

async function updateDurabilityStatus() {
  const status = document.getElementById('storageStatus');
  if (!status) return;
  const persistent = await requestLedgerPersistence();
  status.dataset.persistence = persistent ? 'persistent' : 'best-effort';
}

function bindLedgerImport() {
  const button = document.getElementById('importButton');
  const input = document.getElementById('importInput');
  if (!button || !input) return;

  button.addEventListener('click', () => input.click());
  input.addEventListener('change', async () => {
    const file = input.files?.[0];
    if (!file) return;
    try {
      if (!confirm('Replace the current local ledger with this backup?')) return;
      await importLedgerBackup(file);
      location.reload();
    } catch (error) {
      alert(`Import failed: ${error.message}`);
    } finally {
      input.value = '';
    }
  });
}

bindLedgerImport();
updateDurabilityStatus();
