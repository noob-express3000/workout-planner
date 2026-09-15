# Security Ledger

Security Ledger is a local browser application for storing security study material, challenge records, sources, and solve history.

The website stores data. An external AI agent can read and update that data through WebMCP.

## Workflow

1. Add raw material to Inbox.
2. Have the agent convert it into structured notes, sources, challenge records, or solve records.
3. Search and reuse those records during later study and practice.

OWASP Top 10 is an initial focus, but the data model supports other security domains.

## Interface

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
- no embedded model
- no API key required by the site

## Run locally

```bash
python -m http.server 8080
```

Open `http://localhost:8080`.

## Render

`render.yaml` deploys the repository as a static site with no build step.
