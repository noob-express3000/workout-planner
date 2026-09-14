# Workout Planner

A browser-first training state system built for the Amazon Developer Hackathon Alexa+ simulated-experience route.

The application is intentionally not a general fitness coach. It gives an agent a persistent, machine-operable model of a user's training state and a deterministic programming engine for targeted lifts or muscle groups.

## Product model

The web app is the state surface. Conversation is expected to happen in an external agent such as a simulated Alexa+ experience or a WebMCP-aware browser agent.

```text
Human voice / conversation
          ↓
       Agent
          ↓
       WebMCP
          ↓
Workout Planner
├── persistent local training state
├── deterministic assessment engine
├── program generator
└── decision history
```

No backend, account system, database, payment layer, or cloud state is required for the MVP.

## Tracked training data

The current model supports:

- strength, hypertrophy, or power goal
- active lift or muscle target
- equipment
- weekly training days
- session duration
- target frequency
- direct weekly sets
- indirect weekly sets
- top-set load and reps
- estimated one-rep max for lift targets
- RIR
- adherence
- readiness
- soreness
- sleep
- completed workouts
- performance history
- recovery history
- program decisions and rationale

Targets currently include bench press, squat, deadlift, overhead press, chest, back, shoulders, biceps, triceps, quads, hamstrings, glutes, and calves.

## Finite training states

The deterministic engine classifies each target as one of:

- `UNDERTRAINED`
- `ADEQUATE`
- `PROGRESSING`
- `STALLED`
- `RECOVERY_LIMITED`

The classification uses multiple signals rather than a single volume threshold: effective exposure, target frequency, estimated-strength trend, adherence, effort, readiness, soreness, and sleep.

The states are programming states for the hackathon prototype, not medical diagnoses.

## WebMCP tools

The app registers 11 tools when `document.modelContext.registerTool` is available:

- `get_training_state`
- `set_active_target`
- `update_training_profile`
- `assess_target`
- `create_program`
- `get_program`
- `log_set`
- `complete_workout`
- `record_recovery`
- `get_progress`
- `adjust_program`

The visible UI and the WebMCP tools operate on the exact same local state and programming functions.

## Default demo

The default target is bench press:

```text
80 kg × 5
5 direct weekly sets
1 bench exposure / week
95% adherence
1 RIR
normal recovery
```

Initial assessment:

```text
UNDERTRAINED
```

The engine responds by distributing the target across two weekly exposures rather than simply making one session harder.

Use **Log successful demo workout** to simulate a successful session with improved performance. The recorded performance raises estimated 1RM and the target transitions to:

```text
PROGRESSING
```

The next program is rebuilt from the changed persistent state.

## Local persistence

All state lives in browser `localStorage` under:

```text
workout-planner.v2
```

Refreshing the page therefore preserves training history, programs, recovery data, and decisions without a backend.

## Run locally

No build step is required.

```bash
python -m http.server 8080
```

Open `http://localhost:8080`.

## Render

`render.yaml` defines a zero-build Render Static Site that publishes the repository root.

## Scope intentionally excluded

- full autonomous fitness coaching
- authentication
- payments
- social features
- wearables
- pose estimation
- server-side persistence
- a custom speech recognition stack
- AWS infrastructure for the initial simulated Alexa+ route

## Design principle

The agent handles language. The site handles state. The engine handles programming.

Maximum capability. Minimum ceremony.
