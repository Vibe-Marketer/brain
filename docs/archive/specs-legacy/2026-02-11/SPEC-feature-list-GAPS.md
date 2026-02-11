# SPEC-feature-list-GAPS

**Status:** Draft
**Priority:** High
**Coordination:** Documentation alignment for feature listings

---

## Executive Summary

This gaps spec documents mismatches between the canonical feature lists and the current codebase, and defines the minimal changes needed to align documentation with actual implementation. The primary objective is accuracy: statuses should reflect what exists in code, missing implemented features must be listed, and overstated features should be downgraded or split into engine vs. UI triggers. Stakeholder corrections are included.

---

## What

Update `docs/reference/exhaustive-feature-list.md` to reflect the verified codebase state, and reconcile major inconsistencies across `docs/reference/callvault-features.md` and `docs/reference/callvault-features-og.md`.

Required changes include:

1. Correct feature statuses (Zoom, Google Meet, Analytics, PROFITS).
2. Add implemented but missing features (embedding pipeline, hidden folders, etc.).
3. Split multi-part features where the engine exists but UI does not (e.g., PROFITS extraction vs. UI trigger).
4. Tag legacy lists clearly as historical or reconcile their content to the canonical list.

---

## Why

- Inaccurate feature statuses create planning confusion and misrepresent capability.
- Missing implemented features weaken the “moat” narrative by under-reporting actual differentiation.
- The current divergence across feature documents slows onboarding and roadmap alignment.

---

## User Experience

- Internal stakeholders see a single, accurate list of what is in production, in process, or on the roadmap.
- Product messaging and sales materials draw from a trustworthy canonical list.
- Roadmapping is simplified because mismatches no longer require clarification.

---

## Scope

### In Scope

- Documentation updates to feature lists in `/docs/reference/`.
- Status corrections and missing feature additions based on code evidence.
- Feature list restructuring to separate “engine” vs. “UI trigger” where needed.

### Out of Scope

- Implementing new product features.
- Editing code or altering runtime behavior.
- Rewriting marketing or brand materials outside of feature lists.

---

## Decisions Made

1. `docs/reference/exhaustive-feature-list.md` will be the canonical source of truth.
2. Statuses must be grounded in code evidence and stakeholder verification (Beta where unverified).
3. Features with partial implementation must be split into discrete line items.

---

## Acceptance Criteria

1. `docs/reference/exhaustive-feature-list.md` includes all implemented features listed below.
2. Zoom and Google Meet integrations are correctly marked as **Beta** until verified end-to-end.
3. Analytics is marked as **Scaffolded / Partial** with a clear note (data hook exists, UI placeholder).
4. PROFITS is split into:
   - Extraction Engine (In-Process)
   - UI Trigger/Review (In-Process)
5. Embedding pipeline is explicitly listed as a production component.
6. Feature statuses in `docs/reference/callvault-features.md` match the canonical list.
7. `docs/reference/callvault-features-og.md` is labeled as historical or reconciled to avoid contradictions.

---

## Gaps and Required Updates

### Status Corrections

| Feature | Current Status | Correct Status | Evidence (Code) |
| --- | --- | --- | --- |
| Zoom Integration | Production | Beta | `supabase/functions/zoom-*/index.ts`, `src/lib/zoom-api-client.ts` |
| Google Meet Integration | Production | Beta | `supabase/functions/google-*/index.ts`, `src/components/settings/GoogleMeetSetupWizard.tsx` |
| YouTube Integration | Beta | Beta (UI import unverified) | `supabase/functions/youtube-api/index.ts` |
| Analytics Dashboard | Omitted or Production | Scaffolded/Partial | `src/hooks/useCallAnalytics.ts`, `src/components/panes/AnalyticsDetailPane.tsx` |
| PROFITS Framework | Scaffolded | Split (In-Process) | `src/lib/ai-agent.ts` |

### Missing Implemented Features

| Feature | Category | Evidence (Code) |
| --- | --- | --- |
| Embedding Pipeline (Chunk + Process) | Search & AI | `supabase/functions/embed-chunks/index.ts`, `supabase/functions/process-embeddings/index.ts` |
| Auto-Tagging + Bulk AI Actions | Organization | `supabase/functions/auto-tag-calls/index.ts`, `src/components/transcript-library/BulkActionToolbarEnhanced.tsx` |
| Recurring Titles / Pattern Detection | Organization | `src/components/tags/RecurringTitlesTab.tsx` |
| Hidden Folders | Organization | `src/hooks/useHiddenFolders.ts` |
| Team Org Chart + Direct Reports | Collaboration | `src/components/sharing/OrgChartView.tsx`, `supabase/functions/team-direct-reports/index.ts` |
| Tokenized Public Share Views | Collaboration | `src/pages/SharedCallView.tsx`, `src/hooks/useSharing.ts` |
| AI Processing Progress UI | Intelligence | `src/components/transcripts/AIProcessingProgress.tsx` |
| Automation Scheduler | Automation | `supabase/functions/automation-scheduler/index.ts` |
| Business Profile (AI Grounding) | Content Hub / AI | `src/components/settings/BusinessProfileTab.tsx` |
| AI Model Presets + Provider Management | Settings / Admin | `src/components/settings/AdminModelManager.tsx` |

---

## Notes

- Model selection/presets are confirmed implemented as an admin feature; update canonical list accordingly.
- Transcript editing should be split: Title editing is Production; full transcript edits should be verified and labeled accordingly.
- If any integration is “Production” but has known limitations (e.g., Google Meet recording availability), add a short footnote rather than downgrading the status.

---

**End of GAPS spec**
