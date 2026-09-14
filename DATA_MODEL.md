# Workout Planner data model

Workout Planner is a persistent coaching ledger. The website renders structured coaching state authored by an external agent and retains historical observations and program mutations until explicitly deleted.

## Storage

IndexedDB database: `workout-planner-ledger`.

Object stores:

- `entities` — current structured coaching state
- `events` — historical observations and changes
- `meta` — active context and schema metadata

The model intentionally separates **what the plan is now** from **what happened over time**.

## Entity hierarchy

```text
Program
└── Block
    └── Mesocycle
        └── Microcycle
            └── Session
                └── activities[]
```

Additional entities may attach to a program or block:

```text
Prescription
KPI
```

### Program

```js
{
  id,
  type: "program",
  parentId: null,
  title,
  objective,
  startDate,
  endDate,
  status,
  metadata,
  createdAt,
  updatedAt
}
```

A program is a container for one or more training blocks. The site does not decide the objective.

### Block

```js
{
  id,
  type: "block",
  parentId: programId,
  title,
  objective,
  outcome,
  startDate,
  endDate,
  order,
  metadata,
  status,
  createdAt,
  updatedAt
}
```

A block may last at most six calendar months.

### Mesocycle

```js
{
  id,
  type: "mesocycle",
  parentId: blockId,
  title,
  objective,
  startDate,
  endDate,
  order,
  metadata,
  status,
  createdAt,
  updatedAt
}
```

A mesocycle may last at most four weeks.

### Microcycle

```js
{
  id,
  type: "microcycle",
  parentId: mesocycleId,
  title,
  objective,
  kind,
  startDate,
  endDate,
  order,
  metadata,
  status,
  createdAt,
  updatedAt
}
```

A microcycle may last at most one week.

`kind` is agent-authored. `deload` is recognized by the UI as a useful projection, but it is not a required training philosophy.

### Session

```js
{
  id,
  type: "session",
  parentId: microcycleId,
  date,
  title,
  objective,
  durationMinutes,
  activities: [],
  metadata,
  status,
  createdAt,
  updatedAt
}
```

Sessions must fall within their parent microcycle.

### Activity

Activities intentionally have an open schema.

Strength example:

```js
{
  type: "strength",
  name: "Bench press",
  prescription: {
    sets: 5,
    reps: 5,
    loadKg: 80,
    rir: 2
  }
}
```

Running example:

```js
{
  type: "running",
  name: "Intervals",
  prescription: {
    repetitions: 6,
    distanceMeters: 400,
    targetSeconds: 92
  }
}
```

Boxing example:

```js
{
  type: "boxing",
  name: "Bag rounds",
  prescription: {
    rounds: 8,
    workSeconds: 180,
    restSeconds: 60
  }
}
```

The site stores and renders the activity. It does not decide which activity is correct.

### Prescription

```js
{
  id,
  type: "prescription",
  parentId,
  domain,
  label,
  target,
  unit,
  startDate,
  endDate,
  metadata,
  status,
  createdAt,
  updatedAt
}
```

`domain` is open-ended. Current UI projections understand `protein` and `sleep`, while an agent can also store recovery or other coaching targets.

### KPI

```js
{
  id,
  type: "kpi",
  parentId,
  name,
  unit,
  targetValue,
  direction,
  metadata,
  status,
  createdAt,
  updatedAt
}
```

KPIs are agent-defined. The website contains no predefined benchmark list.

## Event ledger

Events append lived data and historical mutations without replacing earlier records.

```js
{
  id,
  category,
  action,
  domain,
  entityId,
  occurredAt,
  date,
  data,
  tags,
  note
}
```

Current event categories:

```text
observation
measurement
program
system
```

Examples:

```text
observation / training
observation / protein
observation / sleep
observation / pain
observation / readiness
measurement / KPI measurement
program / program_applied
program / entity_updated
program / prescription_updated
program / kpi_updated
system / entity_deleted
```

The `domain` field is deliberately open-ended so future coaching conversations can store useful observations without database migrations for every new concept.

## Mutation rules

### Initial authorship

`apply_program` writes an entire agent-authored hierarchy in one transaction.

The site validates only structural rules:

- parent-child relationships
- date ranges
- block/mesocycle/microcycle duration limits
- session dates
- entity identity

It does **not** validate training philosophy.

### Ongoing changes

`patch_program` updates one or more current entities atomically.

Each mutation emits a program event containing:

```js
{
  before,
  after,
  summary
}
```

This preserves how the plan evolved.

### Observations

`append_observation` records lived data without mutating the plan.

Examples include:

- session completion
- protein intake
- sleep
- soreness
- readiness
- pain
- schedule constraints
- subjective feedback

### Measurements

`append_measurement` writes a numeric measurement against an existing KPI entity.

## Current state vs history

```text
entities[]
    ↓
current coaching state

 events[]
    ↓
what happened + how the plan changed
```

The agent can read both through WebMCP.

Over time this enables questions such as:

```text
What programming coincided with the fastest bench progress?
Which mesocycles had the best adherence?
When did fatigue begin rising?
What sleep patterns preceded poor sessions?
Did the previous deload improve the target KPI?
```

The website itself does not answer those questions autonomously. It preserves enough structured history for the conversational agent to reason about them.

## Deletion

Data is retained unless explicitly deleted.

`delete_record` supports:

- deleting a single event
- deleting an entity
- deleting an entity subtree only when `cascade=true` is explicitly supplied

Deleting an entity subtree also removes events directly attached to those entities.

## Portability

The complete local ledger can be exported as JSON:

```text
schemaVersion
exportedAt
entities[]
events[]
meta{}
```

Import replaces the current local ledger transactionally after validation.

This provides a migration path to later synchronization or account-backed storage without changing the core data model.
