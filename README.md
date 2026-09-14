# Workout Planner

A browser-native coaching ledger for an Alexa+/agentic coaching experience.

The website is **not** the coach and it does not generate workout plans by itself. Conversation happens outside the site. The agent authors structured coaching state through WebMCP, and the site persists and renders that state over time.

```text
Conversation
    ↓
Agent
    ↓
WebMCP
    ↓
Coaching state + historical ledger
    ↓
Workout Planner UI
```

## Product thesis

Workout Planner is persistent visual memory for a conversational coach.

A fresh install starts empty. There are no hardcoded routines, lifts, KPIs, deload schedules, protein targets, or training philosophies. The agent decides what is relevant from conversation and writes that structure into the ledger.

The system separates:

- **current coaching state** — what the plan currently looks like
- **historical events** — what happened and how the plan changed

Program edits therefore do not erase the previous state. Before/after values are retained in the ledger.

## Program hierarchy

```text
Program
└── Training Block
    └── Mesocycle
        └── Microcycle
            └── Session
                └── Activities[]
```

Structural constraints:

- training block: maximum six calendar months
- mesocycle: maximum four weeks
- microcycle: maximum one week
- sessions must fall inside their microcycle

The site validates structure only. It does not prescribe what a block, session, or activity should contain.

Activities are intentionally open-ended. An agent may write strength work, running intervals, boxing rounds, mobility, swimming, cycling, testing, or other training data using the same session surface.

## Views

Top-level views:

- Training
- Protein
- Sleep
- KPI

Training can be inspected at:

- Microcycle
- Mesocycle
- Deload
- Training Block
- Ledger

All views are projections of the same stored model.

## Persistence

Long-lived state is stored in IndexedDB.

Object stores:

- `entities` — programs, blocks, mesocycles, microcycles, sessions, prescriptions, KPIs
- `events` — observations, measurements, program changes, and system history
- `meta` — active program/block and schema metadata

The browser requests persistent storage where supported. The complete ledger can also be exported to and restored from JSON.

Historical data remains until the user explicitly deletes it.

See [`DATA_MODEL.md`](./DATA_MODEL.md) for the schema.

## WebMCP control plane

The current site exposes:

```text
get_coaching_state
get_history
apply_program
patch_program
append_observation
append_measurement
set_prescriptions
set_kpi_schema
set_active_program
delete_record
```

### Initial population

The agent can construct an entire program in one call with `apply_program`.

```text
User conversation
      ↓
agent determines goals + constraints
      ↓
apply_program(...)
      ↓
website populates
```

### Ongoing coaching

Later conversation should make smaller changes:

```text
patch_program(...)
append_observation(...)
append_measurement(...)
set_prescriptions(...)
```

Every meaningful program mutation is recorded.

## Meal Planner V2 relationship

Meal Planner V2 remains a separate application and is not modified by this project.

The two applications share the same philosophy: a simple browser-native surface exposes structured state to an external agent. Workout Planner may store a protein prescription while Meal Planner independently handles recipes, meals, and food planning needed to satisfy it.

## Local run

```bash
python -m http.server 8080
```

Open `http://localhost:8080`.

## Render

`render.yaml` provisions a zero-build static site.

## Scope

No account system, cloud database, embedded LLM, agent framework, or Alexa backend is required for the current simulated experience.

The difficult part is the persistent user-specific coaching model and the agent-operable interface around it.
