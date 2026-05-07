# Spike Manifest

## Idea

Validate the existing Fathom *full-API* integration (OAuth + webhooks + sync) end-to-end, then research adding Fathom-equivalent integrations for the four most popular AI notetakers Andrew wants in CallVault: **Read.ai** and **Otter** (P0), **Fireflies** and **tl;dv** (P1).

This is the API-integration counterpart to Phase 24 (Fathom share-link paste, shipped 2026-05-07). Paste handles users without API access; full API integrations are the premium path that mirrors what Fathom users get today: auto-sync of recent meetings, real-time webhook delivery on new recordings, and zero copy-paste friction.

**Mode:** Option C — research-only first (paper feasibility before any OAuth proof). Each provider spike documents the API surface and gives a GO / NO-GO / CONDITIONAL verdict. After this round, providers that pass paper review get follow-up "OAuth + transcript fetch" proof spikes.

## Requirements

Decisions that emerged from spike alignment. Non-negotiable for any provider integration we ship.

- **R-01:** Each provider must have its own raw table, field mapping, and full edge-function stack (OAuth url/callback/refresh + webhook + fetch + sync), per the established `project_integration_provider_pattern.md` rule.
- **R-02:** Paste-flow (`save-pasted-transcript`) remains the universal fallback for users on plans without API access. API integrations augment, never replace, paste.
- **R-03:** Provider TOS clauses on storage and redistribution must be reviewed in each research spike. CallVault must be permitted to store transcripts long-term in the user's workspace.
- **R-04:** A provider whose API requires an enterprise plan with no self-serve developer access is CONDITIONAL — buildable, but only if Andrew is willing to require that plan tier from end users.
- **R-05:** The existing `import_sources` table pattern (per-account OAuth tokens, multi-account support, account_email dedup) is the contract every new provider plugs into.

## Spikes

| #   | Name                              | Type     | Validates                                                    | Verdict | Tags                       |
|-----|-----------------------------------|----------|--------------------------------------------------------------|---------|----------------------------|
| 001 | fathom-reference-architecture     | standard | Document Fathom's working full-API integration as the template every other provider must match | PENDING | reference, fathom          |
| 002 | readai-api-research               | standard | Read.ai API surface paper feasibility                        | PENDING | provider, read-ai, p0      |
| 003 | otter-api-research                | standard | Otter API surface paper feasibility                          | PENDING | provider, otter, p0        |
| 004 | fireflies-api-research            | standard | Fireflies GraphQL API surface paper feasibility              | PENDING | provider, fireflies, p1    |
| 005 | tldv-api-research                 | standard | tl;dv API surface paper feasibility                          | PENDING | provider, tldv, p1         |
| 006 | provider-comparison-synthesis     | standard | Cross-provider matrix + recommendation for follow-up OAuth-proof spikes | PENDING | synthesis, recommendation |
