# CallVault Pricing Tiers — Authoritative v2 Specification

**Status:** Locked — v2 canonical pricing reference
**Last Updated:** 2026-02-27
**Covers:** STRAT-02, BILL-01, BILL-03

---

## 1. Pricing Philosophy

CallVault charges for workspace scale, AI connectivity, and team collaboration — not for AI features.

The product earns its price by doing three jobs:

1. **Getting calls organized.** Smart Import processes every call automatically. Organization value is immediate and visible within the first session. This is table stakes and is never gated.
2. **Connecting calls to AI.** MCP exposes the organized call library to Claude, ChatGPT, Gemini, or any AI the user already has. This is the primary paid feature. Users who want their AI to reach their calls pay for Pro.
3. **Scaling across a team.** Shared workspaces, roles, admin controls, and consolidated billing turn an individual tool into an organizational asset. Users who want to run their team on CallVault pay for Team.

The three tiers map directly to these jobs:

- **Free** — attraction offer. Users experience the full import and organization loop at no cost. This proves the product works and creates natural upgrade pressure once limits are hit. The $100M Offers framework applies here: Free is not a crippled product. It is a complete product for a low-volume user. The limits exist to create a conversion moment, not to punish.
- **Pro** — core continuity offer. "Me + My AI + My calls." Serious solo users who want unlimited imports and MCP access pay $29/month. The ROI case is immediate for anyone closing B2B sales deals: one saved deal more than covers a year of Pro.
- **Team** — the upsell. "Our org runs on this." Team is qualitatively different from Pro — it adds collaboration powers that Pro cannot unlock at any price. This is not Pro with higher limits. It is a different product for a different use case.

No Enterprise tier. If an enterprise asks, sell "Team on enterprise terms" (custom contract, invoicing, SLA). Do not create an Enterprise product until there is a sales motion to support it.

---

## 2. Tier Comparison Table

| Feature | Free | Pro | Team |
|---------|------|-----|------|
| **Price** | $0 | $29/mo | $79/mo flat |
| **Annual** | — | $23/mo (billed $278/yr) | $63/mo (billed $758/yr) |
| **Annual savings** | — | 2 months free | 2 months free |
| **Imports/month** | 10 | Unlimited | Unlimited |
| **Organizations** | 1 | 1 | Multiple |
| **Workspaces** | 1 | Multiple | Multiple + shared |
| **Folders** | Unlimited | Unlimited | Unlimited |
| **Smart Import enrichment** | Yes | Yes | Yes |
| **Auto-title + action items + tags** | Yes | Yes | Yes |
| **Keyword search** | Yes | Yes | Yes |
| **Call detail view** | Yes | Yes | Yes |
| **Full transcript + speakers + timestamps** | Yes | Yes | Yes |
| **Export (DOCX / PDF / TXT)** | Yes | Yes | Yes |
| **Public sharing links** | Yes | Yes | Yes |
| **Public sharing + embed player** | No | No | Yes |
| **MCP access** | None | Full personal | Per-workspace tokens + shared configs |
| **Import routing rules** | Basic | Full | Full + shared |
| **Team members** | — | — | Unlimited (flat rate) |
| **Roles and permissions** | — | — | Viewer / Member / Admin |
| **Invite flows** | — | — | Yes |
| **Admin dashboard** | — | — | Yes |
| **Consolidated billing** | — | — | Yes |
| **Usage overview** | — | — | Yes |
| **Shared workspace views** | — | — | Yes |
| **14-day free trial** | Opt-in | — | Opt-in (from Pro) |
| **Data retention** | Forever | Forever | Forever |

---

## 3. Free Tier Deep Dive

**Rationale for each limit:**

### 10 Imports/Month

