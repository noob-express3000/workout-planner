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
