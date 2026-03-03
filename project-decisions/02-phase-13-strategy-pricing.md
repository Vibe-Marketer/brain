# Phase 13: Strategy + Pricing

**Type:** Documentation only — no code commits to callvault repo

**Goal:** Lock all product strategy, pricing, and AI decisions in written documents before any v2 code is written.

---

## Why This Phase Exists

The project has accumulated strategic drift. Old plans use different tier names (Free/Pro/Business), a different primary persona, and a different AI strategy (RAG pipeline, embeddings, vector search). Phase 13 clears all of that and locks the correct strategy before a single line of v2 code is written.

---

## Plan 01 — Lock AI Strategy + Product Identity

### AI-STRATEGY.md

Write a definitive AI strategy document that answers:

- [ ] Define CallVault's relationship with AI — it's a data layer, not an AI product
- [ ] Declare MCP-first positioning: users bring their own AI, CallVault organizes the data
- [ ] Bridge chat is optional and minimal — not the core product story
- [ ] Lock the marketing angle: "Your calls, organized. Your AI, connected."
- [ ] Set the tagline: "AI-ready, not AI-powered"
- [ ] Explicitly list everything DROPPED from v1: RAG pipeline, embeddings, vector search, Content Hub, Langfuse, semantic search, AI-powered automation
- [ ] Explicitly list what's KEPT: Smart Import (auto-title, action items, tags, sentiment) — runs once at import, named feature, no AI label
- [ ] Establish hard dev constraint AI-02: zero RAG/embedding code in v2 repo, ever
- [ ] Ensure "AI-powered" never appears in user-facing copy — only in developer JSDoc if needed

### PRODUCT-IDENTITY.md

Write a product identity document (~600 words, ~2.5 min read) that locks:

- [ ] Primary buyer: Heads of Sales / RevOps at B2B companies with 5-50 reps
- [ ] Secondary buyers: Solo coaches running 15-20 client calls/week, recruiters doing 30+ screens/month, CSMs tracking ongoing conversations
- [ ] One-liner: "Close more deals from the calls you're already having."
- [ ] Category: "The operating system for your sales calls."
- [ ] Competitive framing: "Gong is the coach. CallVault is the film room and wiring."
- [ ] Define 5 hard anti-identities: not a recorder, not an AI coach, not analytics platform, not a CRM, not "AI-powered everything"
- [ ] Specific customer framing: "Stop losing call context. CallVault organizes your recordings so your AI actually knows what happened."

---

## Plan 02 — Lock Pricing Tiers + Upgrade Prompts

### PRICING-TIERS.md

Write a comprehensive pricing document that defines:

- [ ] Research competitive pricing — Gong at $160-250/user/month + $5K-50K/yr platform fee; position CallVault Team at $79/mo flat ($948/yr) as 20-30x cheaper
- [ ] Define Free tier: $0, 10 imports/month, 1 org, 1 workspace, no MCP access
- [ ] Define Pro tier: $29/month ($23/mo annual = "2 months free"), unlimited imports, multiple workspaces, personal MCP
- [ ] Define Team tier: $79/month flat — not per-seat ($63/mo annual), shared workspaces, roles, per-workspace MCP tokens, admin dashboard
- [ ] Set annual discount at 20%, always framed as "2 months free" (never "20% off")
- [ ] Define price evolution strategy: raise to $39/$99 after first 10 Pro + 5 Team paying customers
- [ ] Identify the primary gate: MCP access (not AI queries, not storage, not transcripts)
- [ ] Design free tier to feel useful for 2-3 weeks then naturally hit limits
- [ ] Define paid unlock triggers: 4th workspace needed, 60+ calls/month, automation needs, full MCP CRUD
- [ ] List never-gated features: Smart Import, keyword search, unlimited folders, call detail, export, public sharing, data retention (forever)

### UPGRADE-PROMPTS.md

Write an upgrade prompt specification covering:

- [ ] Define the three-behavior pattern: (1) explain the block, (2) show what unlocks, (3) one CTA + "Maybe later" dismiss
- [ ] Design the `UpgradeGate` component interface — wraps any gated feature, accepts `feature`, `requiredTier`, `onUnlocked` props
- [ ] Write copy constants for `src/constants/upgrade-copy.ts` — one entry per gated feature
- [ ] Cover all 6 upgrade scenarios: workspace creation limit, import volume limit, MCP access attempt, advanced connector, team invite, admin feature
- [ ] Establish rule: frontend gate is UX only — backend must independently enforce all limits

---

## Plan 03 — Create Polar Products

### Research Polar Constraints

- [ ] Verify: billing interval (monthly/annual) is immutable once a product is created
- [ ] Verify: annual billing requires a separate Polar product entirely
- [ ] Verify: names and descriptions can be edited post-creation but products cannot be deleted, only archived
- [ ] Confirm current subscriber count (if 0, do a clean setup; if >0, need a migration path)

### Create Products in Polar Dashboard

- [ ] Create Pro Monthly product with correct pricing ($29/mo)
- [ ] Create Pro Annual product with correct pricing ($278/yr)
- [ ] Create Team Monthly product with correct pricing ($79/mo)
- [ ] Create Team Annual product with correct pricing ($758/yr)
- [ ] Record all 4 Polar product IDs in a POLAR-UPDATE-LOG.md
- [ ] Update `src/constants/billing.ts` with the product IDs

---

## Key Decision: Value Anchor

Define explicitly what customers pay for vs. what's table stakes:

**Customers pay for:**
- [ ] Workspace count (free = 1, paid = unlimited)
- [ ] Import volume (free = 10/mo, paid = unlimited)
- [ ] MCP connector access (free = none, paid = personal/workspace MCP)
- [ ] Advanced connectors (YouTube, Zoom — paid only)

**NOT priced on (table stakes):**
- [ ] AI queries
- [ ] Transcripts
- [ ] Storage