The attraction offer limit. A sales rep doing 3-5 calls/week will hit 10/month within the first week of real use. This is intentional: the user has enough experience to be convinced the product works (Smart Import has enriched all 10 calls, they've explored a few transcripts, they've searched their library) but not enough to solve their actual problem (they have 50+ calls to organize, and the month isn't over).

The upgrade moment arrives naturally — within the first billing month for any active user. This is the ideal conversion window: the user has seen value, they are not guessing about whether to pay, they know exactly what they're getting.

A user with very low call volume (1-2 calls/month) is not a Pro conversion target anyway. They will use Free indefinitely. That is fine — they are potential referral sources and future Team buyers as their business scales.

### 1 Organization, 1 Workspace

Enough to set up and organize. A new user creates their workspace, imports their first calls, sees their library. The structure is clear.

The second workspace trigger comes when the user tries to organize calls by client, project, or deal stage — the moment they have enough data to want more structure. This is the exact moment where Pro value is obvious: "I need a workspace for Acme Corp, and a separate one for Prospect Pipeline." That realization is the upgrade prompt.

1 organization limit means users cannot segment their business (agency clients, divisions) without upgrading to Team.

### No MCP Access

MCP is the paywall between Free and paid. The message is single-sentence: "MCP access requires Pro or Team."

No demo cap. No "3 tool calls/month." No partial access. The reason: a partial MCP experience is confusing to users and creates additional complexity (separate counter, separate upgrade prompt, reset logic). A clean "MCP requires Pro" is honest, easy to explain, and creates a clear upgrade motivation.

Free users who have connected their AI to CallVault via a personal token (i.e., v1 users being migrated) will see their MCP configs in a locked/visible state after downgrade. Existing calls are accessible via browse/search; MCP connectivity is blocked until they upgrade.

### Smart Import Included

This is non-negotiable table stakes. New users MUST see the full Smart Import experience — auto-title, action items, tags — from their very first call. The value of the product is not visible without it.

Gating Smart Import would be like a hotel charging extra for the bed. The feature is not a premium add-on. It is what makes CallVault worth the free tier at all.

### Keyword Search Included

Basic call discovery is free. Users need to find calls — that is part of the core product experience. Semantic/AI-powered search is not offered (the AI searches calls through MCP, not through a CallVault search interface). Keyword search is the only search type and it is included at all tiers.

---

## 4. Pro Tier Deep Dive

**One-line summary: "Me + My AI + My calls."**

Pro is for the serious solo user — a sales rep, consultant, founder, or coach who uses CallVault every day and wants to connect their AI to their call library.

**What Pro unlocks:**

- **Unlimited imports:** Remove friction entirely. No monthly counter. Import every call from every meeting, every day.
- **Multiple workspaces:** Organize calls by client, project, deal stage, or any other structure that makes sense. Each workspace is private to the user.
- **Full personal MCP access:** Connect Claude, ChatGPT, Gemini, or any MCP-compatible AI to the user's workspace. Generate a personal MCP token. Access all calls via natural language queries in the AI.
- **Full import routing rules:** Advanced rules for automatically routing imported calls to the right workspace and folder based on title, participant, or source.

**What Pro does NOT include:**

Pro is explicitly for individuals. There are no collaboration features. Users who want to share workspaces, invite teammates, or administer a team account need Team. This is not a limitation of Pro — it is the correct product for a solo user. The Team upgrade prompt appears only when a Pro user explicitly tries to do something collaborative.

---

## 5. Team Tier Deep Dive

**One-line summary: "Our org runs on this."**

Team is qualitatively different from Pro. It is not Pro with higher limits. The headline Team features are collaboration and admin controls — things that do not exist in Pro at any price.

**What Team adds over Pro:**

- **Multiple organizations:** Support agencies managing multiple client orgs, or companies with multiple divisions. Each org has its own workspace hierarchy, billing, and members.
- **Shared workspaces:** Workspaces that multiple team members can access, contribute to, and search within. Role-scoped access controls what each member can see and do.
- **Roles and permissions:** Three roles — Viewer (read-only access), Member (can add/edit calls), Admin (full workspace management including member invite/remove). The invite flow shows clearly: "You're inviting [email] to [workspace name] inside [org name]."
- **Per-workspace MCP tokens:** Each workspace gets its own MCP connection with scoped access. Team members working in Workspace A see only Workspace A's calls via MCP. Workspace-level token rotation does not affect other workspaces.
- **Shared import routing rules:** Routing rules can be shared across team members in the same workspace. One admin sets up the rules; all members benefit.
- **Admin dashboard:** Usage overview, member management, workspace overview, billing management — all in one place.
- **Consolidated billing:** One invoice. One subscription. All team members covered under the flat rate.
- **Usage overview:** Admins can see import counts, workspace activity, and MCP usage across the team.
- **Public sharing with embed player:** Shared call links can include an embedded audio/video player. (Basic sharing links work at all tiers; the embed player is Team-only.)

**Team pricing:**

$79/month flat rate. Not per-seat. This is intentional and important for the early adoption phase.

A Head of Sales with a 5-rep team pays $79/month — $16/rep/month. Compared to Gong ($160-250/user/month), this is 10-15x cheaper. The comparison does not need to name Gong: "Team workspace for up to [N] members, $79/month flat — no per-seat surprises."

Per-seat pricing will be reconsidered when the product is ready for an enterprise sales motion. Until then, flat rate reduces the buying friction for managers who can approve $79/month without finance review.

---

## 6. Upgrade Triggers

Clear causes of conversion at each boundary.

### Free to Pro

| Trigger | User Action |
|---------|-------------|
| Import limit | Attempts to import the 11th call in the current calendar month |
| Workspace limit | Attempts to create a second workspace |
| MCP access | Navigates to MCP settings or attempts to generate an MCP token |

### Pro to Team

| Trigger | User Action |
|---------|-------------|
| Invite teammate | Attempts to invite another user to their workspace |
| Multiple organizations | Attempts to create a second organization |
| Per-workspace MCP token | Attempts to generate a workspace-scoped MCP token (vs. personal token) |

At every trigger point, the user sees an upgrade prompt. See UPGRADE-PROMPTS.md for the full design spec for each prompt.

---

## 7. What Is Never Gated

These features are available at all tiers — Free, Pro, and Team. They are table stakes. Gating any of these would damage the product experience for new users and misrepresent the product's core value.

| Feature | Why Never Gated |
|---------|----------------|
| Smart Import enrichment (auto-title, action items, tags) | Core product experience — users must see this on their first call |
| Keyword search | Basic call discovery is part of the minimum viable product |
| Unlimited folders | Folder organization is structural, not premium |
| Call detail view | Full transcript, speakers, timestamps — basic access to own data |
| Export (DOCX / PDF / TXT) | Users own their data; basic export is a data rights issue |
| Public sharing links | Sharing individual calls is a core workflow |
| Data retention | All data is kept forever. No data is deleted on downgrade. |

**Data retention note:** When a user downgrades (from Pro to Free, or after trial expiry), all data remains intact. Premium features become read-only or locked. The data itself is never touched. This is a product commitment, not just a technical behavior. It must be communicated clearly in downgrade messaging.

---

## 8. Billing Configuration

### Price Points

| Product | Monthly | Annual | Annual Billed | Monthly Equivalent |
|---------|---------|--------|---------------|-------------------|
| Free | $0 | — | — | — |
| Pro | $29/mo | Yes | $278/yr | $23/mo displayed |
| Team | $79/mo | Yes | $758/yr | $63/mo displayed |

Annual pricing represents a 20% discount from monthly. This is framed as "2 months free" in all copy — never as "20% off." The "2 months free" framing is more concrete and compelling for the target buyer.

Annual calculation: $29 × 10 = $290 → $278 (save $12, ~4% better than exactly 2 months). Round to $278 and display as "$23/mo." For Team: $79 × 10 = $790 → $758 (save $32). Display as "$63/mo."

### Billing Intervals

Monthly and annual available for Pro and Team. No weekly or daily billing. Annual is presented as the default toggle on the pricing page (users see annual prices first, with a toggle to monthly).

### Payment

Via Polar. See Section 10 for Polar product configuration details.

---

## 9. Price Evolution Strategy

These prices are **launch prices**, not permanent prices. The goal is to buy speed, proof, and data — then raise with confidence.

### Why launch at $29 / $79

- 0 paid users today. No ROI stories yet. No "teams like yours got X result" proof.
- $29 Pro / $79 Team flat makes saying "yes" easy for early adopters.
- Clearly premium vs cheap tools, but nowhere near Gong-land ($$$).
- Team at $79 flat is stupidly good value for a 5-15 rep squad — exactly who we want first.

### Price-raise schedule (decided in advance, not "felt out")

**Trigger 1: First 10 paying Pro + first 5 paying Team**
- Raise Pro to **$39/month**
- Raise Team to **$99/month**
- Grandfather everyone on their original price. Never touch existing subs.

**Trigger 2: Next 20-30 customer mark (if conversion stays healthy)**
- Repeat the raise. Track trial-to-paid conversion and churn in first 60-90 days.
- If conversion × lifetime gross profit drops, stop raising. Otherwise, keep going.

This is the $100M Offers LTV play: keep raising until conversion × LTGP goes down.

### When we're "in position to charge more"

When we can say: "Teams like yours paid this and got X result." Specifically:
- 5-10 paying teams
- A couple of clear outcomes (faster ramp, better coaching, fewer lost calls)
- Some "we will never go back" quotes

Until then, we're in "prove it" mode. Launch prices buy the data to exit that mode.

### Annual pricing tracks proportionally

When monthly prices change, annual = monthly × 10 (2 months free framing preserved).

| Trigger | Pro Monthly | Pro Annual | Team Monthly | Team Annual |
|---------|------------|------------|-------------|-------------|
| Launch | $29 | $278 | $79 | $758 |
| After 10 Pro + 5 Team | $39 | $378 | $99 | $958 |

---

## 10. Freemium + Trial Hybrid

### Free Tier (Permanent)

Free is permanent. There is no expiration on the Free tier. A user can use Free forever with the stated limits. This is the attraction offer — it is not a time-limited demo.

### 14-Day Opt-In Trial

The 14-day trial is opt-in. The user explicitly starts it. The trial is not automatically applied at signup.

**Trigger:** Any upgrade prompt CTA click when the user has not yet used their trial.

**UX flow:**
1. Free user hits a limit (e.g., imports, workspace, MCP)
2. Upgrade prompt appears: "This is a Pro feature. Start your 14-day free trial?"
3. User clicks "Start free trial"
4. Trial opt-in modal: "Start your 14-day free trial of Pro. No credit card required. After 14 days, you'll return to Free automatically."
5. User confirms
6. Toast notification: "You're on Pro until [date]. Enjoy!"
7. Feature immediately unlocked

The user chooses when to burn the trial window. A user who sees the upgrade prompt but clicks "Maybe later" does not start the trial. Their 14 days begin only when they explicitly confirm.

### Pro to Team Trial

Same pattern applies at the Pro/Team boundary. A Pro user who hits a Team-only feature (invite teammate, create second org, per-workspace MCP token) sees: "This is a Team feature. Start your 14-day Team trial?"

After the Team trial ends, the user returns to Pro — not Free.

### Post-Trial Downgrade

When a trial period ends:

1. User is automatically downgraded to their previous tier
2. No manual action required from the user
3. No data is deleted

**If downgrading from Pro to Free:**
- User picks 1 "active" workspace to keep fully editable during the next session
- All other workspaces become read-only (viewable, searchable, but not editable)
- MCP configs stay visible but MCP connectivity is blocked
- Existing calls are untouched
- New imports hit the free-tier cap (10/month)

**If downgrading from Team to Pro:**
- User retains Pro features
- Team-only features (shared workspaces, roles, invites, admin dashboard) become read-only or locked
- Per-workspace MCP tokens stop accepting new connections; existing token configs remain visible

### Trial State Tracking

Trial state is tracked via Polar subscription status. The frontend reads Polar's subscription metadata to determine:
- Has the user ever had a Pro trial? (prevents second trial)
- Is the user currently on a trial?
- When does the trial expire?

Polar handles the billing mechanics. The "opt-in at moment of intent" UX is a frontend pattern — the backend call to Polar to create the subscription happens when the user confirms the trial modal.

---

## 11. Polar Configuration Notes

*For use during Plan 13-03: Polar Dashboard Update*

### Polar Products (Clean Setup)

**0 paying subscribers** as of 2026-02-27. All v1 stubs (Solo/Team/Business) can be archived. This is a clean setup, not a migration.

| v2 Product | Price | Billing | Polar Status |
|------------|-------|---------|-------------|
| Pro Monthly | $29/month | Monthly | Create fresh |
| Pro Annual | $278/year | Annual | Create fresh |
| Team Monthly | $79/month | Monthly | Create fresh |
| Team Annual | $758/year | Annual | Create fresh |

**Free tier** — No Polar product. Enforced in app logic only.

See POLAR-UPDATE-LOG.md for the execution spec and product IDs.

### Polar Trial Configuration

- Trial period: 14 days
- Configured per product (Pro Monthly gets a 14-day trial setting enabled)
- "No credit card required" = Polar supports trials without payment method
- The opt-in UX is handled in the frontend; the Polar subscription creation triggers when the user confirms the trial modal
- After trial ends, Polar automatically cancels/downgrades per subscription settings

### Key Polar Constraints (from research)

- Billing interval CANNOT be changed after product creation — monthly and annual must be separate products
- Price changes for fixed-price products apply to NEW subscriptions only — existing subscribers keep original pricing
- Products CANNOT be deleted — only archived (archived products: new purchases disabled, existing subscribers unaffected)
- Name and description CAN be updated at any time with no subscriber impact
- Annual billing interval = "yearly" in Polar's API (not "annual")

---

*Document status: Locked — v2 canonical pricing reference*
*Created: 2026-02-27*
*Author: Phase 13 Planning*
*Next: See UPGRADE-PROMPTS.md for prompt design spec; 13-03-PLAN.md for Polar dashboard update*
