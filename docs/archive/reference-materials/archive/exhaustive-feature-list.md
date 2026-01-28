> **ARCHIVED January 26, 2026.** Superseded by `feature-registry.md`, `feature-audit-report.md`, and `feature-roadmap.md`. This document is retained for historical reference only.

# CallVault™ Exhaustive Feature & Capability Map

**Generated:** January 26, 2026  
**Version:** 4.0 (Unified Deep Audit)  
**Status:** Authoritative Reference

---

## 1. CORE PLATFORM & WORKSPACE
*The foundation of the high-density "Pro Tool" experience.*

| Feature Name | Description | Status | Tech Implementation |
| :--- | :--- | :--- | :--- |
| **3-Pane AppShell** | Loop-inspired layout: NavRail + Category Pane + Detail View. | **Production** | React + AppShell (500ms transitions). |
| **Real-Time Sync** | Instant cross-tab state updates for organization and settings. | **Production** | Supabase Realtime (useSyncTabState). |
| **Command+K Search** | App-wide global semantic search and command interface. | **Production** | useGlobalSearch.ts + GlobalSearchModal.tsx. |
| **Debug Panel** | In-app console for monitoring webhooks, DB, and environment. | **Production** | DebugPanelContext.tsx + log inspector. |
| **Setup Wizard** | Guided onboarding for integration and profile setup. | **Production** | useSetupWizard.ts. |

---

## 2. MULTI-SOURCE INGESTION & SYNC
*The "Universal Inbox" for business conversations.*

| Feature Name | Description | Status | Tech Implementation |
| :--- | :--- | :--- | :--- |
| **Fathom OAuth** | Full secure sync of historical and real-time Fathom data. | **Production** | OAuth2 + Webhook (Idempotent). |
| **Zoom Native Sync** | Direct API connection for Zoom Cloud recordings. | **Beta** | zoom-api-client / zoom-sync-meetings. |
| **Google Meet Sync** | Polling and calendar sync for Google Meet meetings. | **Beta** | google-poll-sync / google-meet-sync. |
| **YouTube Import** | Import podcast/video content via public URL (API present; UI import flow unverified). | **Beta** | youtube-api function logic. |
| **Selective Ingestion**| Preview metadata and pick specific calls to sync. | **Production** | useIntegrationSync.ts. |
| **Manual Upload** | Legacy import for MP3/WAV/MP4 files. | **Roadmap** | Logic planned; no codebase presence. |

---

## 3. ORGANIZATION & AUTOMATION ENGINE
*Turning transcripts into a structured knowledge base.*

| Feature Name | Description | Status | Tech Implementation |
| :--- | :--- | :--- | :--- |
| **Automation Rules** | Trigger/Action system (If sentiment < 50, tag "At Risk"). | **Production*** | Triggers: Sentiment, Phrase, Duration. |
| **Scheduled Tasks** | Time-based automation rules (pg_cron invokes automation-engine). | **Production** | automation-scheduler (Deno). |
| **Smart Hierarchy** | 3-level folder nesting with custom icons and drag-and-drop. | **Production** | useFolders.ts + useDragAndDrop.ts. |
| **Hidden Folders** | Exclude specific folders from “All Transcripts” view. | **Production** | useHiddenFolders.ts (localStorage). |
| **Recurring Detection**| Auto-identification of recurring meeting series. | **Production** | Logic in Sorting/Tagging patterns. |
| **Bulk Toolbar** | Context-aware multi-select tag, move, export, and delete. | **Production** | BulkActionToolbarEnhanced.tsx. |
| **Auto-Tagging** | AI-driven tagging based on transcript keyword patterns. | **Production** | auto-tag-calls backend function. |
| **AI Title Generation** | Auto-name calls with generic titles (bulk supported). | **Production** | generate-ai-titles backend function. |

---

## 4. INTELLIGENCE & PROFITS FRAMEWORK
*Extraction of actionable sales and marketing psychology.*

| Feature Name | Description | Status | Tech Implementation |
| :--- | :--- | :--- | :--- |
| **PROFITS Extraction Engine** | Extraction of Pain, Results, Obstacles, Fears, etc. | **In-Process** | Backend logic in ai-agent.ts. |
| **PROFITS UI Trigger & Review** | UI trigger and review panel for extracted data. | **In-Process** | UI workflow not yet verified. |
| **Sentiment Intel** | Real-time sentiment scoring (0-100) per transcript segment. | **Production** | automation-sentiment Edge Function. |
| **Real-Time Coach** | Advice based on current transcript vs. past "wins." | **Production** | applyInsightsToCall in ai-agent.ts. |
| **Market Language** | Mining buyer adjectives and phrases for ad copy. | **Roadmap** | Specialized extraction agent planned. |
| **Insight Library** | Persistence of extracted data separate from transcripts. | **Production** | `insights` and `quotes` DB tables. |

---

## 5. AI CHAT & DISCOVERY (RAG)
*Conversational access to every word spoken in the business.*

