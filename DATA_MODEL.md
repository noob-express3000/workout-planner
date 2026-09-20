# Study Ledger data model

Schema version: `1`

Study Ledger uses one IndexedDB object store for records plus a small `meta` store.

The storage schema deliberately keeps the original record type names so existing Security Ledger browser data remains readable. The product semantics are broader than those legacy names.

## Common record fields

Every record contains:

```json
{
  "id": "note-...",
  "type": "note",
  "title": "Worked example: chain rule",
  "domain": "calculus",
  "tags": ["derivatives", "revision"],
  "createdAt": "2026-09-20T12:00:00.000Z",
  "updatedAt": "2026-09-20T12:00:00.000Z"
}
```

`domain` is free-form. It may represent a subject, field, module, course, or narrower topic. Records may also carry additional domain-specific fields without a schema migration.

## capture

Raw material staged before it is structured.

```json
{
  "type": "capture",
  "rawText": "rough narration, pasted notes, or observations",
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

Files remain local. WebMCP responses remove `dataUrl` and expose only metadata plus `storedLocally: true`.

## source

```json
{
  "type": "source",
  "title": "Course notes",
  "url": "https://...",
  "author": "",
  "publisher": "",
  "citation": "",
  "notes": "",
  "accessedAt": "2026-09-20T12:00:00.000Z"
}
```

## note

Structured study memory.

```json
{
  "type": "note",
  "topic": "Chain rule",
  "summary": "short retrieval-oriented summary",
  "abstraction": "high-level explanation",
  "content": "deeper notes",
  "patterns": ["recognition cue or recurring pattern"],
  "commands": ["optional syntax, command, formula, or notation worth retaining"],
  "sourceIds": ["source-..."],
  "challengeIds": ["challenge-..."],
  "relatedIds": ["note-..."]
}
```

The `commands` field is retained for compatibility and technical subjects; nontechnical notes may leave it empty or store notation elsewhere.

## challenge — generic practice item

`challenge` is the legacy storage type for any bounded practice item: a problem, lab, exercise, revision objective, assignment task, experiment, or CTF challenge.

```json
{
  "type": "challenge",
  "title": "Problem set 4, question 3",
  "platform": "Calculus I",
  "category": "derivatives",
  "difficulty": "medium",
  "status": "active",
  "objective": "differentiate the composite function and explain each step",
  "notes": "context worth preserving",
  "flags": [],
  "sourceIds": []
}
```

Fields remain open-ended. For cybersecurity, `platform`, `flags`, and technical metadata can continue to be used exactly as before.

## solve — generic study/practice session

`solve` is the legacy storage type for an evolving or completed study/practice session.

```json
{
  "type": "solve",
  "challengeId": "challenge-...",
  "activityType": "study-session",
  "overview": "what mattered in the session",
  "steps": ["reasoning or action step"],
  "commands": [],
  "payloads": [],
  "failedAttempts": ["what failed or remained unclear"],
  "lessons": ["transferable lesson"],
  "artifacts": [],
  "sourceIds": ["source-..."],
  "completedAt": ""
}
```

Technical fields such as `commands`, `payloads`, and `artifacts` remain available for programming, cybersecurity, engineering, and lab work. Other subjects can simply leave them empty.

## Meta store

Current metadata includes:

```text
schemaVersion
voiceDebrief
voiceEndpoint
voiceSpeak
```

The repo intentionally avoids user accounts and server-side identity state.

## Voice debrief extension

No schema migration is needed.

- `meta.voiceDebrief`: current local session (`id`, `title`, `transcript`, `sourceText`, `questions`, `draft`, `reviewedTranscript`, `saved`).
- Drafts contain a model summary, grounded step/failure/lesson arrays with `{text,evidence}`, suggestions, gaps, and one follow-up question.
- `meta.voiceEndpoint`: optional voice service origin.
- `meta.voiceSpeak`: spoken-question preference.
- Neither API keys nor the service password are stored or exported.
- Saved `capture`: original transcript, question history, generated record IDs, and source links.
- Saved `note`: learner-reviewed model summary and quoted observations.
- Saved `solve`: the generic study-session record, including quoted observations, original transcript, open questions, suggestions, review status, and provenance.

The capture, note, study-session record, new references, and saved session marker are written atomically. Session-derived IDs keep retries idempotent. Export/import includes these records and metadata through the existing backup format.

Source pages are not fetched and source claims are not independently verified.
