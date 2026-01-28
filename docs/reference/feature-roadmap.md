# CallVault Feature Roadmap

**Version:** 1.0
**Last Updated:** January 26, 2026
**Status:** Living Document

> For the complete list of existing features, see `feature-registry.md`. For audit findings (security, tech debt, recommendations), see `feature-audit-report.md`. For pricing structure, see `pricing-draft.md`.

---

## How This Document Is Organized

Items are grouped into five categories based on effort and strategic impact:

1. **Quick Wins** -- Low effort, high impact. Can be done this week.
2. **Moat Builders** -- Unique differentiators that no competitor offers.
3. **User Experience Improvements** -- Enhancements to existing capabilities.
4. **Enterprise Features** -- Required for upmarket sales.
5. **AI & Automation Enhancements** -- Extending the intelligence layer.
6. **Business Model & Monetization** -- Revenue expansion beyond core SaaS.

Each item includes: description, strategic value, complexity, dependencies, and user benefit.

---

## 1. Quick Wins

Low effort, high impact. These items are blocked only by wiring -- the code already exists.

### 1.1 Route Automation Rules Page
**Complexity:** Low (add route + nav link)
**Dependencies:** None -- `AutomationRules.tsx` (652 lines) is fully built.
**What to do:** Add `/automation-rules` route to `App.tsx` and add navigation entry.
**Why it matters:** Unlocks the entire automation engine for users. Currently the backend is fully operational (6 triggers, 14 operators, 12 actions) but users have zero UI access to create or manage rules.
**User benefit:** Users can build "If X happens, do Y" rules through a visual interface instead of relying solely on tag rules.

### 1.2 Route Team & Coach Invite Pages
**Complexity:** Low (add 2 routes)
**Dependencies:** None -- `TeamJoin.tsx` and `CoachJoin.tsx` are fully built.
**What to do:** Add `/join/team/:token` and `/join/coach/:token` routes to `App.tsx`.
**Why it matters:** Without these routes, invite email links produce 404 errors. Team and coaching invite flows are likely broken in production.
**User benefit:** Team invitations and coach relationship invitations actually work end-to-end.

### 1.3 Wire Analytics Tab Components
**Complexity:** Low (import existing components)
**Dependencies:** May need `useCallAnalytics` data hookup for some tabs.
**What to do:** Import `OverviewTab`, `DurationTab`, `ParticipationTab`, `TalkTimeTab`, `TagsTab`, `ContentTab` from `src/components/analytics/` into `AnalyticsDetailPane.tsx`. Replace "coming soon" placeholders.
**Why it matters:** Analytics is a visible navigation category that currently shows empty content. Users who click into it see nothing useful despite 6 components being built and a data hook being ready.
**User benefit:** Users get actual analytics about call patterns, participation, duration, and tag distribution.

### 1.4 Document the Export System
**Complexity:** Low (documentation only)
**Dependencies:** None.
**What to do:** Ensure marketing, onboarding, and help docs reflect the full export capability: 6 base formats (PDF, DOCX, TXT, JSON, Markdown, CSV), 4 bundle modes (ZIP, by-week, by-folder, by-tag), 3 advanced formats (LLM Context, Narrative, Analysis Package), 5 organization modes, and AI meta-summary.
**Why it matters:** This is the most undocumented differentiator. Most competitors offer 2-3 export formats. CallVault has 13+ and nobody knows.
**User benefit:** Users discover and use export capabilities they didn't know existed.

### 1.5 Document Deduplication
**Complexity:** Low (documentation only)
**Dependencies:** None.
**What to do:** Create user-facing documentation explaining multi-source deduplication: what it does, how fuzzy matching works, and how to configure priority modes.
**Why it matters:** Unique selling point for multi-platform users. No other tool handles cross-source dedup.
**User benefit:** Users understand and trust the cross-platform merging behavior.

---

## 2. Moat Builders

Unique differentiators that create deep competitive advantages and workflow dependency.

