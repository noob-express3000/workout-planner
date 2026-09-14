# Workout Planner

A minimal simulated Alexa+ experience for targeted workout planning.

The product is intentionally narrow: the user identifies a muscle group they believe is lagging, supplies training constraints, and the browser applies deterministic rules to recommend and adapt targeted work.

## MVP flow

1. User selects a lagging muscle group.
2. User supplies equipment, training days, session duration, current direct/indirect weekly sets, RIR, and soreness.
3. The local assessment engine classifies the muscle as:
   - `UNDERTRAINED`
   - `ADEQUATE`
   - `PROGRESSING`
   - `STALLED`
   - `RECOVERY_LIMITED`
4. A targeted routine is generated from the assessment and available equipment.
5. The user completes the workout.
6. Completion is persisted in `localStorage`.
7. The muscle is reassessed and the next recommendation is regenerated from the new state.

The default demo starts with chest exposure below the engine threshold. Completing the generated session raises observed weekly exposure, causing a visible state transition and a new recommendation.

## Architecture

```text
Browser
├── Minimal conversation UI
├── Deterministic workout engine
├── localStorage persistence
└── WebMCP tools
    ├── assess_muscle_group
    ├── create_routine
    ├── get_routine
    ├── log_set
    ├── complete_workout
    ├── update_constraints
    ├── get_progress
    └── adjust_volume
```

There is no backend, account system, database, payment layer, or cloud state.

The UI and WebMCP tools call the same JavaScript functions. This keeps the visible simulation and agent-facing behavior synchronized.

## WebMCP

When the browser exposes `document.modelContext.registerTool`, the app registers eight browser-native tools. The app feature-detects the API and continues to work normally when WebMCP is unavailable.

The WebMCP status pill in the header makes tool availability visible during a demo.

## Deterministic assessment model

This is a hackathon programming model, not a clinical or medical model.

Effective weekly exposure is currently calculated as:

```text
direct sets + (indirect sets × 0.5) + completed targeted sets in the last 7 days
```

Current MVP transitions:

- `RECOVERY_LIMITED`: soreness >= 7 or recent completion rate < 65%
- `UNDERTRAINED`: effective weekly exposure < 8 sets
- `STALLED`: sufficient exposure, at least two recent workouts, and performance improvement <= 1%
- `PROGRESSING`: at least two recent workouts, performance improvement > 1%, and completion >= 80%
- `ADEQUATE`: otherwise

Routine volume then changes deterministically from that state. The thresholds are deliberately centralized and easy to replace after testing.

## Local run

No build step is required.

Serve the repository over HTTP/HTTPS rather than opening `index.html` directly if you want browser APIs to behave consistently.

For example:

```bash
python -m http.server 8080
```

Then open `http://localhost:8080`.

## Render

`render.yaml` defines a zero-build Render Static Site that publishes the repository root.

## Scope intentionally excluded

- full fitness coaching
- authentication
- payments
- social features
- wearables
- pose estimation
- server-side persistence
- AWS infrastructure for the initial simulated Alexa+ submission

## Demo script

1. Open the app with the default values.
2. Point out the WebMCP tool status.
3. Click **Analyze and build routine**.
4. Show `UNDERTRAINED` and the generated routine.
5. Click **Complete this workout**.
6. Show the persisted workout count, changed effective exposure, new muscle state, and adapted next routine.
7. Refresh the page and show that the state survives locally.

Maximum capability. Minimum ceremony.
