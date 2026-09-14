# Workout Planner data model

Workout Planner is a persistent coaching ledger. The current program is only one projection of the user's history; observations and program changes are retained until the user explicitly deletes them.

## Storage

The browser uses IndexedDB database `workout-planner-ledger`.

Three object stores are used:

- `entities` — current structural program objects.
- `events` — append-only observations and changes.
- `meta` — small global values such as coaching targets and the active training block.

This avoids treating a long-lived coaching history as a single `localStorage` document.

## Program hierarchy

```text
Training Block
└── Mesocycle (maximum 4 weeks by convention)
    └── Microcycle (maximum 1 week)
        └── Session
            └── Prescription[]
```

A deload is not a parallel hierarchy. It is a microcycle whose `kind` is `deload`. Test weeks use `kind: test`.

A training block has one dominant outcome, for example strength, endurance, speed, agility, flexibility, power, or hypertrophy. The block may contain supporting work, but its primary outcome remains explicit.

### `block`

```js
{
  id,
  type: "block",
  parentId: null,
  title,
  outcome,
  goal,
  startDate,
  endDate,
  createdAt,
  updatedAt
}
```

### `mesocycle`

```js
{
  id,
  type: "mesocycle",
  parentId: blockId,
  title,
  focus,
  startDate,
  endDate,
  order,
  createdAt,
  updatedAt
}
```

### `microcycle`

```js
{
  id,
  type: "microcycle",
  parentId: mesocycleId,
  title,
  kind: "training" | "deload" | "test",
  startDate,
  endDate,
  order,
  createdAt,
  updatedAt
}
```

### `session`

```js
{
  id,
  type: "session",
  parentId: microcycleId,
  date,
  title,
  durationMinutes,
  prescriptions: [
    {
      exercise,
      sets,
      reps,
      loadKg,
      rir,
      note
    }
  ],
  createdAt,
  updatedAt
}
```

### `kpi`

```js
{
  id,
  type: "kpi",
  parentId: blockId,
  name,
  unit,
  targetValue,
  lowerBetter,
  createdAt,
  updatedAt
}
```

## Ledger events

Collected observations are appended to `events` instead of replacing earlier observations.

```js
{
  id,
  category: "training" | "protein" | "sleep" | "kpi" | "program" | "system",
  action,
  entityId,
  occurredAt,
  date,
  data
}
```

Examples:

```text
training / session_completed
training / session_missed
protein  / intake
sleep    / sleep
kpi      / measurement
program  / entity_updated
program  / profile_updated
program  / block_created
program  / session_created
system   / legacy_import
```

Program edits append a `program/entity_updated` event containing both the previous and new representation before the current entity is replaced. This means the current program can change without erasing why or how it changed.

## Coaching profile

Small global prescriptions are held in `meta.profile`:

```js
{
  proteinTargetG,
  sleepTargetHours,
  bodyMassKg,
  goals: []
}
```

Profile updates are also written to the program ledger with before/after values.

## Processing model

The UI and WebMCP tools derive projections from the same stored data:

```text
raw entities + ledger events
        ↓
current block / mesocycle / microcycle
        ↓
completion, adherence, duration, recovery, KPI progression
        ↓
coach or agent changes future prescriptions
        ↓
program change appended to ledger
```

Historical observations remain available for later models. A future programming engine can therefore reason over months or years of user-specific response rather than only the latest week.

## Deletion

Ledger records remain stored unless explicitly deleted. Deletion is intentionally destructive and exposed separately through `delete_ledger_entry`.

Deleting a historical observation changes any projections calculated from that observation. Program entities are not automatically deleted when an observation is removed.

## Portability

The UI can export the entire local model as JSON containing:

```text
schemaVersion
exportedAt
entities[]
events[]
meta{}
```

This keeps the local-first ledger portable and gives us a migration path if storage moves beyond IndexedDB later.