### 2.1 PROFITS Framework v2
**Complexity:** Medium
**Dependencies:** Current `fathom_calls` schema, `content-insight-miner` pattern.
**What to build:** Reimplementation of the 7-part sales psychology extraction framework (Pain, Results, Obstacles, Fears, Identity, Triggers, Success) against the current schema. Use the proven `content-insight-miner` Edge Function pattern. Add a dedicated UI for triggering extraction, reviewing results, and browsing PROFITS data across calls.
**Why it matters:** No other tool maps transcript data to a structured sales psychology framework. This is a founding competitive differentiator that bridges sales psychology and AI extraction.
**User benefit:** Users extract structured sales intelligence from every call -- not just summaries, but categorized psychological elements that inform sales strategy.
**Note:** Legacy code exists in `ai-agent.ts` but references a non-existent `calls` table. Full reimplementation required.

### 2.2 Folder-Level Chat
**Complexity:** Medium
**Dependencies:** `chat-stream` tool system (already supports multi-call queries), folder assignments.
**What to build:** "Chat with a folder" -- synthesize and query across all calls in a selected folder simultaneously. The AI receives the full context of every call in the folder and can answer macro-level questions.
**Why it matters:** Enables strategic intelligence across grouped conversations. "What are the top 3 objections across all my Q4 sales calls?" becomes a single question.
**User benefit:** Users ask strategic questions across client portfolios, project groups, or time periods without selecting individual calls.

### 2.3 Objection-to-Rebuttal Library
**Complexity:** High
**Dependencies:** Chunk metadata enrichment (intent_signals: objection), insights table.
**What to build:** Auto-extract objections from transcripts and link them to successful rebuttal patterns found in other calls. Build a browsable library where each objection is paired with the language that worked against it.
**Why it matters:** Unique "institutional knowledge" feature. Turns an organization's collective call history into a competitive intelligence playbook.
**User benefit:** Sales teams build a living playbook from their own conversations. New reps learn from what actually worked, not from theory.

### 2.4 Cross-Client Vocabulary Analysis
**Complexity:** High
**Dependencies:** Chunk metadata (entities, topics), business profiles.
**What to build:** Compare buyer language patterns across clients, industries, or time periods. Surface the exact adjectives, phrases, and frames that buyers use to describe their problems, desired outcomes, and objections. Dashboard with frequency, trends, and exportable word lists.
**Why it matters:** Turns CallVault into a market research tool, not just a recording manager. The "Voice of Customer" data that agencies charge $10k+ to produce is sitting in existing call recordings.
**User benefit:** Marketers discover the exact phrases their buyers use for ad copy, landing pages, and funnel optimization.
**Note:** Much of this is already achievable via the RAG chat (users can ask "what language do my buyers use?"), but a dedicated dashboard with trends and export would make it a first-class feature.

### 2.5 Client Health Alerts
**Complexity:** Medium
**Dependencies:** Sentiment analysis (production), automation-email (production).
**What to build:** Proactive alerts when sentiment drops X% over Y calls for a given client/tag/folder. Email notifications via Resend. Dashboard showing client sentiment trends over time.
**Why it matters:** Churn prevention for account managers. The infrastructure (sentiment + automation + email) already exists -- this is connecting the dots.
**User benefit:** Account managers catch at-risk clients before they churn, based on objective sentiment data across conversations.
**Note:** The automation engine has a scaffolded `update_client_health` action that references `clients` and `client_health_history` tables (which may not exist yet). Building those tables completes the circuit.

### 2.6 Real-Time Coaching v2
**Complexity:** Medium
**Dependencies:** PROFITS Framework v2, insights table, coaching portal.
**What to build:** Post-call analysis that compares a new call against patterns from past successful calls, providing improvement suggestions. "In your last call with this client, you missed the Identity element. Here's how you addressed it successfully in [other call]."
**Why it matters:** Moves coaching from subjective review to data-driven improvement suggestions.
**User benefit:** Coaches and self-coaching reps get specific, evidence-based improvement recommendations after every call.
**Note:** Legacy stub exists (`applyInsightsToCall` in `ai-agent.ts`) but is not connected to any UI or current pipeline. Full reimplementation required.

---

## 3. User Experience Improvements

Enhancements to existing capabilities that improve daily usability.

### 3.1 YouTube Import UI
**Complexity:** Medium
**Dependencies:** `youtube-api` Edge Function (already exists).
**What to build:** Setup wizard (matching the Fathom/Zoom/Google Meet pattern) and import flow for YouTube content. URL input, preview, and selective import.
**Why it matters:** The API backend exists. Users just need a way to reach it.
**User benefit:** Users import podcast episodes, webinar recordings, and video content alongside their call recordings.

