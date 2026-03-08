# Phase 13: Strategy + Pricing - Research

**Researched:** 2026-02-27
**Domain:** SaaS Strategy, Pricing, Product Identity, Polar Billing
**Confidence:** HIGH (decisions already made; research validates and fills discretion gaps)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### AI Positioning
- **MCP-first with lightweight bridge chat.** CallVault stores and organizes calls, then hands them to whatever AI the user already uses (Claude, ChatGPT, Gemini, etc.). The only in-app AI is a lightweight bridge chat for quick questions.
- **"AI-ready, not AI-powered."** No "AI-powered" claims anywhere. The framing is: "Your calls, ready for any AI." CallVault is the operating system, not the brain.
- **Lead with outcome, MCP underneath.** Hero messaging leads with benefits ("Ask AI about any call, instantly"). MCP is the mechanism explained one layer down in "How it works" / features sections. Dev/integrations page can lead with "MCP-native call workspace."
- **Smart enrichment = "Smart Import" (named feature).** Auto-title, action items, tags at import time is a visible, named feature — not hidden background magic. No "AI" label on it. "Auto-generated — edit anytime" labels in-product. Framing: "Calls arrive pre-organized."

#### Pricing Structure
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

#### Product Identity
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

#### Upgrade Experience
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

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

---

## Summary

Phase 13 is a documentation-only phase: no code, no commits to the app repo, no new infrastructure. The outputs are four written documents that serve as authoritative references for all v2 development that follows. Every decision is already locked in CONTEXT.md — the research job is to validate those decisions against market reality, fill in the discretion gaps with confident recommendations, and give the planner precise inputs for each document.

**Critical alert for the planner:** Three existing PLAN files (13-01-PLAN.md, 13-02-PLAN.md, 13-03-PLAN.md) exist in the phase directory but were written BEFORE the CONTEXT.md discussion. They reflect an earlier version of the decisions (different persona, different tier names Free/Pro/Business vs Free/Pro/Team, different free tier limits 3 workspaces/50 imports vs 1 workspace/~10 imports). These plans must be treated as SUPERSEDED and rewritten to match CONTEXT.md decisions verbatim. Do not inherit any limit or tier name from the old plans without verifying against CONTEXT.md.

The competitive landscape confirms the positioning is correct. Gong costs approximately $160–$250/user/month plus platform fees of $5K–$50K/year — CallVault at a flat monthly rate sits in an entirely different category and price band. The "film room vs coach" differentiation is genuinely distinct from competitors and does not need to be defended against alternative framings.

**Primary recommendation:** Write all four documents with the confidence the user has already shown in the CONTEXT.md. No hedging, no alternatives listed, no "you could also." The decisions are made — these documents lock them in writing.

---

## Standard Stack

This phase produces markdown documents, not code. The "stack" is the document framework and the one external system that must be updated.

### Core

| Tool | Version | Purpose | Why Standard |
|------|---------|---------|--------------|
| Polar Dashboard | Current | Update billing tier names/descriptions (BILL-02) | Existing billing provider; products updatable in-place |
| Markdown | N/A | All output documents | Phase boundary explicitly: "written artifacts only, no code" |

### Polar Billing — What We Know (HIGH confidence)

From official Polar documentation:

- Products cannot be deleted, but CAN be archived (existing subscribers keep access; new purchases disabled)
- Product name and description CAN be edited after creation
- Billing cycle (monthly/annual), pricing type, and recurring interval CANNOT be changed after creation
- Billing intervals supported: daily, weekly, monthly, yearly, custom (e.g., every 3 months)
- Free trial periods: configurable by enabling toggle, then setting duration in days/weeks/months/years
- Annual billing is implemented as a SEPARATE product (not a toggle on the same product) — so "Pro Monthly" and "Pro Annual" are two distinct Polar products
- Price changes for fixed-price products apply only to NEW purchases — existing subscribers keep original pricing
- The current v1 Polar products are: Solo, Team, Business (from PROJECT.md: "Polar 3-tier billing (Solo/Team/Business)")

**Implication for BILL-02 (Polar update):** v2 needs Pro + Team tiers (not Solo/Team/Business). Since billing cycle cannot be changed, existing Solo/Team/Business products can have their NAMES and DESCRIPTIONS updated in-place. If price points need to change significantly, the cleanest path is archiving old products and creating new ones — but existing subscribers must be manually migrated. This is a user decision point that must be surfaced in the Polar update plan.

