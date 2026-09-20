# Security Ledger test checklist

## AssemblyAI debrief

Automated checks: `npm test`. Provider responses in tests are mocked; passing tests are not evidence of live AssemblyAI operation.

Before submission, use a configured Node voice service and test on Samsung and Itel:

1. Enter the service password in Debrief → Connection. Check the connection, then review a typed lab walkthrough. Wrong passwords and missing configuration should show a useful error while preserving the transcript.
2. Allow the microphone on HTTPS. Narrate an objective, action and observed result. Confirm live text, then select Stop & review. The microphone must stop before the follow-up is spoken.
3. Answer with a second recording. Earlier narration must remain, partial turn revisions must not duplicate text, and the agent must consider the follow-up history.
4. Deny microphone permission, disconnect during recording, and try an expired/invalid key. Ensure the app returns to usable controls and retains partial text.
5. Review quotes and suggestions. Editing the transcript must disable saving the old draft until it has been reviewed again. Missing details must remain open questions, not invented steps.
6. Add source URLs; save. Confirm a capture, note, solve record and references; repeat save should not duplicate records. Sources must remain linked and agent suggestions visibly unverified.
7. Reload mid-draft; confirm recovery. Export/import the ledger and confirm both saved records and the in-progress debrief survive. The service password must be absent from the backup and blank after reload.
8. Confirm all original tabs and WebMCP tools still work. On narrow mobile viewports, controls must remain reachable without page-level horizontal scrolling.

Live API and microphone checks require credentials and are outstanding. The cloud test browser could not reach the local development server in this environment; full visual/browser interaction verification remains outstanding.

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