### 3.2 Manual Upload
**Complexity:** High
**Dependencies:** Whisper or third-party transcription service, Supabase storage bucket.
**What to build:** Upload MP3/WAV/MP4 files. Automatic transcription. Integration into the standard call pipeline (embedding, tagging, organization).
**Why it matters:** Fills the "legacy import" gap. Users with years of recordings from before CallVault need a way to bring them in.
**User benefit:** Offline recordings, voice memos, and legacy files become part of the searchable knowledge base.

### 3.3 Dedicated Insights Browser
**Complexity:** Medium
**Dependencies:** `insights` + `quotes` tables (already populated by content-insight-miner).
**What to build:** Standalone page for browsing, filtering, searching, and managing extracted insights independent of the content generation wizard. Tag, star, and organize insights.
**Why it matters:** Insights currently only surface during content creation. Users want to review their extracted intelligence on its own.
**User benefit:** Users review and curate AI-extracted intelligence without starting a content generation workflow.

### 3.4 Speaker Management
**Complexity:** Medium
**Dependencies:** `speakers` + `call_speakers` tables (already exist).
**What to build:** Dedicated page for managing speaker identities: merge duplicates (same person across platforms), set internal/external status, add notes, browse all calls by speaker.
**Why it matters:** Speaker data exists and powers search, but names from different platforms may not match. "John Smith" on Fathom and "jsmith@company.com" on Zoom are the same person.
**User benefit:** Clean speaker directories for accurate filtering and attribution across all recording sources.

### 3.5 Workspace Management UI
**Complexity:** Medium
**Dependencies:** `workspaces`, `workspace_members`, `workspace_calls` tables (already exist in schema).
**What to build:** Frontend UI for creating, managing, and populating workspaces. Workspace-based views and permissions.
**Why it matters:** Schema exists with no frontend. Workspaces would provide project-based organization on top of folders.
**User benefit:** Teams organize calls into project-specific workspaces with dedicated membership.

### 3.6 Real Analytics Data
**Complexity:** Medium
**Dependencies:** `useCallAnalytics.ts` (ready), chart libraries (Tremor, Recharts already installed).
**What to build:** Connect the analytics data hook to the 6 analytics tab components with real data and proper visualizations.
**Why it matters:** Even after wiring the tab components (Quick Win 1.3), they'll need real data and charts. This is the "make analytics actually useful" step.
**User benefit:** Actionable insights about call patterns, participation trends, talk time ratios, and content creation metrics.

---

## 4. Enterprise Features

Required for upmarket sales and regulated industry adoption.

### 4.1 CRM Integration
**Complexity:** High
**Dependencies:** Automation engine, insights extraction.
**What to build:** Bidirectional sync with HubSpot and Salesforce. Push: insights, sentiment scores, PROFITS data, and call summaries to CRM records. Pull: contacts, deal stages, and account data for enriching CallVault's context.
**Why it matters:** Enterprise sales teams require CRM-connected tools. This is often the first question in enterprise evaluation.
**User benefit:** Sales data flows automatically between CallVault and CRM. No manual copy-paste of insights.

### 4.2 Privacy Redaction
**Complexity:** High
**Dependencies:** Pre-processing layer before `embed-chunks`.
**What to build:** Auto-strip PII (credit card numbers, SSNs, phone numbers, names on request) before AI processing and embedding. Configurable rules for what constitutes PII. Audit trail showing what was redacted.
**Why it matters:** Compliance requirement for healthcare, financial services, and regulated industries. Without this, entire verticals are off-limits.
**User benefit:** Organizations in regulated industries can use CallVault without exposing sensitive client data to AI processing.

### 4.3 SSO / SAML
**Complexity:** Medium
**Dependencies:** Supabase Auth (supports SAML natively).
**What to build:** Enterprise single sign-on via SAML 2.0. Integration with Okta, Azure AD, Google Workspace as identity providers.
**Why it matters:** Table stakes for enterprise procurement. IT teams won't approve tools without SSO.
**User benefit:** Enterprise IT teams deploy CallVault with their existing identity provider. No separate passwords.

### 4.4 Audit Logging
**Complexity:** Medium
**Dependencies:** New database table + middleware.
**What to build:** Comprehensive audit trail for all user actions: login, data access, export, sharing, configuration changes. Admin-viewable log with search and filtering.
**Why it matters:** Compliance requirement for SOC 2, HIPAA, and enterprise security reviews.
**User benefit:** Administrators can review all system activity for compliance and security purposes.