### Polar Trial Mechanics (HIGH confidence)

Polar natively supports trial periods on recurring products. The opt-in trial design (user chooses when to start the 14-day window) maps to Polar's trial configuration. However, Polar's built-in trial applies at subscription creation — the "opt-in at moment of intent" UX described in CONTEXT.md is a frontend UX pattern, not a Polar feature. The backend call to start the trial still goes through Polar's standard checkout/subscription flow; the UX layer is what makes it feel opt-in.

---

## Architecture Patterns

This phase produces four written documents. Each document has a clear job:

### Document 1: AI Strategy (STRAT-01)
**File:** `.planning/phases/13-strategy-pricing/AI-STRATEGY.md`
**Job:** Answer "what kind of AI product are we?" definitively. Will be referenced by every future phase.
**Structure (recommended):**
1. Executive Summary (3-4 sentences — the answer)
2. The Decision (MCP-first, what this means in concrete terms)
3. What We Keep / What We Drop / What Is Optional Later
4. Marketing Angle (how to talk about AI without lying)
5. What This Means for Development (no RAG, no embeddings, no vectors)
6. Confidence Statement (this is not a comparison — this IS the decision)

**Tone:** Confident, direct. No "on the other hand." No "this has tradeoffs."
**Length:** 1-2 pages, readable in under 3 minutes.

### Document 2: Pricing Tiers Spec (STRAT-02, BILL-01, BILL-03)
**File:** `.planning/phases/13-strategy-pricing/PRICING-TIERS.md`
**Job:** Lock every limit number and tier boundary for Free/Pro/Team before any code is written.
**Structure (recommended):**
1. Pricing Philosophy (what we charge for and why)
2. Tier Comparison Table (feature matrix with numeric limits)
3. Free Tier Deep Dive with rationale per limit
4. Upgrade Triggers (what causes conversions)
5. What's Never Gated (table stakes at all tiers)
6. Pricing with monthly/annual rates
7. Polar Configuration Notes (for the update task)

### Document 3: Upgrade Prompts Design (BILL-04)
**File:** `.planning/phases/13-strategy-pricing/UPGRADE-PROMPTS.md`
**Job:** Design the copy and behavior for every in-context upgrade prompt. Developers implement this in Phase 14+.
**Structure (recommended):**
1. Design Philosophy
2. Prompt designs per limit type (trigger, placement, headline, body, CTA, dismiss)
3. Trial opt-in modal design
4. Post-trial downgrade messaging
5. Implementation notes for developers

### Document 4: Product Identity (STRAT-03)
**File:** `.planning/phases/13-strategy-pricing/PRODUCT-IDENTITY.md`
**Job:** One-page reference any team member reads in under 2 minutes to know what CallVault is, who it's for, and what it is not.
**Structure (recommended):**
1. What CallVault Is (2-3 sentences)
2. Who It's For (specific personas with qualifying signals)
3. Who It's NOT For (explicit exclusions)
4. What Makes Us Different (3 bullets max)
5. What We Are NOT (five-point anti-identity)
6. The One-Liner
7. Messaging Hierarchy (hook / category / mechanism)

### Anti-Patterns to Avoid

- **Hedging language in strategy docs:** Phrases like "both have tradeoffs," "you could also consider," or "it depends" undermine the purpose of locking decisions. Every sentence should be a statement, not a suggestion.
- **Copying old PLAN file content:** The 13-01, 13-02, 13-03 PLAN files contain an older persona (solo rep/coach) and different tier structure (Free/Pro/Business). Do NOT inherit those numbers or persona descriptions — use CONTEXT.md as the single source of truth.
- **Importing v1 tier language into v2 docs:** Current v1 Polar products say "Solo/Team/Business" and likely contain "AI-powered" language. v2 documents must purge all of this.
- **Enterprise framing:** CONTEXT.md explicitly defers Enterprise. Documents should not mention enterprise or hint at enterprise pricing.

---

## Don't Hand-Roll

This is a documentation phase — there is no software to build. However, there are two categories of things that should not be invented from scratch:

