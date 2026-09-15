# Security Ledger

A local-first security study ledger designed to sit behind an external AI tutor.

The website is deliberately **not** the tutor and it does not try to solve CTFs. It is the staging surface and persistent technical memory the tutor can read and populate through WebMCP.

```text
raw narration / notes / URLs / screenshots / files
                      ↓
                    Inbox
                      ↓
                 AI / agent
                      ↓ WebMCP
      notes · sources · challenges · solves
                      ↓
              persistent local ledger
```

## Product loop

The primary workflow is:

```text
study source → simplify + store → practice challenge → record solve
```

During practice, the AI should retrieve prior concepts, patterns, and the user's own history at a **high level of abstraction**. The product is not designed around handing the user exact next exploit steps.

OWASP Top 10 is an initial study domain, not a schema limit. Records can cover web security, Active Directory, privilege escalation, reversing, cryptography, forensics, networking, cloud, mobile, or any future domain.

## Interface

The site has four surfaces:

- **Inbox** — staging queue for rough input. Paste text, narrate with browser speech recognition, add a URL, and attach local screenshots/files.
- **Knowledge** — structured technical notes created by the agent.
- **Challenges** — challenge metadata plus full solve records.
- **Sources** — retained evidence trail for external material.

The user should rarely need to manually fill structured forms. The agent is expected to populate the ledger.

## Data model

All long-lived data is stored in IndexedDB in the browser. There is no account system or cloud database.

Record types:

- `capture`
- `note`
- `source`
- `challenge`
- `solve`

Solve records can retain:

- steps
- commands
- payloads
- failed attempts
- lessons
- artifacts
- sources
- challenge links
- completion time

Inbox captures can retain raw text, a source URL, tags, domain, screenshots, and small files. Attachments are stored locally as data URLs and are omitted from WebMCP responses to avoid flooding agent context; attachment metadata remains visible to the agent.

See [`DATA_MODEL.md`](./DATA_MODEL.md) for field details.

## WebMCP control plane

The page exposes eleven tools when `document.modelContext` / `navigator.modelContext` is available:

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

### Typical processing pass

```text
get_inbox
  ↓
upsert_source
  ↓
upsert_note / upsert_challenge / record_solve
  ↓
mark_inbox_processed
```

### Retrieval during study or practice

```text
search_knowledge(query, types, domains)
```

The WebMCP descriptions explicitly frame retrieval as conceptual/high-level support rather than an automated challenge solver.

## Local-first behavior

- IndexedDB persistence
- browser persistent-storage request where supported
- JSON export / restore
- no account
- no backend
- no API key
- no embedded model
- attachments stay in the browser unless the user exports the ledger

## Local run

```bash
python -m http.server 8080
```

Open `http://localhost:8080`.

## Render

`render.yaml` provisions the repository as a zero-build static site.
