# Study Ledger data model

Schema version: `2`

Study Ledger uses one IndexedDB object store for records plus a small `meta` store. The IndexedDB database name is `study-ledger`.

## Common fields

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

`domain` is free-form. It can represent a subject, field, module, course, or narrower topic.

## capture

Raw material staged before it is structured.

```json
{
  "type": "capture",
  "rawText": "rough narration, pasted notes, or observations",
  "url": "https://example.com/reference",
  "status": "unprocessed",
  "generatedRecordIds": [],
  "attachments": []
}
```

Attachments remain local. WebMCP responses remove stored file data and expose metadata only.

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
  "commands": ["optional syntax, command, formula, or notation"],
  "sourceIds": ["source-..."],
  "practiceIds": ["practice-..."],
  "relatedIds": ["note-..."]
}
```

The `commands` field remains useful for technical subjects. Other subjects can leave it empty.

## practice

A bounded task or objective the learner can work on.

```json
{
  "type": "practice",
  "title": "Problem set 4, question 3",
  "context": "Calculus I",
  "category": "derivatives",
  "difficulty": "medium",
  "status": "active",
  "objective": "differentiate the composite function and explain each step",
  "notes": "context worth preserving",
  "markers": [],
  "sourceIds": []
}
```

Examples include exercises, revision objectives, labs, assignment tasks, experiments, programming tasks, and CTF challenges.

## session

An evolving or completed study/practice session.

```json
{
  "type": "session",
  "practiceId": "practice-...",
  "activityType": "study-session",
  "overview": "what mattered in the session",
  "steps": ["reasoning or action step"],
  "methods": ["formula, method, or technique"],
  "commands": [],
  "payloads": [],
  "failedAttempts": ["what failed or remained unclear"],
  "lessons": ["transferable lesson"],
  "artifacts": [],
  "sourceIds": ["source-..."],
  "completedAt": ""
}
```

Technical fields such as `commands`, `payloads`, and `artifacts` are optional and remain available for programming, cybersecurity, engineering, and lab work.

## Meta store

Current metadata includes:

```text
schemaVersion
voiceDebrief
voiceEndpoint
voiceSpeak
```

The repo intentionally avoids user accounts and server-side identity state.

## Voice debrief

- `meta.voiceDebrief` stores the current local debrief session.
- Drafts contain a model summary, grounded step/failure/lesson arrays with `{text,evidence}`, suggestions, gaps, and one follow-up question.
- `meta.voiceEndpoint` stores the optional voice-service origin.
- `meta.voiceSpeak` stores the spoken-question preference.
- API keys and the service password are not stored or exported.
- Saving writes a `capture`, `note`, `session`, linked `source` records, and the saved session marker atomically.
- Session-derived IDs make retries idempotent.
- Source pages are not fetched and source claims are not independently verified.
