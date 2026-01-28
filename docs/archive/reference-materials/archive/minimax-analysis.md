> **ARCHIVED January 26, 2026.** Superseded by `feature-registry.md`, `feature-audit-report.md`, and `feature-roadmap.md`. This document is retained for historical reference only.

# CallVault Feature Gap Analysis Report

**Date:** 2026-01-26  
**Analysis Source:** Codex comparison of canonical docs against codebase  
**Documents Analyzed:** `docs/reference/exhaustive-feature-list.md`, `docs/reference/callvault-features.md`, `docs/reference/codex-analysis.md`

---

## Executive Summary

The three canonical feature documents contain significant inconsistencies with each other and with the codebase. Several features described by the user are missing entirely from all documentation.

---

## 1. Document Comparison Matrix

| Feature | Exhaustive v4.0 | Features.md | Codex Confirmed | Discrepancy |
|---------|----------------|-------------|-----------------|-------------|
| Fathom OAuth | Production | Production | ✅ | OK |
| Zoom Native Sync | Beta | In-Process | ✅ | Status mismatch |
| Google Meet Sync | Beta | Scaffolded | ✅ | Status mismatch |
| YouTube Import | Beta | Available (Beta) | ✅ | OK |
| Manual Uploads | Roadmap | Roadmap | ❌ | OK |
| 3-Pane AppShell | Production | Production | ✅ | OK |
| Automation Rules | Production* | Production | ✅ | OK |
| Smart Folders | Production | Production | ✅ | OK |
| Auto-Tagging | Production | Not Listed | ✅ | **Missing** |
| Recurring Titles | Production | Not Listed | ✅ | **Missing** |
| Hidden Folders | Production | Not Listed | ✅ | **Missing** |
| PROFITS Framework | In-Process | Production | ⚠️ | **Critical** |
| Semantic Reranking | Production | Production | ✅ | OK |
| Hybrid RAG | Production | Production | ✅ | OK |
| Streaming AI Chat | Production | Not Listed | ✅ | **Missing** |
| Chat Tools/Agents | Production | Not Listed | ✅ | **Missing** |
| Embedding Pipeline | Production | Not Listed | ✅ | **Missing** |
| Hooks Library | Production | Not Listed | ✅ | **Missing** |
| Content Generators | In-Process | Production | ⚠️ | Status mismatch |
| Collaboration Hub | Production | Production | ✅ | OK |
| Delegated Sharing | Production | Production | ✅ | OK |
| Coaching Portal | Production | Production | ✅ | OK |
| Team Hierarchy | Production | Not Listed | ✅ | **Missing** |
| Org Chart View | Production | Not Listed | ✅ | **Missing** |
| Tokenized Public Shares | Production | Not Listed | ✅ | **Missing** |
| AI Processing Progress UI | Production | Not Listed | ✅ | **Missing** |
| Automation Scheduler | Production | Not Listed | ✅ | **Missing** |
| Business Profile (AI Grounding) | Production | Not Listed | ✅ | **Missing** |
| Analytics Dashboard | Scaffolded | Not Listed | ✅ | **Missing** |
| AI Model Presets | Production | Not Listed | ✅ | **Missing** |
| Debug Panel | Production | Not Listed | ✅ | **Missing** |
| Setup Wizard | Production | Not Listed | ✅ | **Missing** |
| Command+K Search | Production | Not Listed | ✅ | **Missing** |
| Bulk Action Toolbar | Production | Production | ✅ | OK |
| Sentiment Intelligence | Production | Production | ✅ | OK |
| Real-Time Coach | Production | Production | ✅ | OK |
| Market Language Export | Roadmap | Roadmap | ✅ | OK |
| Advanced Exports | Production | Production | ✅ | OK |
| CRM Integration | Roadmap | Roadmap | ✅ | OK |
| Client Health Alerts | Roadmap | Roadmap | ✅ | OK |
| Objection Database | Roadmap | Roadmap | ✅ | OK |
| Chat with Folder | Roadmap | Roadmap | ✅ | OK |
| Privacy Redaction | Roadmap | Roadmap | ✅ | OK |
| Visual Agent Build | Planning | Not Listed | ✅ | **Missing** |

