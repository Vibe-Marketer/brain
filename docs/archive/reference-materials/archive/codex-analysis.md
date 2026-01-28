> **ARCHIVED January 26, 2026.** Superseded by `feature-registry.md`, `feature-audit-report.md`, and `feature-roadmap.md`. This document is retained for historical reference only.

# CallVault Feature Gap Analysis (Codex)

**Date:** 2026-01-26
**Scope:** Compare canonical feature docs against current codebase implementation
**Sources:** `docs/reference/exhaustive-feature-list.md`, `docs/reference/callvault-features.md`, `docs/reference/callvault-features-og.md`

---

## Executive Summary

This report cross-checks the feature lists against the codebase and incorporates stakeholder corrections. The short list and v4.0 map contain several status mismatches (features marked scaffolded or in-process that appear implemented in code), and a set of implemented features that are missing entirely from the canonical list. The largest mismatches are in multi-source ingestion (Zoom/Google), analytics status, and the PROFITS extraction path. The recommended outcome is to update the canonical list to reflect actual code, and to split features that have an engine but lack UI triggers.

---

## Evidence-Based Feature Inventory (Codebase Signals)

This is a concise list of implemented capabilities with explicit code evidence (non-exhaustive code pointers):

### Multi-Source Ingestion
- Fathom OAuth + webhook + sync: `src/lib/api-client.ts`, `supabase/functions/sync-meetings/index.ts`, `supabase/functions/webhook/index.ts`
- Zoom OAuth + fetch/sync + webhook: `src/lib/zoom-api-client.ts`, `supabase/functions/zoom-*/index.ts`
- Google OAuth + poll/sync: `supabase/functions/google-*/index.ts`, `src/components/settings/GoogleMeetSetupWizard.tsx`
- YouTube import + transcript fetch (no UI import path verified): `supabase/functions/youtube-api/index.ts`, `src/lib/api-client.ts`

### Organization + Automation
- Folders hierarchy + drag and drop: `src/hooks/useFolders.ts`, `src/components/transcript-library/FolderSidebar.tsx`
- Hidden folders: `src/hooks/useHiddenFolders.ts`
- Tags management + assignment: `src/components/tags/TagsTab.tsx`, `src/components/transcript-library/TranscriptTableRow.tsx`
- Rules engine + recurring titles: `src/components/tags/RulesTab.tsx`, `src/components/tags/RecurringTitlesTab.tsx`
- Automation engine + scheduler: `supabase/functions/automation-engine/index.ts`, `supabase/functions/automation-scheduler/index.ts`

### AI / RAG
- Streaming chat + tools: `src/pages/Chat.tsx`, `supabase/functions/chat-stream/index.ts`
- Hybrid semantic search + reranking: `supabase/functions/semantic-search/index.ts`, `supabase/functions/rerank-results/index.ts`
- Embedding pipeline: `supabase/functions/embed-chunks/index.ts`, `supabase/functions/process-embeddings/index.ts`
- Auto-tagging + AI titles + meta-summary: `supabase/functions/auto-tag-calls/index.ts`, `supabase/functions/generate-ai-titles/index.ts`, `supabase/functions/generate-meta-summary/index.ts`

### Content Hub
- Content generators + libraries: `src/pages/ContentHub.tsx`, `src/pages/ContentGenerators.tsx`, `src/pages/HooksLibrary.tsx`
- Insight miner + hook generator + content builder: `supabase/functions/content-insight-miner/index.ts`, `supabase/functions/content-hook-generator/index.ts`, `supabase/functions/content-builder/index.ts`

### Collaboration / Teams / Sharing
- Team hierarchy + invites + org chart: `src/pages/TeamManagement.tsx`, `src/components/sharing/OrgChartView.tsx`
- Coaching relationships: `src/hooks/useCoachRelationships.ts`, `supabase/functions/coach-relationships/index.ts`
- Delegated sharing + public share views: `src/hooks/useSharing.ts`, `src/pages/SharedCallView.tsx`

### Exports + Library UX
- Export utilities: `src/lib/export-utils.ts`, `src/lib/export-utils-advanced.ts`
- Bulk action toolbar: `src/components/transcript-library/BulkActionToolbarEnhanced.tsx`
- Core transcript library + filters: `src/pages/TranscriptsNew.tsx`, `src/components/transcript-library/FilterBar.tsx`

