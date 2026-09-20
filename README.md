# Study Ledger

Study Ledger is a local-first universal study workspace. It stores raw captures, structured notes, sources, practice items, and study-session history in the browser.

The optional AssemblyAI debrief lets a learner explain what they are studying by voice or text, receive focused follow-up questions, and review an evidence-backed draft before saving. An external AI agent can also read and update the ledger through WebMCP.

Cybersecurity remains a first-class use case, including OWASP study, labs, and CTF walkthroughs, but the workflow is intentionally subject-agnostic.

## Core workflow

1. Capture material in **Inbox**: narration, lecture notes, documentation, screenshots, URLs, worked problems, lab observations, or rough thoughts.
2. Use the agent or the built-in **Debrief** to turn that material into structured notes, sources, practice items, and study-session records.
3. Search and reuse the stored material during later study, revision, practice, or problem-solving.
4. Preserve the original evidence and source links so generated summaries remain reviewable.

The site is a persistent control surface and structured memory layer. It is not intended to replace the learner's reasoning.

## Interface

- **Debrief** — AssemblyAI live narration, focused follow-up questions, evidence-backed draft review, and local saving.
- **Inbox** — raw notes, URLs, screenshots, files, and narrated material.
- **Notes** — structured study memory.
- **Practice** — problems, labs, exercises, assignments, revision objectives, CTF challenges, and the sessions linked to them.
- **Sources** — references used by notes and sessions.

## Storage and compatibility

Data is stored locally in IndexedDB. Existing Security Ledger data remains compatible.

Record types are intentionally unchanged:

- `capture`
- `note`
- `source`
- `challenge` — legacy storage name for a generic practice item
- `solve` — legacy storage name for a generic study/practice session

Keeping these types avoids a migration that could orphan existing browser data. New records may include open-ended fields such as subject, course, activity type, formulas, commands, artifacts, or domain-specific metadata.

Attachments are stored locally. WebMCP responses expose attachment metadata without sending stored file data.

See [`DATA_MODEL.md`](./DATA_MODEL.md) for the schema.

## WebMCP tools

Generic study-facing tools:

```text
get_study_state
get_inbox
search_knowledge
capture_material
upsert_source
upsert_note
upsert_practice
record_study_session
mark_inbox_processed
link_records
delete_record
```

Backward-compatible tools remain registered:

```text
get_security_state
upsert_challenge
record_solve
```

The generic aliases store data using the existing `challenge` and `solve` record types.

## Local behavior

- IndexedDB persistence
- JSON export and import
- no account system
- no cloud database
- no API key required for the original ledger or WebMCP tools
- optional AssemblyAI debrief through a small server; the permanent API key never goes to the browser
- original captures and source links preserved alongside generated drafts
- review-before-save for debrief output

## Run locally

For the static ledger:

```bash
python -m http.server 8080
```

Open `http://localhost:8080`.

For the AssemblyAI debrief, use Node.js 22+:

1. Copy `.env.example` to `.env`.
2. Set `ASSEMBLYAI_API_KEY` and a long random `APP_ACCESS_TOKEN`.
3. Run `node --env-file=.env server.mjs`.
4. Open `http://localhost:8080`.
5. In **Debrief → Connection**, enter the service access password. Leave the service URL blank when the Node server hosts the page.

Audio uses AssemblyAI streaming with a temporary token. The transcript and supplied source URLs are sent to AssemblyAI LLM Gateway for debriefing. Spoken follow-up questions use browser speech synthesis. The app does not record an audio file, fetch source pages, execute commands, or send the whole ledger to the model.

Evidence quotes in generated drafts are checked against the learner's transcript. That verifies quote presence, not whether the model interpreted the quote correctly.

## Render

- `render.yaml` deploys the original static ledger with no build step.
- `render-voice.yaml` is the optional Node deployment for the AssemblyAI debrief.

The voice service keeps the permanent AssemblyAI key server-side, checks a private service password and allowed origin, limits request sizes/rates, and serves only an explicit public asset allowlist.

## Verification

Run:

```bash
npm test
```

The automated tests mock provider responses. Live AssemblyAI streaming, LLM model access, microphone permissions, Android audio behavior, and the full spoken loop still require real credentials and physical-device validation.

See [`TESTING.md`](./TESTING.md) for the complete checklist.