---

## 2. Features from User Description Not in Any Document

These features were explicitly mentioned in your overview but appear in **no documentation**:

| Missing Feature | Evidence from User Description |
|----------------|-------------------------------|
| **Multi-Integration Call Deduplication** | "bring all these under one place... regardless of where they've been gathered" |
| **Client-Level Organization** | "organize them accordingly by tags, folders, **clients**" |
| **Cross-Client Vocabulary Analysis** | "extract the language that your buyers speak... to improve ads and funnels" |
| **Folder-Level Permissions** | "specific calls they want to give you access to... with a simple folder" |
| **Bulk AI Actions** | "based on tags, you'll be able to use the AI to take actions on the calls and have it automatically run certain agents" |
| **Call Scoring Rubric** | "calls automatically scored based on a scoring rubric" |
| **Team Onboarding Dashboard** | "bring on people... that all have their own different Fathoms... get access to that stuff or monitor those call recordings" |
| **Reseller/Sub-Account Structure** | "as an online coach... have people underneath me" |
| **Single-File Transcript Export** | "export all of your transcripts as one file if you want" |
| **Multi-Transcript View/Synthesis** | "see them all together" |
| **PII Redaction Before Embedding** | Implied for compliance; codex mentions this |
| **Cross-Call Trend Detection** | "client health... sentiment/engagement trend detection" |

---

## 3. Status Corrections Needed

### Critical (Impact: Feature Clarity)

1. **PROFITS Framework** - Marked Production in `callvault-features.md` but In-Process in v4.0 AND stakeholder confirms it's unverified. **Status: In-Process (Both Engine & UI)**

2. **Content Generators** - Marked Production in `callvault-features.md` but In-Process in v4.0. Code shows UI complete, logic uses mocks. **Status: In-Process**

3. **Zoom Integration** - Listed In-Process in `callvault-features.md` but Beta in v4.0. Codebase shows Zoom OAuth client and sync functions exist. **Status: Beta**

4. **Google Meet Integration** - Listed Scaffolded in `callvault-features.md` but Beta in v4.0. **Status: Clarify - Codex says Beta but functionality needs verification**

### Medium (Impact: User Expectations)

5. **Analytics Dashboard** - Listed in v4.0 as Scaffolded but completely missing from `callvault-features.md`. **Action: Add as Scaffolded/Partial**

6. **Manual Uploads** - Listed as Roadmap in both docs. **Action: Confirm if this is still planned or deprecated**

---

## 4. Missing Features to Add to Docs

Based on codex analysis, these are **implemented but undocumented**:

### Core Platform
- **Command+K Search** - Global semantic search + command interface
- **Debug Panel** - In-app console for webhooks/DB/environment monitoring
- **Setup Wizard** - Guided onboarding flow

### Organization & Automation
- **Auto-Tagging** - AI-driven tagging based on keyword patterns
- **Recurring Titles Detection** - Auto-identify meeting series patterns
- **Hidden Folders** - Exclude folders from "All Transcripts" view
- **Bulk AI Actions** - Apply AI processing to multiple calls at once
- **Automation Scheduler** - Time-based automation rules (pg_cron)

### AI & RAG
- **Streaming AI Chat** - Real-time LLM interaction
- **Chat Tools/Agents** - AI can search/fetch during chat
- **Embedding Pipeline** - Chunking + embeddings processing
- **Context Citations** - Visual links to transcript chunks
- **AI Processing Progress UI** - Visual feedback on AI operations

### Collaboration
- **Team Hierarchy** - Multi-level RBAC (Admin, Manager, Member)
- **Org Chart View** - Visual team organization display
- **Tokenized Public Shares** - Read-only views for external recipients
- **Direct Reports Management** - Team member oversight

### Content & Export
- **Hooks Library** - Repository of extracted high-converting hooks
- **Advanced Exports (Bulk)** - ZIP, DOCX, JSON multi-call export