### Settings + Admin
- Integrations + business profile + admin tabs: `src/components/settings/IntegrationsTab.tsx`, `src/components/settings/BusinessProfileTab.tsx`, `src/components/settings/AdminTab.tsx`
- Debug tooling + logging: `src/components/tags/DebugTool.tsx`, `src/lib/logger.ts`, `src/lib/sentry.ts`

### Analytics
- Analytics data hook: `src/hooks/useCallAnalytics.ts`
- UI panes exist but placeholder content: `src/pages/Analytics.tsx`, `src/components/panes/AnalyticsDetailPane.tsx`

---

## Gaps and Mismatches vs. Canonical Lists

### 1) Status Mismatches

**Zoom Integration**
- Listed as Production in `docs/reference/exhaustive-feature-list.md`.
- Stakeholder confirms status should be **Beta** until verified end-to-end.
- Recommendation: mark as **Beta**.

**Google Meet Integration**
- Listed as Production in `docs/reference/exhaustive-feature-list.md`.
- Stakeholder confirms status should be **Beta** until verified end-to-end.
- Recommendation: mark as **Beta**.

**YouTube Integration**
- Listed as Beta in v4.0.
- Code is present for API and transcript fetch, but no UI import path was confirmed.
- Recommendation: keep **Beta** and add note: “API present; UI import flow not yet verified.”

**PROFITS Framework**
- Stakeholder confirms engine is unverified; mark both engine and UI as **In-Process**.
- Recommendation: split into two line items with **In-Process** status for each.

**Analytics**
- OG list includes Analytics; short list omits it entirely.
- Code indicates data hook exists, UI panes are placeholders.
- Recommendation: add as **Scaffolded / Partial** (explicitly note placeholder UI).

---

## Missing Features to Add to Canonical List (Implemented in Code)

1. **Embedding Pipeline (Chunk + Process)**
   - Evidence: `supabase/functions/embed-chunks/index.ts`, `supabase/functions/process-embeddings/index.ts`

2. **Auto-Tagging + Bulk AI actions**
   - Evidence: `supabase/functions/auto-tag-calls/index.ts`, bulk UI `src/components/transcript-library/BulkActionToolbarEnhanced.tsx`

3. **Recurring Titles / Pattern Detection**
   - Evidence: `src/components/tags/RecurringTitlesTab.tsx`

4. **Hidden Folders**
   - Evidence: `src/hooks/useHiddenFolders.ts`

5. **Team Org Chart + Direct Reports**
   - Evidence: `src/components/sharing/OrgChartView.tsx`, `supabase/functions/team-direct-reports/index.ts`

6. **Tokenized Public Share Views**
   - Evidence: `src/pages/SharedCallView.tsx`, `src/hooks/useSharing.ts`

7. **AI Processing Progress UI**
   - Evidence: `src/components/transcripts/AIProcessingProgress.tsx`

8. **Automation Scheduler**
   - Evidence: `supabase/functions/automation-scheduler/index.ts`

9. **Business Profile (AI Grounding)**
   - Evidence: `src/components/settings/BusinessProfileTab.tsx`, `src/lib/business-profile.ts`

10. **YouTube Transcript Import (API only; UI unverified)**
    - Evidence: `supabase/functions/youtube-api/index.ts`

---

## Items That Appear Overstated or Need Verification

**AI model selection / multi-provider presets**
- Stakeholder confirms this is implemented as an admin feature (OpenRouter model sync + tier/preset controls).
- Recommendation: mark as **Production** and add to canonical list under Settings/Admin AI.

**Transcript editing**
- Stakeholder confirms title editing is fully implemented; broader transcript edit coverage should be verified.
- Recommendation: split “Title/summary editing” as **Production** and “Full transcript editing” as **Partial** if not globally enabled.

---

## Recommendations

1. **Make `docs/reference/exhaustive-feature-list.md` the single source of truth**
2. **Normalize statuses** against code evidence (Zoom/Google/YouTube/Analytics/PROFITS).
3. **Split hybrid features** into engine vs. UI trigger (e.g., PROFITS, Analytics).
4. **Add missing implemented features** listed above.
5. **Archive or clearly label the OG list** as historical if it diverges from live system.

---

## Appendix: Likely Moat Enhancers (Not Yet Implemented)

These align with existing architecture and would extend the competitive edge:

- Call outcome scoring + coaching scorecards
- Objection-to-rebuttal library
- Client health alerts (sentiment/engagement trend detection)
- Folder-level chat + digest exports
- Cross-client vocabulary diffing
- PII redaction layer before embedding
- Multi-integration call dedup/merge

---

**End of report**
