# Phase 4: MCP AI Write Tools - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-28
**Phase:** 04-MCP AI Write Tools
**Areas discussed:** Speaker ambiguity, Atomic ingest behavior, Provenance and source identity, Follow-up tool strictness

---

## Speaker Ambiguity

| Option | Description | Selected |
|--------|-------------|----------|
| Best-effort with warning | Create/reuse exact matches, create unresolved speaker participants when ambiguous, and report ambiguity in the markdown response. | yes |
| Hard-fail on ambiguity | Reject the ingest until the agent supplies clearer speaker info, such as emails or full names. | |
| Always create new speaker records | Treat supplied names as transcript-local speakers to avoid matching ambiguity. | |

**User's choice:** Best-effort with warning.
**Notes:** The server should take a first pass using existing records and submitted metadata. If there is not enough data, the markdown response should provide a prompt the AI client can show the user asking for first name, last name, email, notes, or similar details. Link-only or title-only imports are allowed but minimal. Websearch, Firecrawl, browser crawling, or OpenGraph enrichment should be agent-side in v1; CallVault should accept those enriched fields if supplied.

---

## Atomic Ingest Behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Create recording, report warnings | Get the call into the vault and list partial failures for the agent/user to fix next. | yes |
| Rollback on any failure | Keep all-or-nothing data cleanliness, but fail more one-shot imports. | |
| Two-tier rollback | Roll back only if recording/transcript/workspace write fails; treat enrichment as best-effort warnings. | |

**User's choice:** Create recording, report warnings.
**Notes:** Add an explicit planning/test note to ensure tag creation and tag-name dedup work during MCP ingest.

---

## Provenance And Source Identity

| Option | Description | Selected |
|--------|-------------|----------|
| Manual MCP Import | Clear that the call was added by an AI/client through MCP, not synced from a connector. | yes |
| Manual Transcript | Consistent with the existing paste-import mental model, but hides the MCP path. | |
| Client-named Source | Show Claude/ChatGPT/Cursor-specific import labels. | |
| Original URL Site | Show source as the provided domain/site when a URL is present. | |

**User's choice:** Manual MCP Import.
**Notes:** Use the MCP logo if available. Planning should attempt to pull it from official MCP docs/GitHub first, with fallback sources only after license verification. Preserve client/provider name and original URL/OpenGraph data in metadata instead of fragmenting the visible source label.

---

## Follow-Up Tool Strictness

| Option | Description | Selected |
|--------|-------------|----------|
| Patch and merge by default | Append transcript text, merge metadata fields, upsert speakers idempotently, and avoid deleting existing data unless explicitly requested. | yes |
| Replace by default | Useful for authoritative corrections, but easier to wipe existing data accidentally. | |
| Explicit mode required | Safer, but more friction for AI clients. | |

**User's choice:** Patch and merge by default.
**Notes:** `append_to_transcript` appends, `update_call_metadata` merges, and `set_speakers` upserts idempotently. Destructive replacement requires an explicit caller request.

---

## the agent's Discretion

- Exact markdown wording can be chosen during implementation.
- Exact schema names and source metadata keys can be chosen during planning as long as they preserve the decisions in `04-CONTEXT.md`.

## Deferred Ideas

- CallVault-hosted websearch, Firecrawl, browser crawling, OpenGraph enrichment, or other web research for MCP ingest.
- Bulk transcript ingest.
- Raw audio/file transcription.
- Admin MCP control-plane capabilities.