### 4.5 Advanced RBAC
**Complexity:** Medium
**Dependencies:** Current role system (FREE/PRO/TEAM/ADMIN).
**What to build:** More granular permissions beyond the 4-tier system. Feature-level toggles, folder-level access controls, and custom role definitions.
**Why it matters:** Large organizations need more nuanced access control than "Admin or Member."
**User benefit:** Organization admins can tailor exactly what each team member can see and do.

---

## 5. AI & Automation Enhancements

Extending the intelligence and automation layer.

### 5.1 Slack Notification Action
**Complexity:** Low
**Dependencies:** Slack webhook URL configuration in settings.
**What to build:** Replace the stubbed `slack_notification` action in the automation engine with actual Slack webhook delivery. Add UI for configuring Slack webhook URLs.
**Why it matters:** Most teams use Slack. Automation rules that can't notify via Slack are incomplete.
**User benefit:** Automation rules trigger real Slack notifications ("New call tagged At Risk" posts to #sales-alerts).

### 5.2 Complete Cost Tracking
**Complexity:** Low
**Dependencies:** Usage tracker infrastructure (exists).
**What to build:** Extend `usage-tracker.ts` to cover all OpenRouter model prices (Gemini Flash, Claude Haiku, Claude Sonnet, etc.), not just the 2 currently tracked models.
**Why it matters:** Users need accurate cost visibility across all AI operations.
**User benefit:** Complete, accurate AI cost reporting for budget management.

### 5.3 Visual Agent Builder
**Complexity:** High
**Dependencies:** ReactFlow (ADR-003 approved), agent system architecture.
**What to build:** A ReactFlow canvas where users design custom AI workflows by connecting nodes: trigger -> filter -> extract -> transform -> output. Non-technical users create personalized AI processing pipelines.
**Why it matters:** Democratizes AI pipeline creation. Major long-term differentiator.
**User benefit:** Non-technical users create custom AI agents that run automatically against their call library.

### 5.4 Batch PROFITS Extraction
**Complexity:** Medium
**Dependencies:** PROFITS Framework v2 (see Moat Builder 2.1).
**What to build:** Run PROFITS extraction across multiple calls in bulk -- entire folders, tag groups, or date ranges.
**Why it matters:** Individual call extraction is useful; bulk extraction across hundreds of calls is transformative.
**User benefit:** Users extract sales intelligence from their entire call history overnight.

### 5.5 Custom AI Agents
**Complexity:** High
**Dependencies:** Agent infrastructure, chat-stream.
**What to build:** User-defined agent prompts that run against their transcript library. Users define what to extract, how to format it, and when to run it.
**Why it matters:** Every user has unique extraction needs. One-size-fits-all agents don't capture the diversity of coaching methodologies and sales frameworks.
**User benefit:** Users create personalized AI agents tailored to their specific workflow and methodology.

### 5.6 Automated Content Scheduling
**Complexity:** Medium
**Dependencies:** Automation scheduler (production), content wizard pipeline (production).
**What to build:** Schedule content generation to run automatically (weekly hooks from new calls, daily digests, monthly content roundups).
**Why it matters:** Removes the manual trigger requirement. Content generation becomes a background process.
**User benefit:** Fresh content appears in the content library automatically without user intervention.

### 5.7 Multi-Call Synthesis Reports
**Complexity:** Medium
**Dependencies:** Chat tools, export system.
**What to build:** Select N calls and generate a synthesized report: common themes, divergent points, trend analysis, key quotes, and action items across all selected calls.
**Why it matters:** Cross-call intelligence is a key value proposition. Currently achievable via chat but not as a structured, exportable report.
**User benefit:** Users get strategic summaries spanning multiple conversations in a polished, shareable format.

---

## 6. Business Model & Monetization

Revenue expansion beyond core SaaS subscriptions. See `pricing-draft.md` for detailed pricing.

### 6.1 Custom GPT Coach (High-Ticket Upsell)
**Complexity:** Medium-High
**Pricing:** $5,000-$10,000 one-time setup + $500-$1,500/month recurring
**Eligibility:** Business or Enterprise plan only
**What to build:** Bespoke AI agents built for specific coaching programs or sales teams. You (the founder) take the client's scripts, objection handling frameworks, scorecards, and methodology and build a custom agent that:
- Auto-scores calls against their specific methodology and rubric
- Tags key moments and flags misses
- Generates per-call scores and notes
- Optionally produces per-student/rep progress reports
**Why it matters:** This is the "Call Scoring Rubric" capability -- but delivered as a high-touch, high-ticket service rather than a self-serve feature. Each custom agent becomes deeply embedded in the client's workflow, creating massive switching costs.
**Revenue model:** Recurring revenue tied to student count and call volume. See `pricing-draft.md` Section 4.

### 6.2 White-Label Platform
**Complexity:** High
**Eligibility:** Programs/agencies with 50+ active CallVault end users
**What to build:** Custom branding, custom domain, and optional minor UI tweaks for agencies and coaching programs that want to offer CallVault under their own brand. Infrastructure stays under your management.
**Pricing models (choose one):**
- Per-seat: $15-$20/user/month with 50-seat minimum
- Flat platform fee: $2,000-$5,000/month up to agreed user cap + overage
**Why it matters:** Opens a B2B2C distribution channel. Coaches and agencies become resellers without you giving up infrastructure control.
**Note:** This is the "Reseller/Sub-Account" concept that minimax incorrectly identified as a missing feature. It's a business model play, not a platform feature gap. See `pricing-draft.md` Section 5.

### 6.3 Coach Partner / Affiliate Program
**Complexity:** Medium
**What to build:** Referral system where coaches get their own partner link. Students who sign up via the link get an extended trial or discount. Coaches earn:
- 30% recurring commission on referred users for 12 months
- Upgrades to 40% after 20 active paid referrals
- "Coach Pro" feature unlock at 3+ active paid referrals (full coaching dashboard, cross-student search, default sharing rules)
**What needs building:**
- `partner_id` tracking on user/subscription
- Partner dashboard (referral count, commission estimates, payout history)
- Coach Pro feature gating
**Why it matters:** Coaches become a distribution channel. Their incentive alignment (more students on CallVault = more revenue for them) drives organic growth.
**See:** `pricing-draft.md` Section 3.

### 6.4 Tiered Pricing Implementation
**Complexity:** Medium
**What to build:** Billing system implementing the 5-tier pricing structure:
- Free (1 user, capped usage, no teams/coaching)
- Solo ($29/mo, unlimited calls, 1 coach + 1 coachee)
- Team ($99/mo, 5 seats, team hierarchy, 2 coaches + 3 coachees)
- Business ($249/mo, 20 seats, advanced admin/analytics)
- Enterprise (custom, $1,500+/mo, SSO, SLA, dedicated CSM)
**Dependencies:** `BillingTab.tsx` (scaffolded), role-based feature gating (production).
**Note:** The RBAC system (FREE/PRO/TEAM/ADMIN tiers) and feature gating hooks already exist. Billing integration (Stripe or equivalent) is the missing piece.
**See:** `pricing-draft.md` Section 1.

---

## Priority Matrix

A visual summary of where items fall on the effort/impact grid.

### Do First (Low Effort, High Impact)
- Route orphaned pages (1.1, 1.2)
- Wire analytics components (1.3)
- Document export system (1.4)
- Document deduplication (1.5)
- Slack notification action (5.1)
- Complete cost tracking (5.2)

### Do Next (Medium Effort, High Impact)
- PROFITS Framework v2 (2.1)
- Folder-Level Chat (2.2)
- Client Health Alerts (2.5)
- YouTube Import UI (3.1)
- Real Analytics Data (3.6)
- Automated Content Scheduling (5.6)
- Coach Partner Program (6.3)

### Plan For (High Effort, High Impact)
- Cross-Client Vocabulary Analysis (2.4)
- Objection-to-Rebuttal Library (2.3)
- CRM Integration (4.1)
- Manual Upload (3.2)
- Visual Agent Builder (5.3)
- Custom GPT Coach (6.1)
- Tiered Pricing (6.4)

### Strategic Bets (High Effort, Long-Term)
- White-Label Platform (6.2)
- Privacy Redaction (4.2)
- SSO/SAML (4.3)
- Custom AI Agents (5.5)
- Advanced RBAC (4.5)

---

## Changelog

| Date | Change |
|------|--------|
| 2026-01-26 | v1.0 -- Initial roadmap created from audit findings, pricing draft, and stakeholder input. |
