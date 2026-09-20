# Security Ledger

Security Ledger is a local browser application for storing security study material, challenge records, sources, and solve history.

The website stores data locally. The optional AssemblyAI debrief interviews you about a CTF walkthrough and drafts linked notes. An external AI agent can also read and update the ledger through WebMCP.

## Workflow

1. Add raw material to Inbox.
2. Have the agent convert it into structured notes, sources, challenge records, or solve records.
3. Search and reuse those records during later study and practice.

OWASP Top 10 is an initial focus, but the data model supports other security domains.

## Interface

- **Debrief** — AssemblyAI live narration, follow-up questions, evidence-backed draft review, and local saving.
- **Inbox** — raw notes, URLs, screenshots, and files.
- **Notes** — structured technical notes.
- **Challenges** — challenge metadata and solve records.
- **Sources** — references used by notes and solves.

The site is intended to minimize manual data entry. WebMCP is used for most structured population.

## Storage

Data is stored locally in IndexedDB.

Record types:

- `capture`
- `note`
- `source`
- `challenge`
- `solve`

Solve records may contain steps, commands, payloads, failed attempts, lessons, artifacts, sources, challenge links, and completion time.

Attachments are stored locally. WebMCP responses expose attachment metadata without sending the stored file data.

See [`DATA_MODEL.md`](./DATA_MODEL.md) for the schema.

## WebMCP tools

```text
get_security_state
get_inbox
search_knowledge
capture_material
upsert_source
upsert_note
upsert_challenge
record_solve
mark_inbox_processed
link_records
delete_record
```

## Local behavior

- IndexedDB persistence
- JSON export and import
- no account system
- no cloud database
- no API key required for the original ledger or WebMCP tools
- optional debrief calls AssemblyAI through a small server; the permanent key never goes to the browser

## Run locally

```bash
python -m http.server 8080
```

Open `http://localhost:8080`.

## Render

`render.yaml` deploys the repository as a static site with no build step.

## AssemblyAI voice debrief

Requires Node.js 22+, an AssemblyAI API key with streaming and LLM Gateway access, and a private service access password. No runtime packages are required.

1. Copy `.env.example` to `.env` and fill in `ASSEMBLYAI_API_KEY` and `APP_ACCESS_TOKEN`. Use a long random password for the latter. Never commit `.env`.
2. Run `node --env-file=.env server.mjs` and open `http://localhost:8080`.
3. In **Debrief → Connection**, enter your service access password. Leave the URL blank when the server hosts the page. The password exists only in page memory.
4. Record a walkthrough or paste text. **Stop & review** finalizes speech and requests a draft. The agent asks up to three follow-up questions; append or record answers and review again.
5. Inspect the draft and use **Save to ledger**. One IndexedDB transaction saves the original capture, a note, a solve record, references, and session state. Saving does not assert that the challenge was completed.

Audio uses AssemblyAI streaming over a temporary token. Transcripts and supplied URLs go through AssemblyAI LLM Gateway. Spoken questions use browser speech synthesis. The app does not record an audio file, fetch source pages, run commands, or send your whole ledger to a model. Source URLs are references supplied by you. Evidence quotes are checked against the transcript; this checks quote presence, not the correctness of the model's interpretation.

The LLM model is configurable with `ASSEMBLYAI_LLM_MODEL`; the default follows AssemblyAI's current quickstart. Account access and credits must be checked before recording a submission demo. There is no simulated AI fallback in production.

### Hosting the optional service

`render-voice.yaml` is a separate Render Blueprint for the complete Node application. Add your AssemblyAI key in the service environment and obtain the generated `APP_ACCESS_TOKEN` from the service dashboard. It is separate from the existing static deployment; no service is provisioned merely by committing this file. The blueprint requests Render's free plan, subject to account availability and cold starts. AssemblyAI usage is billed by AssemblyAI.

To keep using the existing static site, deploy the voice service, set `ALLOWED_ORIGIN` on that service to your static site's exact origin, then enter the service's HTTPS origin in **Connection**. Do not put the AssemblyAI API key in that field or the password field. The voice server serves only an explicit public asset allowlist, checks the service password and request origin, limits body size/concurrency/request rate, and never logs transcript or provider bodies. This is a private single-user prototype, not a multi-tenant authentication system.

### Verification and remaining gates

Run `npm test` for API contract, credential isolation, input validation, and transcript-grounding checks. See `TESTING.md` for voice and hardware checks. Live AssemblyAI transcription, model access, microphone permissions, Android audio behavior, and the complete spoken loop still require a real key and physical-device validation. This is the first implementation, not a submission-ready release.

API references: [temporary tokens](https://www.assemblyai.com/docs/streaming/api-spec/generate-streaming-token), [streaming WebSocket](https://www.assemblyai.com/docs/streaming/api-spec/streaming-websocket), [LLM Gateway](https://www.assemblyai.com/docs/llm-gateway/quickstart).
