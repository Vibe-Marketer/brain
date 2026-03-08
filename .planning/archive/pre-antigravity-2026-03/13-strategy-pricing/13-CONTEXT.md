# Phase 13: Strategy + Pricing - Context

**Gathered:** 2026-02-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Lock product identity, AI strategy, and pricing model before a single line of code is written. This phase produces written artifacts only — no code, no commits, no repo. Outputs: AI strategy document (STRAT-01), product identity document (STRAT-03), pricing tier spec (STRAT-02, BILL-01, BILL-03, BILL-04), and Polar billing dashboard update (BILL-02).

</domain>

<decisions>
## Implementation Decisions

### AI Positioning
- **MCP-first with lightweight bridge chat.** CallVault stores and organizes calls, then hands them to whatever AI the user already uses (Claude, ChatGPT, Gemini, etc.). The only in-app AI is a lightweight bridge chat for quick questions.
- **"AI-ready, not AI-powered."** No "AI-powered" claims anywhere. The framing is: "Your calls, ready for any AI." CallVault is the operating system, not the brain.
- **Lead with outcome, MCP underneath.** Hero messaging leads with benefits ("Ask AI about any call, instantly"). MCP is the mechanism explained one layer down in "How it works" / features sections. Dev/integrations page can lead with "MCP-native call workspace."
- **Smart enrichment = "Smart Import" (named feature).** Auto-title, action items, tags at import time is a visible, named feature — not hidden background magic. No "AI" label on it. "Auto-generated — edit anytime" labels in-product. Framing: "Calls arrive pre-organized."

### Pricing Structure
- **Three tiers: Free + Pro + Team.**
  - Free = attraction offer (get people in, get data in, prove value)
  - Pro = core continuity offer (serious solo users pay monthly)
  - Team = upsell (collaboration, permissions, multi-seat, higher ARPU)
  - No Enterprise tier yet — sell "Team on enterprise terms" if someone asks
- **Freemium + trial hybrid model.**
  - Free tier is permanent (free forever with limits)
  - 14-day Pro trial is opt-in, triggered when user hits a premium feature (MCP, second workspace, invite teammate)
  - After trial: drop back to Free automatically, keep all data, premium features become read-only
- **Three limit knobs on Free:**
  - Imports per month (~10 calls/month)
  - Workspaces (1 organization, 1 workspace)
  - MCP / AI connectivity (none or tiny demo cap on Free)
- **MCP on Pro + Team** (MCP is the paywall between Free and paid, NOT the wall between Pro and Team)
  - Pro: full personal MCP access for their workspace
  - Team: per-workspace MCP tokens + shared configs
- **Team differentiator: collaboration + admin controls**
  - Pro = "Me + My AI + My calls" (solo power user)
  - Team = "Our org runs on this" (qualitatively different powers)
  - Team adds: multiple workspaces, shared folders/views, roles/permissions, invite flows, admin dashboard, consolidated billing, usage overview
  - Higher limits are supporting, not the headline

### Product Identity
- **Primary buyer persona: B2B sales teams / RevOps.** Specifically: Heads of Sales / RevOps at B2B companies with 5–50 reps doing Zoom sales calls. Coaches/consultants are tactical (early adopters, testimonials, referral channels into sales teams), not strategic.
- **Messaging hierarchy:**
  - Hook (benefit): "Close more deals from the calls you're already having."
  - Category (positioning): "The operating system for your sales calls."
  - Mechanism (how): captures, organizes, shares, connects to whatever AI you already use.
- **Competitive positioning: different category, not diet Gong.**
  - Gong/Chorus = conversation intelligence apps (their AI, their analytics, their UI)
  - CallVault = call data + workspace layer (organized, permissioned library that plugs into any AI)
  - "Gong is the coach. CallVault is the film room and wiring."
  - Never frame as "Gong without AI lock-in" or "Gong for Claude users" — those keep you in their category
- **Five-point anti-identity (what CallVault is NOT):**
  1. Not a recorder or transcription tool — calls are imported from tools you already use
  2. Not an AI assistant or coach — we don't replace Claude/ChatGPT/Gemini
  3. Not an analytics / intelligence platform — no pipeline forecasting, dashboards, scorecards
  4. Not a CRM or system-of-record for deals — we're the call layer, not the account database
  5. Not "AI-powered everything" — we're AI-ready, not AI-powered

### Upgrade Experience
- **Soft gate at limit hits:** action is blocked, but tone is educational, not punitive. Three behaviors: (1) explain exactly why they're blocked, (2) show a preview of what upgrading unlocks for this specific context, (3) one obvious CTA + "Maybe later" secondary.
- **In-context prompts + settings plan page.** Upgrade prompts appear only where the limit is hit (never random, never global banners). Settings has a persistent "Your Plan" section with usage bars and upgrade path. No global sidebar indicator yet.
- **14-day trial is opt-in, triggered at moment of intent.** When free user tries a Pro feature → gate modal: "This is a Pro feature. Start your 14-day free trial?" User chooses when to burn the trial window. Toast confirms: "You're on Pro until [date]."
- **Post-trial downgrade: keep data, read-only on premium.**
  - Nothing disappears. All data stays.
  - User picks 1 "active" workspace to keep fully editable; rest become read-only (viewable, searchable, but can't add/edit)
  - MCP configs stay visible but calls are blocked
  - Existing calls untouched; new imports hit free-tier cap
  - Clear messaging: "Your trial ended. Your data is safe. Upgrade to keep going."

### Claude's Discretion
- Exact import count limit for Free (user said ~10, final number can be adjusted)
- Specific price points for Pro and Team tiers
- Billing interval options (monthly/annual) and annual discount percentage
- Trial countdown UI design
- Exact wording of upgrade modals and soft-gate copy
- Structure and format of the AI strategy document and product identity document
- How to present the three-tier comparison on a pricing page

</decisions>

<specifics>
## Specific Ideas

- Hero messaging: "Ask AI about any call, instantly. CallVault organizes your calls and makes them available to whatever AI you already use. No more copy-paste. Just ask."
- Category line: "CallVault is the operating system for your sales calls."
- Subtext under hero: "Works with Claude, ChatGPT, Gemini, Perplexity and more."
- MCP explanation (features section): "Under the hood, CallVault exposes your calls through the Model Context Protocol (MCP), the open standard used by Claude, ChatGPT, Gemini, and others to connect to tools and data sources."
- Smart Import copy: "CallVault auto-generates a clear title, suggested action items, and starter tags for every new call."
- In-product enrichment labels: "Auto-generated — edit anytime"
- Competitive contrast: "Gong is the coach. CallVault is the film room and wiring."
- Free tier copy: "Up to 10 calls/month. 1 workspace. Core organization + smart import. Upgrade for: more calls, multiple workspaces, and AI integrations."
- Trial end messaging: "Your 14-day Pro trial has ended. Your data is safe. You're now on the Free plan: 1 editable workspace, 10 calls/month, no AI integrations. Upgrade to Pro to keep all workspaces editable and continue using MCP."
- User referenced $100M Money Models (Attraction Offers, value stacking) as strategic framework for pricing decisions

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 13-strategy-pricing*
*Context gathered: 2026-02-27*