| Problem | Don't Invent | Use Instead | Why |
|---------|-------------|-------------|-----|
| Pricing tier presentation on pricing page | Custom table layout with no precedent | Standard Good/Better/Best three-column with center column highlighted as "Most Popular" | Industry-validated pattern; users scan left-to-right and anchor on the middle tier |
| Annual discount percentage | Arbitrary number | 20% annual discount (maps to ~2 months free) — the industry standard range is 15-25%, 20% is the most common anchor | Verified by multiple SaaS pricing research sources |
| Free tier import limit | Arbitrary number based on gut | 10 imports/month (exactly what user said; validates against "enough to prove value, not enough to solve the whole problem") | User validated; maps to ~2-3 weeks of a low-volume user |
| Trial length | Arbitrary | 14 days (user confirmed; aligns with industry norm for opt-in trials — 7-14 days is optimal for tools with quick time-to-value) | Research-validated for self-serve products |
| Soft gate copy pattern | Custom copywriting from scratch | The three-behavior pattern is the established PLG pattern: (1) explain the block, (2) show the unlock, (3) one CTA + dismiss | Validated by freemium conversion research: context-aware prompts outperform generic upgrade messages by up to 350% |

**Key insight:** The user has already made the hard decisions. The documents exist to record those decisions precisely and legibly, not to re-derive them.

---

## Common Pitfalls

### Pitfall 1: Persona Drift from Old Plans
**What goes wrong:** The existing 13-01-PLAN.md describes the target customer as "Solo sales rep / coach with 10-50 calls/week" and "Solo coach with 15-20 client sessions/week." CONTEXT.md describes the primary buyer as "Heads of Sales / RevOps at B2B companies with 5-50 reps." These are different people. The documents must use the CONTEXT.md persona.
**Why it happens:** Old plan files exist in the directory and are easy to copy-paste from.
**How to avoid:** Use CONTEXT.md decisions section as the ONLY source for persona definition. Old plans are superseded.
**Warning signs:** Product identity doc mentions "coach" as a primary persona, or describes the hook as "Stop losing call context" (the old one-liner).

### Pitfall 2: Tier Name Confusion (Pro/Team vs Pro/Business)
**What goes wrong:** Old plan files use "Free/Pro/Business." CONTEXT.md locks "Free/Pro/Team." Mixing these creates inconsistency across documents that will be referenced for months.
**Why it happens:** Old plans are in the same directory.
**How to avoid:** Every tier reference in every document must read "Free," "Pro," or "Team" — never "Business" or "Solo."
**Warning signs:** Any document mentioning "Business tier" or "Solo tier."

### Pitfall 3: Polar Archive vs Update Decision Not Made
**What goes wrong:** Current v1 Polar has Solo/Team/Business. v2 needs Free/Pro/Team (Pro replaces Solo, Team replaces... Team but with different limits, Business is retired). If existing subscribers are on the "Business" product and it gets archived, they need migration. If it gets renamed "Team," price confusion occurs if the price changes.
**Why it happens:** Polar cannot change billing intervals or pricing type after product creation. Name/description CAN be changed. But pricing can only be changed for new subscribers.
**How to avoid:** The Polar update plan (BILL-02) must explicitly document: (a) what happens to existing Business subscribers, (b) whether to rename in-place or archive + create new, (c) who makes that call (user, not AI).
**Warning signs:** Polar update doc that doesn't mention existing subscriber transition.

### Pitfall 4: Trial Mechanics Not Separated from Polar Mechanics
**What goes wrong:** Describing the opt-in trial as if Polar handles the "opt-in at moment of intent" natively. It doesn't — that's a frontend UX pattern. Polar handles the actual trial period once the subscription is initiated.
**Why it happens:** Conflating UX design with billing system capabilities.
**How to avoid:** UPGRADE-PROMPTS.md must clearly distinguish: (1) the UX layer that presents the choice, (2) the Polar subscription creation that starts the trial clock.
**Warning signs:** Upgrade prompts doc that says "Polar triggers the trial when the user hits the limit."

