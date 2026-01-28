> **ARCHIVED January 26, 2026.** Superseded by `feature-registry.md`, `feature-audit-report.md`, and `feature-roadmap.md`. This document is retained for historical reference only.

| Feature Category | Feature Name | Description | Technical Implementation Details | Status |
| :---- | :---- | :---- | :---- | :---- |
| **Ingestion** | Fathom Integration | Full synchronization of historical and future calls. | OAuth flow \+ Webhook processing (idempotent/secure). | **Production** |
| **Ingestion** | Zoom Integration | Direct API connection for meeting synchronization. | API client built/scaffolded; ready for sync logic. | **In-Process** |
| **Ingestion** | Google Meet Integration | Future expansion for direct Google Meet support. | Shared clients exist in the codebase. | **Scaffolded** |
| **Ingestion** | YouTube Integration | Import video content/podcasts via URL. | YouTube API integration presence found in audit. | **Available (Beta)** |
| **Ingestion** | Manual Uploads | "Legacy Import" for MP3s/Voice Memos not on Fathom/Zoom. | Currently missing; heavily requested for legacy data. | **Roadmap** |
| **Core Platform** | 3-Pane AppShell | "Pro" tool interface layout. | Optimized 500ms transitions; highly organized UI. | **Production** |
| **Core Platform** | Real-Time Sync | Keeps tab states identical across multiple browser windows. | Powered by Supabase Realtime. | **Production** |
| **Organization** | Automation Rules Engine | Trigger/Action system (e.g., "If sentiment \< 50, tag 'At Risk'"). | Triggers: `call_created`, `transcript_phrase`, `sentiment`, `duration`, `webhook`. | **Production** |
| **Organization** | Smart Folders & Tags | Hierarchical organization with auto-sorting rules. | Dedicated "Sorting & Tagging" interface. | **Production** |
| **Search & AI** | Semantic Reranking | Smart re-ordering of search results by meaning, not just keywords. | Hugging Face Inference API. | **Production** |
| **Search & AI** | Global Semantic Search | RAG-powered vector search across the entire library. | Hybrid search; scaffolding for `pgvector` in Supabase. | **Production** |
| **Search & AI** | Vector Loop | The full feedback loop for embedding and retrieving insights. | `src/lib/ai-agent.ts` contains TODOs for full DB integration. | **In-Process** |
| **Intelligence** | PROFITS Framework | Automated extraction of sales psychology data. | Extracting: Pain, Results, Obstacles, Fears, Identity, Triggers, Success. | **Production** |
| **Intelligence** | Sentiment Intelligence | Automated scoring (0-100) and classification (Pos/Neu/Neg). | Used for client health tracking. | **Production** |
| **Intelligence** | Real-Time Coaching Agent | "In-call" or post-call comparison against past insights. | `applyInsightsToCall` engine logic. | **Production** |
| **Collaboration** | Delegated Sharing | Share specific calls without exposing the full library. | `useSharing.ts` logic. | **Production** |
| **Collaboration** | Coaching Portal | Dedicated dashboards for Coach vs. Coachee views. | `useCoachRelationships.ts`; permissions logic. | **Production** |
| **Content Hub** | Social Generators | Formats insights into LinkedIn, FB, and X (Twitter) posts. | Templates aligned to "Business Profile" voice. | **Production** |
| **Content Hub** | Email Engine | One-click follow-up emails based on call outcomes. | Context-aware generation. | **Production** |
| **Content Hub** | Market Language Export | Extract specific adjectives/phrases used by buyers for copywriters. | Turns "Voice of Customer" into raw data for ads. | **Roadmap** |
| **Content Hub** | Advanced Exports | Bulk or single export of data. | Markdown, PDF, Text, CSV, ZIP. | **Production** |
| **Roadmap / Moat** | CRM Integration | Push "Pain" and "Results" to HubSpot/Salesforce. | Logic exists, but API connections are missing. | **Roadmap** |
| **Roadmap / Moat** | Client Health Alerts | Proactive alerts if sentiment drops X% over Y calls. | "Churn Alert" system via Resend email triggers. | **Roadmap** |
| **Roadmap / Moat** | Objection Database | Auto-tag objections and link them to the winning "Rebuttal." | Automated linking of problem \-\> solution. | **Roadmap** |
| **Roadmap / Moat** | Chat with Folder | "Macro" view; ask questions to a group of calls. | Synthesis of multiple transcripts at once. | **Roadmap** |
| **Roadmap / Moat** | Privacy Redaction | Auto-stripping PII (Credit Cards/Names) before AI processing. | Security / Compliance layer. | **Roadmap** |
