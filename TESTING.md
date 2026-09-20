# Study Ledger test checklist

## Automated checks

Run `npm test`.

Provider responses are mocked. Passing tests do not prove live AssemblyAI access.

## AssemblyAI debrief

Before submission, use a configured Node voice service and test on Samsung and Itel:

1. Enter the service password in Debrief → Connection. Review a typed study session. Wrong passwords and missing configuration should show a useful error while preserving the transcript.
2. Allow the microphone on HTTPS. Narrate a goal, concept, reasoning step, action, or observed result. Confirm live text, then select Stop & review. The microphone must stop before the follow-up is spoken.
3. Answer with a second recording. Earlier narration must remain, partial turn revisions must not duplicate text, and the agent must consider follow-up history.
4. Deny microphone permission, disconnect during recording, and try an expired/invalid key. The app must return to usable controls and retain partial text.
5. Editing the transcript must disable saving the old draft until it has been reviewed again. Missing details must remain open questions rather than invented steps.
6. Add source URLs and save. Confirm a capture, note, session, and references are created atomically. Repeating save must not duplicate records.
7. Reload mid-draft; confirm recovery. Export/import and confirm saved records plus the in-progress debrief survive. The service password must not appear in the backup.
8. On narrow mobile viewports, controls must remain reachable without page-level horizontal scrolling.

## Browser storage

1. Open the site.
2. Stage a capture with text, a URL, tags, and a small image.
3. Reload the page.
4. Confirm the capture and attachment remain.
5. Export a backup.
6. Delete all data.
7. Restore the backup and confirm the ledger returns.

## Search

Populate notes, practice items, sessions, and sources across different subjects and tags.

Confirm search filters the current view by:

- title
- content
- domain
- tags
- practice metadata
- session content
- source metadata

## Record rendering

Verify:

- notes show abstraction, detailed notes, patterns, optional commands/syntax, and sources
- practice items show context, category, difficulty, status, objective, notes, and markers
- sessions show steps, methods/formulas, failed attempts, lessons, sources, and optional technical fields
- sources open external URLs in a new tab
- image attachments render in capture details

## WebMCP

In a WebMCP-enabled agent browser, confirm registration of:

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

Suggested smoke sequence:

1. `capture_material` with a short raw note.
2. `get_inbox` and recover the capture ID.
3. `upsert_source` for source material.
4. `upsert_note` with the source ID.
5. `upsert_practice` for a bounded exercise.
6. `record_study_session` linked to that practice item.
7. `mark_inbox_processed` with generated record IDs.
8. `search_knowledge` for a phrase from the new note/session.
9. Reload and confirm all records persist.

## Universal-study smoke cases

Use the same ledger and confirm these flows coexist:

1. A nontechnical topic, such as summarizing a history reading with linked sources.
2. A quantitative problem, such as narrating the reasoning for a calculus exercise and saving the session.
3. A cybersecurity lab or CTF walkthrough using commands, artifacts, and source links.

## Scope behavior

The application should support study without taking over the learner's reasoning. For assignments, labs, CTFs, or problem-solving, generated suggestions must remain reviewable and the learner remains responsible for the work.