### Pitfall 5: Free Tier Being Too Generous or Too Stingy
**What goes wrong:** Free tier limits that are set wrong will either prevent conversion (too generous — users never hit limits) or prevent adoption (too stingy — users can't see value).
**Why it happens:** Limits are set without reference to actual user behavior.
**How to avoid:** The "~10 imports/month" and "1 workspace" from CONTEXT.md map directly to the $100M Offers "attraction offer" framework the user referenced: enough value to get people in and prove the product works, limited enough that the upgrade is obvious. Document the rationale for each limit explicitly.
**Warning signs:** Free tier that gives multiple workspaces, or more than 15 imports/month.

### Pitfall 6: Anti-Identity Buried Instead of Prominent
**What goes wrong:** The five-point anti-identity gets one mention in a "what we are not" section at the bottom of the product identity doc. In a competitive market where customers will default to "another Gong alternative?", the anti-identity is as important as the identity.
**Why it happens:** Standard product docs lead with positives.
**How to avoid:** Anti-identity should be prominent in the product identity doc — not an afterthought. The positioning depends on it: "different category, not diet Gong" only works if the document clearly says what we are not.
**Warning signs:** Product identity doc that leads with features and buries "what we're not" at the end.

---

## Recommendations for Discretion Areas

These are the areas where Claude has discretion per CONTEXT.md.

### Free Tier Import Limit
**Recommendation: 10 imports/month.**
Rationale: User said ~10. 10 is a clean round number. For a sales rep doing 15-30 calls/week, 10/month is 2-3 days of work — enough to set up the product and see value, not enough to solve their problem. This creates natural upgrade pressure within the first month of use.

### Price Points
**Recommendation: Pro at $29/month, Team at $79/month.**
Rationale:
- Pro at $29/month is a well-established price point for solo professional tools (matches the old Solo tier, so v1 subscribers see no increase). At $29, the ROI math is trivial for someone closing B2B sales deals.
- Team at $79/month flat rate (not per seat) is positioned as a team tool with a flat fee that's easy to justify to a manager. Per-seat pricing at this stage would require more approval cycles and complicate the "Team on enterprise terms" path.
- At $79/month flat for Team, a 5-rep team pays ~$16/rep/month — trivially cheaper than Gong ($160-250/user/month) and a simple comparison to make.

### Annual Billing
**Recommendation: Monthly and annual both available. Annual = 20% discount (2 months free).**
Rationale: Industry standard is 15-25% annual discount. 20% is the most-cited benchmark in SaaS pricing research. The "2 months free" framing is more compelling than "20% off" — use the former in copy.

In Polar terms: Create separate products for "Pro Monthly" ($29/month), "Pro Annual" ($278/year — equivalent to $23.17/month, round to $23/month displayed), "Team Monthly" ($79/month), "Team Annual" ($758/year — equivalent to $63.17/month, round to $63/month displayed). Use Polar's tab/toggle presentation at checkout.

### Pricing Page Presentation
**Recommendation: Standard three-column layout, Pro highlighted as "Most Popular."**
- Left column: Free (the attraction offer)
- Center column: Pro — highlighted with "Most Popular" badge, slightly elevated or contrasted
- Right column: Team
- Toggle at top: Monthly / Annual (show annual as default, monthly as option)
- Feature comparison table below the tier cards
- FAQ section below the table addressing: "Is my data safe if I downgrade?" and "What happens after my trial?"

### Upgrade Modal / Soft-Gate Copy
**Recommended pattern for all upgrade prompts:**
```
[Context-specific headline: "You've reached your 10-call limit this month"]
[What it means: "Free plan includes 10 imports per month."]
[What upgrade unlocks: "Pro gives you unlimited imports + MCP access."]
[CTA: "Start free trial" (if trial not used) | "Upgrade to Pro" (if trial used)]
[Secondary: "Maybe later"]
```

### AI Strategy Document Format
**Recommendation:** Structure as a decisional brief, not a comparison. Open with the answer, then justify. Close with a "Decision Confidence" statement that explicitly says this is final.

### Product Identity Document Format
**Recommendation:** Follow the positioning statement framework:
- For [primary buyer persona] who [the pain], CallVault is [the category] that [the key benefit].
- Then expand into the one-page with the six sections described in Architecture Patterns above.

---

## Code Examples

This phase produces no code. The "examples" are document structure templates.

### Tier Comparison Table Template

```markdown
| Feature | Free | Pro | Team |
|---------|------|-----|------|
| Price | $0 | $29/mo | $79/mo |
| Annual | — | $23/mo (billed annually) | $63/mo (billed annually) |
| Imports/month | 10 | Unlimited | Unlimited |
| Workspaces | 1 | Multiple | Multiple + shared |
| MCP access | None | Full personal | Per-workspace tokens |
| Smart Import enrichment | Yes | Yes | Yes |
| Keyword search | Yes | Yes | Yes |
| [feature] | ... | ... | ... |
```

### Positioning Statement Template (Product Identity)

```markdown
For [Heads of Sales / RevOps at B2B companies with 5-50 reps]
who [struggle to make their call library useful to their team and their AI],
CallVault is [the organized call workspace]
that [captures, organizes, and exposes calls to whatever AI you already use —
without the Gong price tag or AI lock-in].
```

### Upgrade Prompt Template (for UPGRADE-PROMPTS.md)

```markdown
## [Feature] Limit

**Trigger:** [Exact user action that fires the prompt]
**Where:** [UI component / page / modal]

### Copy

**Headline:** "[Context-specific headline]"
**Body:** "[What's blocked + what upgrade unlocks for this specific thing]"
**Primary CTA:** "[Action label]" → [destination]
**Secondary:** "Maybe later" → [dismiss behavior]

### Behavior

- On dismiss: [what happens]
- On CTA click: [what happens — settings/billing page or trial modal]
- Data preservation: [what's preserved, nothing lost]
```

### Polar Product Update Spec Template (for POLAR-UPDATE-LOG.md)

```markdown
## Product: [Old Name] → [New Name]

| Field | Current (v1) | Target (v2) | Can Change? |
|-------|-------------|-------------|-------------|
| Name | Solo | Pro | YES |
| Description | [old] | [new — no AI claims] | YES |
| Price | $29/month | $29/month | Existing subs unchanged |
| Billing interval | Monthly | Monthly | NO (must create new product) |

**Action:** Rename in-place (price unchanged) OR Archive + create new (price changes)
**Existing subscriber impact:** [describe]
**Annual variant:** [separate product — action]
```

---

## State of the Art

| Old Approach (v1) | Current Approach (v2) | Impact |
|-------------------|----------------------|--------|
| "AI-powered call intelligence" positioning | "AI-ready call workspace, not AI-powered" | Avoids competing with Gong on AI capability; creates new category |
| Solo/Team/Business tiers with RAG/embedding features | Free/Pro/Team tiers with zero AI features | Pricing based on workspace scale + MCP access, not AI usage |
| Coach/consultant as primary persona | B2B sales teams / RevOps as primary buyer | Changes messaging hierarchy, competitive set, and sales motion |
| Global AI-everywhere marketing | Smart Import as a named, bounded feature | Honest, defensible claim — "Calls arrive pre-organized" |
| Opt-out trial or no trial | Opt-in 14-day trial at moment of intent | Higher quality trial conversions (user chose to start) |

**Note on Gong pricing (current as of research):** Gong now requires ~$160-250/user/month plus $5K-$50K annual platform fee. For a 10-rep sales team, Gong costs $19K-$30K+/year. CallVault Team at $79/month flat = $948/year. This is a 20-30x price difference — the pricing page should make this comparison visible without naming Gong directly.

---

## Open Questions

1. **Existing Subscriber Migration (Polar)**
   - What we know: v1 has Solo ($29), Team, Business subscribers. v2 wants Pro ($29) + Team ($79).
   - What's unclear: Are there active Business ($249?) subscribers who would be affected by archiving that product? The price reduction from hypothetical $249 → $79 (new Team) is significant and requires a migration decision.
   - Recommendation: The Polar update plan should surface this as a human checkpoint. The user must decide: (a) rename existing products in-place (no price change for existing subs), or (b) archive + create new + manually migrate existing subs to new pricing. This is not a decision Claude should make autonomously.

2. **MCP on Free Tier: None vs. Demo Cap**
   - What we know: CONTEXT.md says "none or tiny demo cap on Free."
   - What's unclear: "Tiny demo cap" is undefined. If there's a demo cap, it needs a number and a UX for when the cap is hit.
   - Recommendation: Recommend "none" (zero MCP on Free) rather than a demo cap. A demo cap creates an additional limit type that needs its own upgrade prompt, its own counter, and its own reset logic. The simpler the Free tier, the easier to explain and implement. "No MCP on Free" is a clean, single-sentence message.

3. **Team Tier: Flat Rate vs Per-Seat**
   - What we know: CONTEXT.md describes Team as multi-seat (5-50 reps), admin dashboard, consolidated billing.
   - What's unclear: Whether Team is $79/month flat or per-seat.
   - Recommendation: Flat rate at $79/month for early adoption. Per-seat pricing requires more approval cycles and complicates "Team on enterprise terms." When the product is ready for enterprise, introduce per-seat then. For now, flat rate lowers the buying friction for a Head of Sales who can approve $79/month without finance review.

4. **Trial for Team Tier**
   - What we know: The 14-day opt-in trial is described in the context of Free → Pro.
   - What's unclear: Does a Pro user get a Team trial when they hit a Team feature?
   - Recommendation: Yes, same pattern. Pro user hits a Team-only feature (invite a 6th member, create a second org) → "This is a Team feature. Start your 14-day Team trial?" After trial: drop to Pro (not Free). Document this in UPGRADE-PROMPTS.md as a separate prompt flow.

---

## Sources

### Primary (HIGH confidence)
- Polar official documentation (https://polar.sh/docs/features/products) — product creation, update/archive rules, trial configuration, billing intervals, what can/cannot be changed after creation
- Phase 13 CONTEXT.md — all locked decisions and discretion areas
- PROJECT.md — v1 current state, existing Polar tier names (Solo/Team/Business), tech stack

### Secondary (MEDIUM confidence)
- WebSearch: SaaS annual discount benchmarks — 15-25% range, 20% most common, "2 months free" framing validated across multiple SaaS pricing research sources (Recurly, InnerTrends, Paddle)
- WebSearch: Freemium conversion research — 2-5% B2B baseline, context-aware prompts 32-350% better than generic prompts (Mixpanel A/B test data, Userpilot research)
- WebSearch: Three-tier pricing page best practices — center column highlight, "Most Popular" badge, annual toggle default all validated across multiple SaaS UX research sources
- WebSearch: Gong/Chorus competitive pricing — $160-250/user/month Gong, $1,200/user/year Chorus (multiple 2025-2026 comparison sources)
- WebSearch: Opt-in trial benchmarks — 18.2% organic conversion rate average for opt-in trials vs 48.8% opt-out (First Page Sage); 14-day is industry norm for self-serve tools with quick time-to-value

### Tertiary (LOW confidence — for reference only)
- WebSearch: $100M Offers framework — user cited this as the strategic framework for pricing. The "attraction offer" framing (Free tier gets people in + data in + proves value) is consistent with Hormozi's framework. Recommendation to verify the specific framework elements with the source if precise attribution matters.

---

## Metadata

**Confidence breakdown:**
- Polar update mechanics (BILL-02): HIGH — verified from official Polar docs
- Pricing tier decisions (STRAT-02, BILL-01, BILL-03): HIGH — decisions locked in CONTEXT.md; discretion recommendations based on research
- AI strategy document (STRAT-01): HIGH — decisions fully locked in CONTEXT.md; document is transcription + organization of those decisions
- Product identity document (STRAT-03): HIGH — decisions fully locked in CONTEXT.md; document is transcription + organization of those decisions
- Upgrade prompts design (BILL-04): HIGH for structure and copy patterns; MEDIUM for specific UI placement (depends on v2 frontend implementation)
- Competitive landscape: MEDIUM — pricing verified via multiple sources but subject to change
- Annual discount recommendation: MEDIUM — industry range well-documented, specific recommendation is within that range

**Research date:** 2026-02-27
**Valid until:** 2026-03-27 (30 days — Polar docs are stable; SaaS pricing patterns move slowly)

**CRITICAL NOTE FOR PLANNER:** The three existing PLAN files in this directory (13-01-PLAN.md, 13-02-PLAN.md, 13-03-PLAN.md) contain outdated decisions that predate the CONTEXT.md discussion. They must be superseded. The new plans must:
1. Use the Free/Pro/Team tier names (not Free/Pro/Business)
2. Use the B2B sales teams / RevOps persona (not solo rep / coach)
3. Use 1 workspace + ~10 imports/month on Free (not 3 workspaces + 50 imports/month)
4. Use the Heads of Sales buyer (not individual contributor)
5. Use the "film room and wiring" competitive framing (not "organized call workspace for solo reps")
