---
status: investigating
trigger: "Transcript search in chat fails with 'column fc.id does not exist' error"
created: 2026-02-13T00:00:00Z
updated: 2026-02-13T00:00:00Z
---

## Current Focus

hypothesis: A SQL query uses alias `fc` referencing a column `id` that doesn't exist in the aliased table/view
test: Search codebase for SQL queries using `fc.id` alias in transcript search context
expecting: Find the exact query with the bad column reference
next_action: Search for `fc.id` and `fc` alias usage in SQL queries

## Symptoms

expected: When a user searches transcripts via chat (e.g., searching for "lobster"), it should return matching transcript results.
actual: Search fails with error: {"error": "Search failed", "details": "column fc.id does not exist"}
errors: "column fc.id does not exist" - PostgreSQL error indicating query uses alias `fc` referencing column `id` that doesn't exist
reproduction: In chat, trigger a transcript search with any query. The tool "Searched Transcripts" runs and fails.
started: Unknown - currently broken in production

## Eliminated

## Evidence

## Resolution

root_cause:
fix:
verification:
files_changed: []