### Settings & Admin
- **AI Model Presets** - OpenRouter model tiers and defaults
- **Business Profile** - 34-field brand voice grounding
- **User Management** - Role and access controls

### Analytics
- **Analytics Data Hook** - KPI summaries and distribution data

---

## 5. Moat Enhancements (Not Yet Implemented)

Based on user description and architecture analysis:

| Feature | Priority | Implementation Complexity |
|---------|----------|--------------------------|
| **Call Outcome Scoring** - Rubric-based scoring for sales teams | High | Medium |
| **Coaching Scorecards** - Standardized evaluation templates | High | Medium |
| **Objection-to-Rebuttal Library** - Link problems to solutions | Medium | High |
| **Client Health Alerts** - Sentiment trend detection + notifications | Medium | Medium |
| **Cross-Client Vocabulary Diffing** - Compare buyer language across accounts | Medium | High |
| **Folder-Level Chat** - Chat with all calls in a folder at once | Medium | Medium |
| **Multi-Integration Deduplication** - Merge same call from multiple sources | Low | High |
| **PII Redaction Layer** - Strip sensitive data before embedding | Low | Medium |
| **CRM Bidirectional Sync** - Pull contacts FROM HubSpot/Salesforce | Low | High |
| **Reseller/White-Label** - Sub-account branding capabilities | Low | High |

---

## 6. Recommendations

### Immediate Actions

1. **Update `callvault-features.md`** to align with v4.0 status designations
2. **Add 20+ missing implemented features** to the canonical list
3. **Correct PROFITS status** to In-Process (engine verified, UI unverified)
4. **Add user-described features** that are missing from all docs

### Medium-Term

5. **Create separate "Engine" vs "UI Trigger" columns** for features with partial implementation
6. **Add "User-Requested Features" section** tracking features explicitly requested but not yet in roadmap
7. **Deprecate `callvault-features.md` or merge into v4.0** to avoid doc drift

### Long-Term

8. **Document integration status verification requirements** (end-to-end testing before Production)
9. **Add feature ownership** (which team/person owns each feature)
10. **Create release markers** for when features moved to Production

---

## 7. Final Consolidated Feature Count

| Category | Documented | Implemented (Undocumented) | User-Described (Missing) | Total |
|----------|-----------|---------------------------|--------------------------|-------|
| Ingestion | 5 | 0 | 1 (Client org) | 6 |
| Core Platform | 2 | 3 (Debug, Command+K, Wizard) | 0 | 5 |
| Organization | 3 | 4 (Auto-tag, Recurring, Hidden, Bulk AI) | 1 (Folder permissions) | 8 |
| AI/RAG | 4 | 4 (Streaming, Tools, Pipeline, Citations) | 2 (Scoring, Cross-call synthesis) | 10 |
| Intelligence | 4 | 0 | 2 (Health alerts, Vocabulary) | 6 |
| Content Hub | 4 | 1 (Hooks Library) | 0 | 5 |
| Collaboration | 3 | 3 (Hierarchy, Org Chart, Direct Reports) | 2 (Team onboarding, Reseller) | 8 |
| Analytics | 1 | 0 | 0 | 1 |
| Settings/Admin | 3 | 2 (AI Presets, Business Profile) | 0 | 5 |
| **TOTALS** | **29** | **21** | **8** | **58** |

---

## Conclusion

The canonical documentation underrepresents the actual codebase by ~30+ features. The largest gaps are in:

- **Organization** (automation features)
- **AI/RAG** (chat infrastructure)
- **Collaboration** (team management)

Additionally, **8 features** explicitly described by the user have never been documented at any level.

---

## Appendix: File Reference Matrix

| File | Purpose | Last Updated |
|------|---------|--------------|
| `docs/reference/exhaustive-feature-list.md` | Authoritative v4.0 feature map | 2026-01-26 |
| `docs/reference/callvault-features.md` | Simplified feature overview (needs alignment) | Pre-v4.0 |
| `docs/reference/codex-analysis.md` | Codebase evidence and gap analysis | 2026-01-26 |
| `docs/reference/minimax-analysis.md` | This consolidated report | 2026-01-26 |