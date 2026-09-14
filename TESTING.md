# Workout Planner testing

The product is ready when conversation can author, update, and read the same persistent coaching state shown in the UI.

## 1. Fresh-state check

Open the deployed site in a fresh browser profile or clear the local ledger.

Expected:

- Training, Protein, Sleep, and KPI are empty.
- No seeded program exists.
- The site remains usable when WebMCP is unavailable in a normal browser.
- Export, Import, and Clear do not throw errors.

## 2. Agent discovery

Open the site through the WebMCP-capable agent environment.

Expected WebMCP tools:

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

The agent should read the site state before writing when useful.

## 3. Initial coaching conversation

Use a natural request rather than telling the agent which tools to call.

Example:

> I want to get stronger over the next 12 weeks. My bench is the main priority. I can lift Monday, Wednesday and Saturday, and I box on Tuesday and Thursday. Keep some conditioning. My current bench is about 100 kg. I usually sleep around 7 hours. Build me something sensible and track the important performance measures.

Pass criteria:

- The agent asks for genuinely missing information only when needed.
- `apply_program` creates a program hierarchy rather than the website inventing one.
- The visible site populates after the write.
- Week shows the current microcycle and sessions.
- Mesocycle shows all weeks in the current mesocycle.
- Block shows the complete block structure.
- Deload shows deload microcycles if the agent authored them.
- Protein/Sleep show prescriptions only if the agent chose to set them.
- KPI contains agent-defined measurements rather than hardcoded lifts.
- History contains the program write.

## 4. Lived-data update

Tell the agent something that happened.

Example:

> I finished today's session, but the final bench set was only four reps and my right shoulder felt slightly irritated. I slept 5.5 hours last night.

Pass criteria:

- Training completion is appended as an observation.
- Sleep is appended as an observation.
- The shoulder note remains in history.
- Old data is not overwritten.
- The agent may patch future programming if it judges that appropriate.
- Any patch creates a before/after program event.

## 5. KPI update

Example:

> I tested my bench today: 105 kg.

Pass criteria:

- The agent resolves the relevant KPI.
- A measurement event is appended.
- KPI view shows start/current/change/target where available.

## 6. Memory test

Example:

> What has changed since we started, and what are you changing next week because of it?

Pass criteria:

- The answer is grounded in `get_coaching_state` and/or `get_history`.
- The agent can reference earlier sessions, observations, measurements, and program changes.
- No historical record is silently replaced.

## 7. Persistence check

Refresh the site and reopen the agent conversation against it.

Expected:

- The program remains.
- Observations and measurements remain.
- Current projections still derive from the stored ledger.

Export the ledger, clear it, import the backup, and confirm the state returns.

## Recording path

A concise demo can be recorded as:

1. Empty site.
2. Natural coaching request.
3. Agent populates Workout Planner.
4. Show Week / Mesocycle / Block / KPI.
5. Report one completed or problematic session conversationally.
6. Show History and a changed future plan.
7. Ask what changed and why.

The core story is:

> Alexa handles the conversation. Workout Planner gives that coaching relationship persistent, inspectable memory.
