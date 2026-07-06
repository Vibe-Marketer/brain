# MISALIGNMENT AUDIT — Dead Pages, Stubs & Out-of-Alignment Code

**Status:** Active worklist · **Audited against code:** 2026-06-08 · **Owner:** Andrew Naegele

> Verified entirely against actual source in `/Users/Naegele/dev/brain` (not docs). Ordered by importance — what to resolve first. Per the repo's "reality over documentation" rule, several doc allegations were **false** and are corrected at the bottom. Each item cites `file:line` and a removal-risk rating.

---

## Corrections first — things the docs claimed were broken but are CLEAN (do not touch)

- ✅ **Analytics is real, not fake.** All 6 tabs render live KPIs from `useCallAnalytics`. Only some *embedded charts* are placeholders (see P5). The "scaffolded/coming-soon" claim is overstated.
- ✅ **Zero Google Meet remnants.** Grep for `google.?meet|googlemeet|google_meet` across `src/` + `supabase/functions/` = nothing. FOUND-09 fully satisfied.
- ✅ **No retired AI/RAG/embedding/Content-Hub corpse.** Grep for `embedding(s)|rag|pgvector|vector|contentWizard|contentHub|PROFITS|sentiment|insights|quotes` in `src/`/`functions/` = nothing. AI-02 clean. (Live AI = server-side edge functions like `summarize-call`, called function-to-function.)
- ✅ **No pricing-config conflict in code.** `PlanCards.tsx` (display) and `useSubscription.ts` (entitlement) are complementary, not duplicate. The "two pricing schemes" was a docs artifact.
- ✅ **Invite flow is live and correct** (`OrganizationInviteDialog.tsx:89`, `WorkspaceInviteDialog.tsx:127` → `send-org-invite`; join routes at `/join/org/:token`, `/join/workspace/:token`).
- ✅ **These edge functions look orphaned but aren't** (invoked via hooks or server-to-server): `summarize-call`, `generate-ai-titles`, `auto-tag-calls`, `youtube-api`, `global-search`, `apply-routing-rules`, `split-recording`, `fathom-reconcile`, `save-host-email`.

---

## Prioritized removal / fix list

