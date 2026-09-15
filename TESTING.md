# Security Ledger test checklist

## Browser storage

1. Open the site.
2. Stage a capture with text, a URL, tags, and a small image.
3. Reload the page.
4. Confirm the capture and attachment remain.
5. Export a backup.
6. Delete all data.
7. Restore the backup and confirm the ledger returns.

## Narration

In a Chromium browser with Speech Recognition support:

1. Open Inbox.
2. Select **Narrate**.
3. Speak a short technical note.
4. Stop narration.
5. Confirm the transcript remains editable before staging.

If the browser does not expose Speech Recognition, the Narrate button should be hidden.

## Search

Populate several notes/challenges across different domains and tags.

Confirm the top search box filters the current view by:

- title
- content
- domain
- tags
- challenge metadata
- solve content

## Record rendering

Verify:

- notes show abstraction, technical notes, patterns, commands, and sources
- challenges show platform/category/difficulty/status/objective
- solves show steps, commands, payloads, failures, lessons, artifacts, and sources
- sources open external URLs in a new tab
- image attachments render in capture details

## WebMCP

In a WebMCP-enabled agent browser, confirm registration of:

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

Suggested smoke sequence:

1. `capture_material` with a short raw note.
2. `get_inbox` and recover the capture ID.
3. `upsert_source` for the source material.
4. `upsert_note` with the source ID.
5. `mark_inbox_processed` with the generated note/source IDs.
6. `search_knowledge` for a phrase in the new note.
7. Reload the page and confirm all records persist.

## Security / scope behavior

The application itself must not claim to automatically solve a live challenge. WebMCP tool descriptions should preserve the intended tutoring boundary: retrieve concepts and prior work at high abstraction, while keeping the user responsible for the solve.