| Feature Name | Description | Status | Tech Implementation |
| :--- | :--- | :--- | :--- |
| **Streaming AI Chat** | Real-time natural language interaction with library. | **Production** | Vercel AI SDK + OpenRouter. |
| **Semantic Reranking** | High-precision results using Cross-Encoder reranking. | **Production** | Hugging Face Inference API. |
| **Hybrid RAG** | Combination of pgvector semantic + keyword search. | **Production** | semantic-search / Reciprocal Rank Fusion. |
| **Context Citations** | Visual "Source" links to specific transcript chunks. | **Production** | RAG response mapping to recording IDs. |
| **Agentic Tools** | AI can "search transcripts" or "fetch details" during chat. | **Production** | useChatSession tool-calling logic. |
| **Embedding Pipeline** | Chunking + embeddings processing for search index. | **Production** | embed-chunks / process-embeddings. |
| **Folder Synthesis** | Synthesis of multiple transcripts at once (Macro view). | **Roadmap** | "Chat with Folder" logic planned. |

---

## 6. CONTENT HUB (MONETIZATION)
*Transforming conversations into marketing assets.*

| Feature Name | Description | Status | Tech Implementation |
| :--- | :--- | :--- | :--- |
| **4-Agent Wizard** | Classifier -> Miner -> Hook Gen -> Post Builder pipeline. | **In-Process** | UI complete; logic currently using mocks. |
| **Hooks Vault** | Repository for high-converting hooks extracted from calls. | **Production** | HooksLibrary.tsx + useHooksLibrary.ts. |
| **Business Profiles** | 34-field brand voice engine for AI grounding. | **Production** | business-profile.ts logic. |
| **Advanced Exports** | Bulk export content to MD, PDF, JSON, DOCX, ZIP. | **Production** | export-utils-advanced.ts. |
| **Visual Agent Build** | ReactFlow canvas for custom AI workflow design. | **Planning** | Epic-scale roadmap item. |

---

## 7. COLLABORATION & TEAMS
*Org structures for coaching programs and remote teams.*

| Feature Name | Description | Status | Tech Implementation |
| :--- | :--- | :--- | :--- |
| **Collaboration Hub** | Central dashboard for Team and Coach activities. | **Production** | CollaborationPage.tsx + useSharing.ts. |
| **Delegated Sharing** | Share specific calls without full library access. | **Production** | token-based public views + RLS. |
| **Public Share Views** | Tokenized, read-only call views for shared recipients. | **Production** | SharedCallView.tsx + useSharing.ts. |
| **Coaching Portal** | Filtered views for Coach vs. Coachee workflows. | **Production** | useCoachRelationships.ts. |
| **Team Hierarchy** | Multi-level RBAC (Admin, Manager, Member). | **Production** | useTeamHierarchy.ts + Org Chart. |
| **CRM Integration** | Auto-push insights to HubSpot/Salesforce. | **Roadmap** | Scaffolded; missing API wiring. |

---

## 8. ANALYTICS & INSIGHTS
*Cross-library metrics and breakdowns.*

| Feature Name | Description | Status | Tech Implementation |
| :--- | :--- | :--- | :--- |
| **Analytics Dashboard** | KPI summaries and distribution charts (placeholder UI). | **Scaffolded** | useCallAnalytics.ts + Analytics panes. |

---

## 9. SETTINGS & ADMIN
*Configuration, AI model governance, and admin controls.*

| Feature Name | Description | Status | Tech Implementation |
| :--- | :--- | :--- | :--- |
| **Business Profile** | 34-field brand voice grounding for AI. | **Production** | business-profile.ts. |
| **AI Model Presets** | Admin control of OpenRouter models, tiers, defaults. | **Production** | AdminModelManager.tsx + sync-openrouter-models. |
| **User Management** | Role and access management for org members. | **Production** | UsersTab.tsx + team functions. |

---

## 10. TECHNICAL DEBT & INFRASTRUCTURE HEALTH
*Current build-blockers and maintenance requirements.*

| Debt Item | Description | Impact | Priority |
| :--- | :--- | :--- | :--- |
| **Type Mismatches** | `AutomationRules.tsx` mismatches Supabase schema. | Prevents clean TS builds. | **High** |
| **AI SDK Errors** | `ai-agent.ts` uses outdated `maxTokens` property. | Potential runtime/SDK warnings. | **Medium** |
| **Sync Logic Types** | `SyncTab.tsx` has loose types for Meetings/Jobs. | Risk of runtime data errors. | **Medium** |
| **Analytics Stubs** | Charts exist but detail panes are "Coming Soon." | Incomplete feature UX. | **Low** |

---

## THE COMPETITIVE MOAT (Unique Edge)
1. **PROFITS + Real-Time Coaching:** No other tool maps transcript data to a specific 7-part sales psychology framework.
2. **Delegated Coaching Sync:** Coaches can receive "pushed" calls from students/teams without full vault access.
3. **Semantic Reranking:** Enterprise-grade search accuracy usually reserved for multi-million dollar tools.
4. **Business Profile Grounding:** 34-field brand voice ensures AI doesn't sound like a generic bot.