| # | What it is | Files | Evidence (quoted) | Action | Risk |
|---|-----------|-------|-------------------|--------|------|
| **P1** | **Entire team-hierarchy / org-chart vertical — built, ZERO UI consumers.** `TeamInviteDialog` imported nowhere; sole consumer of `useTeamHierarchy`/`useTeamMembers`; `useOrgChart` has no consumers; `teams` edge fn reachable only via dead hook. ~1,574 lines. | `src/components/sharing/TeamInviteDialog.tsx`, `src/hooks/useTeamHierarchy.ts`, `src/hooks/useOrgChart.ts`, `src/hooks/useTeamMembers.ts`, `supabase/functions/teams/index.ts`, dead keys in `src/lib/query-config.ts:110-118` | `teams/index.ts:26`: `"legacy endpoint under v2.3 cleanup review"`; `grep -rl TeamInviteDialog src/` → empty | **REMOVE** (confirm no roadmap need for manager rollups/org chart first) | Low |
| **P2** | **`SharedWithMe` page — orphaned file.** Route `/shared-with-me` → redirect to `/`; component imported nowhere. | `src/pages/SharedWithMe.tsx` (477 ln) | `App.tsx:34`: `// SortingTagging and SharedWithMe removed — routes now redirect` | **REMOVE** | Low |
| **P3** | **`SortingTagging` page — orphaned file.** Six `/sorting-tagging*` routes all redirect (`App.tsx:139-144`). | `src/pages/SortingTagging.tsx` (312 ln) | Same `App.tsx:34` comment; no import | **REMOVE** | Low |
| **P4** | **`personal_folders` — half-built against a non-existent table.** Service returns `[]`/`{}` stubs; mutations throw "not available yet"; hook has zero consumers. | `src/services/personal-folders.service.ts`, `src/hooks/usePersonalFolders.ts` | `personal-folders.service.ts:20`: `// TODO: personal_folders table migration is pending — remove this stub when table exists` | **REMOVE** (or finish if planned) | Low |
| **P5** | **Analytics chart placeholders shipping in a paid product.** Tabs are live but several embedded charts are hardcoded "coming soon"/fake-zero blocks. ContentTab is the worst (entirely placeholder around a "clips" feature that "may not exist"). | `OverviewTab.tsx:112,124`, `ContentTab.tsx:66-74,82,147-148`, `DurationTab.tsx:137,149`, `ParticipationTab.tsx:158-184`, `TalkTimeTab.tsx:102,179`, `TagsTab.tsx:34` | `OverviewTab.tsx:112`: `Line chart coming soon`; `ContentTab.tsx:82`: `// Placeholder analytics data - all zeros since clips feature may not exist` | **WIRE-UP or REMOVE placeholder blocks** (keep real KPI rows). Don't ship "coming soon" to paying users. | Med |
| **P6** | **Integration "Disconnect" is a no-op stub** in a live modal — user clicks a button that does nothing. | `src/components/integrations/IntegrationConnectModal.tsx:31-34` | `:32 // TODO: Implement actual disconnect API call`; `:33 toast.info("Disconnect not implemented yet")` | **WIRE-UP** or hide button until built | Med |
| **P7** | **YouTube metadata enrichment broken** — `userJwtToken` ReferenceError; import still lands via fallback, but channel/view-count enrichment is dead. | `supabase/functions/youtube-import/index.ts:536` | `:536` references `userJwtToken`; never declared; auth helper returns only `{ userId }` (`_shared/auth.ts:41`) | **FIX** (remove broken enrichment call or wire the token) | Med |
| **P8** | **Dead cross-source fuzzy dedup module** — real algorithm, zero production callers (Fathom side). Misleads anyone reading it as a shipped feature. | `supabase/functions/_shared/deduplication.ts` | Header claims "Used by sync-meetings (Fathom)" but `sync-meetings/index.ts:133` calls only `runPipeline`; grep for callers = none | **REMOVE** (or wire as part of the cross-source dedup roadmap build) | Low |
| **P9** | **`@deprecated` alias still active** — back-compat type. | `src/hooks/useOrganizationContext.ts:23` | `/** @deprecated Use \`defaultWorkspace\` */` | **CLARIFY** — migrate callers, remove alias | Low |
| **P10** | **Deprecated v1 brand-color block in CSS.** | `src/index.css:149` | `/* CallVault Brand Colors ... (deprecated - use unprefixed) */` | **REMOVE** after verifying no class refs the prefixed vars | Low-Med |

---

## Suggested execution order

**Pure deletes (low risk, fast wins):** P2 → P3 → P4 → P8 → P1 (verify roadmap first).
**Fixes that affect paying users:** P5 (ContentTab placeholders) → P6 (disconnect) → P7 (YouTube enrichment).
**Cleanup:** P9 → P10.

Immediately-deletable dead code if P1–P4 + P8 go: **~2,650+ lines** across 9 files + the `teams` edge function + dead `query-config` keys.

---

## NEEDS CLARIFICATION (could not determine from code alone)

1. **P1 — team hierarchy / org chart:** Deferred feature (manager rollups, direct reports, org chart) or abandoned? Code is complete but disconnected from all UI; `teams/index.ts:26` says "v2.3 cleanup review." **Keep + route, or remove the whole slice?**
2. **P4 — personal_folders:** Was the table migration intentionally dropped, or is it pending? Remove the stub, or finish the feature?
3. **P5 — ContentTab "clips":** Is a clips feature planned? Determines wire-up vs delete.
4. **P10 — deprecated CSS palette:** Verify no compiled Tailwind class references the prefixed monochrome vars before deleting (needs a build-time scan).
5. **Cross-source dedup (roadmap, not a bug):** Confirm priority — wiring it across sources closes the one false positioning claim and is genuinely unique. See `THE-MOAT.md` §ROADMAP.
