# Security Ledger data model

Schema version: `1`

Security Ledger uses one IndexedDB object store for records plus a small `meta` store.

## Common record fields

Every record contains:

```json
{
  "id": "note-...",
  "type": "note",
  "title": "SQL injection context boundaries",
  "domain": "web",
  "tags": ["sqli", "owasp"],
  "createdAt": "2026-09-15T17:00:00.000Z",
  "updatedAt": "2026-09-15T17:00:00.000Z"
}
```

`domain` is intentionally free-form. The schema does not encode a fixed security taxonomy.

## capture

Raw material staged before the agent structures it.

```json
{
  "type": "capture",
  "rawText": "rough narration or pasted material",
  "url": "https://example.com/reference",
  "status": "unprocessed",
  "generatedRecordIds": [],
  "attachments": [
    {
      "id": "attachment-...",
      "name": "screen.png",
      "type": "image/png",
      "size": 123456,
      "dataUrl": "data:image/png;base64,..."
    }
  ]
}
```

Files are stored locally. WebMCP responses remove `dataUrl` and expose only metadata plus `storedLocally: true`.

## source

```json
{
  "type": "source",
  "title": "OWASP Testing Guide",
  "url": "https://...",
  "author": "",
  "publisher": "OWASP",
  "citation": "",
  "notes": "",
  "accessedAt": "2026-09-15T17:00:00.000Z"
}
```

## note

Structured technical memory.

```json
{
  "type": "note",
  "topic": "SQL injection",
  "summary": "short retrieval-oriented summary",
  "abstraction": "high-level explanation",
  "content": "deeper technical notes",
  "patterns": ["observable pattern"],
  "commands": ["syntax or command worth retaining"],
  "sourceIds": ["source-..."],
  "challengeIds": ["challenge-..."],
  "relatedIds": ["note-..."]
}
```

## challenge

```json
{
  "type": "challenge",
  "platform": "HTB",
  "url": "https://...",
  "category": "web",
  "difficulty": "medium",
  "status": "active",
  "objective": "what the lab asks the learner to accomplish",
  "notes": "context worth preserving",
  "flags": [],
  "sourceIds": []
}
```

## solve

A complete or evolving solution record.

```json
{
  "type": "solve",
  "challengeId": "challenge-...",
  "overview": "what mattered in the solve",
  "steps": ["step 1", "step 2"],
  "commands": ["command"],
  "payloads": ["payload"],
  "failedAttempts": ["what failed and why"],
  "lessons": ["transferable lesson"],
  "artifacts": ["file/hash/request/response metadata"],
  "sourceIds": ["source-..."],
  "completedAt": "2026-09-15T17:00:00.000Z"
}
```

## Meta store

Current metadata:

```text
schemaVersion
```

The repo intentionally avoids user accounts and server-side identity state.

## Voice debrief extension

No schema migration is needed: the existing record store accepts additional fields.

- `meta.voiceDebrief`: current local session (`id`, `title`, `transcript`, `sourceText`, `questions`, `draft`, `reviewedTranscript`, `saved`). Drafts contain a model summary, grounded step/failure/lesson arrays with `{text,evidence}`, suggestions, gaps, and a follow-up question.
- `meta.voiceEndpoint`: optional voice service origin; `meta.voiceSpeak`: spoken-question preference. Neither API keys nor the service password are stored or exported.
- Saved `capture`: original transcript, question history, generated record IDs, and source links.
- Saved `note`: user-reviewed model summary and quoted observations, with `provenance.captureId` and provider.
- Saved `solve`: quoted observations, `originalTranscript`, `openQuestions`, `agentSuggestions`, `reviewStatus`, provenance, and source links. `completedAt` remains empty; the debrief does not certify completion.

The capture, note, solve, new references, and saved session marker are written atomically. Session-derived IDs make retries idempotent. Export/import includes these records and metadata through the existing backup format. Source pages are not fetched and source quotes are not independently verified.
