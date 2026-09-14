# Workout Planner

A browser-native coaching ledger for the Amazon Developer Hackathon Alexa+ simulated-experience route.

The web app is not the conversational agent. It is the persistent training surface the agent operates.

```text
Human conversation
      ↓
Agent / simulated Alexa+
      ↓
WebMCP
      ↓
Workout Planner
      ↓
Persistent coaching ledger
```

## Core model

```text
Training Block
└── Mesocycle
    └── Microcycle
        └── Session
            └── Prescription
```

Conventions used by the current prototype:

- one dominant outcome per training block
- training block: up to roughly 6 months
- mesocycle: up to 4 weeks
- microcycle: up to 1 week
- deloads are special microcycles
- test weeks are special microcycles

The current demo seeds a 12-week maximum-strength block with three four-week mesocycles, scheduled deloads, a test week, and daily prescriptions.

## Domain views

The interface follows the coaching-notebook sketch rather than a dashboard layout.

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

The same stored data powers every view.

## Persistence

Long-lived state is stored in IndexedDB rather than a single `localStorage` document.

The database contains:

- `entities` — blocks, mesocycles, microcycles, sessions, KPIs
- `events` — append-only training, protein, sleep, KPI, program, and system history
- `meta` — coaching profile and active-program metadata

Program edits preserve previous and new values in the ledger. Observations remain stored until explicitly deleted.

See [`DATA_MODEL.md`](./DATA_MODEL.md) for the schema.

The interface can export the complete local model as JSON.

## WebMCP tools

The current site registers:

```text
get_program_view
get_training_ledger
get_coaching_profile
update_coaching_profile
create_training_block
add_training_session
update_program_entity
log_training_session
log_protein
log_sleep
log_kpi
delete_ledger_entry
```

This lets an agent populate and operate the same ledger that the human sees.

## Meal Planner V2 relationship

Workout Planner does not modify or embed Meal Planner V2.

The two applications follow the same browser-native philosophy and can be used by the same external agent. Workout Planner stores the coaching prescription, such as a protein target. Meal Planner can independently handle the food and recipe workflow needed to satisfy it.

## Local run

```bash
python -m http.server 8080
```

Open `http://localhost:8080`.

## Render

The repository includes `render.yaml` for a zero-build static deployment.

## Scope

No account system, cloud database, payment system, social layer, wearable dependency, or embedded LLM is required for the current prototype.

The difficult part of the product is the growing coaching model and the agent-operable interface around it.
