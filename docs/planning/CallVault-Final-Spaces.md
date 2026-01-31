# CALLVAULT
## Single Source of Truth
### Architecture, Objects, Permissions, User Stories & FAQ

**Version 1.1 — FINAL**  
**Last Updated: January 2026**

---

# Table of Contents

1. [Mental Model](#1-mental-model)
2. [Core Objects](#2-core-objects)
3. [Entity Relationships](#3-entity-relationships)
4. [Roles & Permissions](#4-roles--permissions)
5. [Rules & Automation](#5-rules--automation)
6. [Cross-Bank Operations](#6-cross-bank-operations)
7. [Lifecycle & Offboarding](#7-lifecycle--offboarding)
8. [User Stories](#8-user-stories)
9. [Frequently Asked Questions](#9-frequently-asked-questions)
10. [Chat & Search Scoping](#10-chat--search-scoping)
11. [Implementation Guidelines](#11-implementation-guidelines)
12. [Glossary](#12-glossary)
13. [Version History](#13-version-history)

---

# 1. Mental Model

CallVault is built on a simple, powerful architecture that serves individuals, teams, coaches, agencies, and communities with the same underlying system.

## 1.1 One-Sentence Summary

> *A User belongs to one or more Banks; each Bank has Vaults; Vaults contain VaultEntries that point to Recordings, plus Folders, Tags, Rules, and AI Agents.*

## 1.2 Key Concepts

- **Banks** = Hard separation (personal vs business). Nothing crosses Banks unless explicitly copied.
- **Vaults** = Collaboration rooms inside a Bank (Sales Team, Coach, Community, Client).
- **VaultEntry** = "This Recording in this Vault with this context." Enables reuse without duplication.
- **Recording** = The base call (audio/transcript). Lives in exactly one Bank.
- **Tags** = Metadata for automation. Rules key off tags.
- **Folders** = Human organization and training sets. Curated groupings.

## 1.3 The Bank/Vault Metaphor

Think of CallVault like the banking system:

- Each Bank is a completely separate institution (Personal Bank, Company Bank, Agency Bank).
- Inside each Bank, you have different Vaults (safe deposit boxes, checking accounts, etc.).
- A Recording can appear in multiple Vaults within the same Bank via VaultEntries.
- Moving Recordings between Banks is always a COPY operation (with optional delete-from-source).

---

# 2. Core Objects

The following objects form the foundation of CallVault. Every feature, permission, and automation builds on these primitives.

## 2.1 User

**Definition:** A human with a login. The atomic identity in the system.

**Key Fields:** `id`, `email`, `name`, `created_at`

**Relationships:**
- Can belong to many Banks via BankMembership
- Can belong to many Vaults via VaultMembership
- Owns Recordings (within each Bank they belong to)

---

## 2.2 Bank (Account/Tenant)

**Definition:** The top-level container representing a distinct ownership entity. Examples: "Personal Bank", "Acme Inc Bank", "CoachCo Bank".

**Key Fields:** `id`, `name`, `type`, `created_at`, `cross_bank_default` (copy_only | copy_and_remove)

**Purpose:** Hard security boundary. NOTHING crosses Banks unless explicitly copied.

**Owns:**
- Vaults
- BankMemberships
- Subscriptions
- Recordings (indirectly, via User ownership within the Bank)

---

## 2.3 BankMembership

**Definition:** Links a User to a Bank with a specific role.

**Key Fields:** `id`, `user_id`, `bank_id`, `role`

**Roles:**
- **bank_owner:** Full control. Manage subscription, create/delete Vaults, manage all BankMemberships.
- **bank_admin:** Same as owner except cannot transfer Bank ownership.
- **bank_member:** Can be invited into specific Vaults. Cannot touch billing.

---

## 2.4 Vault

**Definition:** A collaboration container inside a Bank. This is where sharing and work happens.

**Key Fields:** `id`, `bank_id`, `name`, `vault_type`, `created_at`, `default_sharelink_ttl_days` (default: 7)

**Vault Types:**
- `team`: For internal company teams (Sales, Support, etc.)
- `coach`: For coaching relationships
- `community`: For membership/community broadcasts
- `client`: For agency per-client workspaces
- `personal`: Default personal workspace

**Owns:**
- VaultMemberships
- VaultEntries
- Folders
- AIAgents
- Rules (Vault-scoped)
- ShareLinks

---

## 2.5 VaultMembership

**Definition:** Links a User to a Vault with a specific role. All permissions inside a Vault derive from this.

**Key Fields:** `id`, `user_id`, `vault_id`, `role`, `created_at`

**Roles:** `vault_owner`, `vault_admin`, `manager`, `member`, `guest` (detailed in Section 4)

---

## 2.6 Recording

**Definition:** The base call object. Contains the actual audio/video and transcript.

**Key Fields:** `id`, `bank_id`, `owner_user_id`, `audio_url`, `transcript`, `created_at`, `global_tags`, `source_app`, `source_metadata`, `duration`

**Critical Rule:** Lives in exactly ONE Bank. Cannot span multiple Banks.

**Relationships:**
- Belongs to one Bank
- Owned by one User (within that Bank)
- Can have 0..N VaultEntries in different Vaults within the same Bank

### 2.6.1 Why Recordings Live in One Bank

Banks are separate legal/ownership universes. Each Bank has different retention rules, legal needs, people who can see data, and billing status. Keeping Recordings Bank-isolated ensures clean audit trails and proper data governance.

---

## 2.7 VaultEntry

**Definition:** "This Recording in this Vault with local context." The join record that enables a single Recording to appear in multiple Vaults with different metadata.

**Key Fields:** `id`, `vault_id`, `recording_id`, `folder_id`, `local_tags`, `scores`, `notes`, `created_at`

**Critical Rules:**
- A Recording can have multiple VaultEntries in different Vaults (same Bank only)
- Deleting/changing one VaultEntry never affects others
- VaultEntries persist even if the Recording owner leaves the Vault

### 2.7.1 Why VaultEntry Exists

Without VaultEntry, you would have two bad options:

1. **One Recording, one location:** Can't have the same call in Sales Vault AND Marketing Vault with different tags/notes.
2. **Duplicate Recordings:** Storage bloat, sync nightmares, no single source of truth.

VaultEntry gives you the best of both worlds: one Recording (one audio file, one transcript), multiple contexts with their own local metadata.

### 2.7.2 VaultEntry Use Case Example

A killer testimonial call (one Recording) can simultaneously be:

- **In Sales Team Vault:** Folder = "Hall of Fame", tagged "win", QA-scored 95
- **In Marketing Vault:** Folder = "Testimonials", tagged "UGC_ad_candidate", with clip notes
- **In VOC Vault:** Folder = "Feature Requests", tagged "requested_integration_X"

Same Recording, three VaultEntries, three different jobs, no conflicts.

---

## 2.8 Folder

**Definition:** Groups VaultEntries inside a single Vault for human organization and training sets.

**Key Fields:** `id`, `vault_id`, `name`, `visibility`, `created_at`

**Visibility Options:**
- `all_members`: Everyone in the Vault can see
- `managers_only`: Only managers and above
- `owner_only`: Only Vault owner/admins

**Examples:** "Hall of Fame", "Testimonials", "Community Vault", "Client Onboarding"

---

## 2.9 Tag

**Definition:** Text label for metadata and automation. Rules and AI Agents key off tags.

**Key Fields:** `id`, `name`, `color` (optional)

**Can Attach To:**
- **Recording (global_tags):** Source-level tags from integrations or user labels
- **VaultEntry (local_tags):** Context-specific tags inside a Vault

**Critical Rule:** Tags drive automation. Folders are for human organization. Keep these jobs separate.

---

## 2.10 Rule

**Definition:** Automation engine. Watches for events and performs actions.

**Key Fields:** `id`, `scope` (bank | vault), `conditions`, `actions`, `enabled`

**Events:** `recording.created`, `recording.tag_added`, `vaultentry.created`, `vaultentry.tag_added`

**Actions:**
- Create a Recording in another Bank (COPY)
- Create a VaultEntry in a target Vault
- Move VaultEntry to a specific Folder
- Add/remove tags (global or local)
- Trigger an AIAgent run
- Delete/hide a VaultEntry from a specific Vault

---

## 2.11 AIAgent

**Definition:** A configured AI that runs over VaultEntries to score, coach, summarize, or extract content.

**Key Fields:** `id`, `vault_id`, `name`, `visible_to_roles`, `filter` (tags/folders), `behavior`

**Scope:** Lives in a Vault. Only sees VaultEntries inside that Vault matching its filters.

**Access:** User must have VaultMembership + appropriate Subscription permissions.

---

## 2.12 Subscription

**Definition:** Billing entity attached to a Bank.

**Key Fields:** `id`, `bank_id`, `plan`, `seat_limit`, `vault_limit`, `ai_agent_limit`, `feature_flags`

**Controls:** Number of seats, max Vaults, max AI Agents, enabled features (Team mode, Coach mode, etc.)

---

## 2.13 ShareLink / ExternalAccess

**Definition:** Optional object for sharing specific VaultEntries or Folders with outsiders.

**Key Fields:** `id`, `vault_id`, `target_type` (folder | vaultentry), `target_id`, `permissions` (view | comment), `expires_at`, `token`, `created_by_user_id`

**Behavior:** 
- Does not grant visibility beyond the exact target. 
- Defaults to 7-day expiry (configurable per Vault or Bank).
- Auto-revoked when the creating user loses VaultMembership.

---

# 3. Entity Relationships

This section defines how objects connect. Use this as the canonical reference for building queries and enforcing permissions.

## 3.1 Relationship Map

| Parent | Cardinality | Child | Notes |
|--------|-------------|-------|-------|
| Bank | 1:N | Vaults | Bank owns Vaults |
| Bank | 1:N | BankMemberships | Links Users to Bank |
| Bank | 1:N | Subscriptions | Billing per Bank |
| Vault | 1:N | VaultMemberships | Links Users to Vault |
| Vault | 1:N | VaultEntries | Recordings in Vault |
| Vault | 1:N | Folders | Groupings in Vault |
| Vault | 1:N | AIAgents | AI per Vault |
| Vault | 1:N | ShareLinks | External access tokens |
| Recording | 1:N | VaultEntries | Same Bank only |
| User | 1:N | Recordings | Within each Bank |
| User | 1:N | BankMemberships | Multi-Bank support |
| User | 1:N | VaultMemberships | Multi-Vault support |
| User | 1:N | ShareLinks | Created by User |

## 3.2 Security Boundaries

### Bank Isolation
- A User only sees Banks where they have a BankMembership.
- A Vault never sees Recordings outside its Bank.
- Cross-Bank movement is ALWAYS: create new Recording row in target Bank (COPY).

### Vault Isolation
- A User only sees Vaults where they have a VaultMembership.
- VaultEntry visibility is controlled by VaultMembership role + Folder visibility.
- AIAgents only see VaultEntries within their Vault that match their filters.

---

# 4. Roles & Permissions

This section defines exactly what each role can do. Use this as the authoritative permission matrix.

## 4.1 Bank-Level Roles

| Role | Capabilities |
|------|--------------|
| **bank_owner** | Full control. Manage subscription, create/delete Vaults, manage all BankMemberships, transfer ownership. |
| **bank_admin** | Same as owner EXCEPT cannot transfer Bank ownership or delete the Bank. |
| **bank_member** | Can be invited into specific Vaults. Cannot manage billing, create Vaults, or manage other members. |

## 4.2 Vault-Level Roles

| Role | Capabilities |
|------|--------------|
| **vault_owner** | Full control in Vault: settings, members, Folders, Rules, AIAgents, delete VaultEntries, manage external shares. |
| **vault_admin** | Same as owner EXCEPT cannot delete the Vault or change Vault owner. |
| **manager** | View all VaultEntries. Create/edit Folders. Tag VaultEntries. Run AIAgents. Create/edit Rules scoped to this Vault. |
| **member** | See VaultEntries they shared + Folders with visibility=all_members. Can share own Recordings into Vault. Cannot see managers_only/owner_only folders or edit Rules/AI. |
| **guest** | View ONLY specific Folders/VaultEntries they are explicitly granted via ShareLink or direct invite. No tagging, no rule edit, no membership management. |

## 4.3 Permission Matrix (Vault-Level Detail)

| Action | Owner | Admin | Manager | Member | Guest |
|--------|-------|-------|---------|--------|-------|
| View all VaultEntries | ✓ | ✓ | ✓ | Limited* | Limited** |
| Share own Recordings into Vault | ✓ | ✓ | ✓ | ✓ | — |
| Create/Edit Folders | ✓ | ✓ | ✓ | — | — |
| Tag VaultEntries | ✓ | ✓ | ✓ | Own only | — |
| Create/Edit Rules | ✓ | ✓ | ✓ | — | — |
| Configure AIAgents | ✓ | ✓ | — | — | — |
| Run AIAgents | ✓ | ✓ | ✓ | ✓ | — |
| Manage VaultMemberships | ✓ | ✓ | — | — | — |
| Delete VaultEntries | ✓ | ✓ | — | Own only | — |
| Create ShareLinks | ✓ | ✓ | — | — | — |
| Delete Vault | ✓ | — | — | — | — |

\* Members see: VaultEntries they shared + Folders with visibility=all_members  
\** Guests see: Only specific Folders/VaultEntries they were explicitly granted

---

# 5. Rules & Automation

Rules are the automation engine. They watch for events and perform actions. This section defines exactly how they work.

## 5.1 Events

Rules can trigger on the following events:

| Event | Description |
|-------|-------------|
| `recording.created` | New Recording added to a Bank |
| `recording.tag_added` | Global tag added to a Recording |
| `vaultentry.created` | New VaultEntry created in a Vault |
| `vaultentry.tag_added` | Local tag added to a VaultEntry |

## 5.2 Conditions

Conditions filter which events trigger the rule. They can check:

### Recording Attributes
- `bank_id`: Which Bank the Recording is in
- `owner_user_id`: Who recorded it
- `global_tags`: Source-level tags
- `source_app`: Where it came from (Zoom, phone, etc.)
- `title`: Recording title (supports contains, starts_with, etc.)
- `duration`: Length of recording
- `calendar_context`: Associated calendar event

### VaultEntry Attributes
- `vault_id`: Which Vault
- `folder_id`: Current Folder
- `local_tags`: Context-specific tags

## 5.3 Actions

When conditions match, rules can perform these actions:

- **Create Recording in another Bank (COPY):** Creates a new Recording row in target Bank pointing to same media file
- **Create VaultEntry:** Add this Recording to a target Vault
- **Move VaultEntry to Folder:** Change the folder_id
- **Add/Remove tags:** Modify global_tags or local_tags
- **Trigger AIAgent:** Run a specific AI Agent against this VaultEntry
- **Delete/Hide VaultEntry:** Remove from a specific Vault (optional, for MOVE behavior)

## 5.4 Critical Behaviors

### Idempotency
Rules must not create duplicate VaultEntries. Implementation should check for existing (recording_id, vault_id) combinations before creating. Track (recording_id, vault_id, rule_id) to prevent re-execution of the same rule.

### Bank Isolation
Rules NEVER operate across Banks except via explicit "copy to Bank X" actions. A rule in Personal Bank cannot directly create a VaultEntry in Company Bank without first copying the Recording.

### Rule Chaining & Loop Prevention

**Implementation requirements:**

1. **Same-rule prevention:** Track rule execution per event chain. Do not allow the same rule to run twice on the same target (recording_id or vaultentry_id) within a single event chain. Track `(rule_id, target_type, target_id)` for the current chain; if already seen, skip.

2. **Max depth limit:** Enforce a global max depth of **3 rule hops** per originating event. Each event chain carries a `depth` counter. If depth > 3, log the exceeded chain and stop further rule execution.

**Why this works:** Any sane automation in this product is 1–2 hops (tag → create VaultEntry → run AI). If someone designs workflows requiring 5+ chained hops, they're misusing the system.

## 5.5 Example: Personal to Business Routing

The most common automation pattern:

**Event:** `recording.created` in Personal Bank

**Condition:** `global_tags` includes 'Work'

**Actions:**
1. COPY Recording into Business Bank (new recording_id, same media file)
2. Create VaultEntry in Business Bank → Sales Team Vault
3. (Optional) Delete/hide VaultEntry from Personal Bank → Personal Vault

---

# 6. Cross-Bank Operations

This section defines the single most important architectural decision: how Recordings move between Banks.

## 6.1 The Core Rule

> *Any movement of a Recording from Bank A to Bank B is implemented as a COPY: a new Recording row in Bank B pointing to the same underlying media file.*

## 6.2 Why Copy, Not Move?

You want both of these behaviors:

1. **"Keep in both places":** Rep has call in Personal Bank AND it's shared to Company Bank
2. **"Complete handoff":** Call moves entirely to Company Bank, gone from Personal

The "move" operation is just: COPY + DELETE from source. Under the hood, it's always a copy.

This gives you:
- Clean separation of ownership and permissions by Bank
- Clear audit trails per Bank
- No permission bugs from shared rows across tenants
- Flexibility for both "share" and "handoff" workflows

## 6.3 Physical Media Handling

To avoid storage bloat:
- Multiple Recording rows can point to the same physical audio file
- Only the metadata/ownership is duplicated, not the actual media
- This is transparent to users and the API

## 6.4 Default Behavior Setting

Each Bank has a setting: `cross_bank_default`

| Setting | Behavior |
|---------|----------|
| `copy_only` **(default, recommended)** | Cross-Bank send creates new Recording in target Bank, keeps original in source Bank |
| `copy_and_remove` | Cross-Bank send creates new Recording in target Bank, then deletes/hides original from source Bank |

**Rules and manual sends inherit this Bank-level default unless explicitly overridden per action.**

This setting is the rule of the land. No pop-ups, no constant decisions.

## 6.5 Manual Override

For manual sends, offer a subtle override:

- **Button:** "Send to Business Bank"
- **Small checkbox:** "Also remove from this Bank" (defaults to Bank setting)

No modal, no constant decisions. If users never touch it, behavior follows their Bank setting.

---

# 7. Lifecycle & Offboarding

This section defines exactly what happens when people join, leave, or churn. No ambiguity.

## 7.1 Ingestion Flow

Default behavior when calls are recorded:

1. All connected sources feed into a default Bank (often Personal Bank)
2. Alternatively, configure per-source: Source A → Personal Bank, Source B (@company.com Zoom) → Business Bank directly
3. Rules then route Recordings to appropriate Vaults based on tags/conditions

## 7.2 Employee Leaves Company

| Action | Result |
|--------|--------|
| Remove BankMembership | User loses access to all Vaults in Company Bank |
| Remove VaultMemberships | User can't see any VaultEntries in those Vaults |
| VaultEntries persist | Company keeps all VaultEntries they shared while employed |
| Personal Bank unaffected | Employee keeps their Personal Bank and any Recordings there |
| ShareLinks auto-revoked | All ShareLinks created by the user in Company Vaults are invalidated |

## 7.3 Coachee Cancels

| Action | Result |
|--------|--------|
| Remove VaultMembership | Coachee loses access to Coach Vault |
| Lose AI access | Can no longer use Coach's AI Agents |
| VaultEntries persist | Coach keeps all VaultEntries they shared while active |
| Original Recordings | Coachee keeps their own Recordings in their own Bank |
| ShareLinks auto-revoked | All ShareLinks created by the coachee in Coach Vault are invalidated |

## 7.4 Community Member Churns

| Action | Result |
|--------|--------|
| Remove VaultMembership | Loses access to Community Vault |
| No new calls | Stops receiving new group VaultEntries |
| Personal copies | Any Recordings they copied to Personal Bank remain there |
| ShareLinks auto-revoked | All ShareLinks created by the member in Community Vault are invalidated |

## 7.5 Guest/ShareLink Revoked

- Delete Guest VaultMembership OR invalidate ShareLink token
- No further access to any Vault content
- ShareLink audit log preserved

**ShareLink auto-revocation rule:** When someone is removed from a Vault, all ShareLinks they created in that Vault are invalidated automatically. ShareLinks default to a 7-day expiry (configurable per Vault or per Bank).

## 7.6 Deleting Recordings

**Policy:** If a Recording has ANY VaultEntries in that Bank, the owner **cannot hard delete** it.

**UX:** "This call is used in 3 Vaults. You can't fully delete it, but you can remove it from your view."

**Why this policy:**
- No "ghost data" where some people see a call that is "deleted at source"
- Clear mental model for users and devs
- Legally safer: if a company depends on that call for compliance, a rep can't nuke it
- User can always remove the Recording from their personal Vault/view, just not destroy it for everyone

**Implementation:** If `VaultEntry.count(recording_id) > 0`, block deletion. User can delete their own VaultEntry (removing from personal view) but not the Recording itself.

---

# 8. User Stories

The following 12 user stories cover 95% of real-world use cases. Each is mapped to the architecture above.

## Story 1: Biz Owner with Reps (Work vs Personal Split)

**As a:** business owner with a sales team

**I want:** my reps to auto-sync only their "work" calls into my Team Vault

**So that:** managers and I can review, audit, and keep records without seeing personal calls

### Acceptance Criteria
- Reps can toggle/rule-based sync (by app, title, tag, calendar, etc.)
- Once a Recording is shared into the Team Vault (as a VaultEntry), that VaultEntry is permanent even if the rep disconnects
- Owner controls which team members can see those VaultEntries

---

## Story 2: Biz Owner with "Hall of Fame" Calls

**As a:** business owner

**I want:** a curated "Best Calls" Folder my reps can access

**So that:** they can watch, learn, and use AI to ask questions and roleplay against my best examples

### Acceptance Criteria
- Only owners/managers can add/remove from this Folder
- All reps in that Vault can view and chat with those VaultEntries

---

## Story 3: Biz Owner Doing AI Scoring & QA

**As a:** business owner

**I want:** every Recording that enters my Team Vault and matches certain tags/rules to be auto-scored by an AI Agent

**So that:** we can track performance and coach reps on specific gaps

### Acceptance Criteria
- Example Rule: "If Recording has tag 'Sales' or title contains 'Demo/Closer' → add to Team Vault, run QA Agent, show scores on dashboard"
- Scores roll up by rep, by stage, over time

---

## Story 4: Creator/Coach with Community (Broadcast Mode)

**As a:** coach/creator with a paid community

**I want:** designated calls to auto-sync into a Community Vault

**So that:** members always get new group calls while they're active

### Acceptance Criteria
- When someone leaves the community, they lose membership in that Community Vault and stop seeing new VaultEntries
- They may keep any Recordings they explicitly copied into their own Personal Bank

---

## Story 5: Sales Coach with Coachees

**As a:** sales coach

**I want:** coachees to easily share selected sales calls into my Coach Vault

**So that:** those VaultEntries feed a private "Sales Coach AI" available only to my active coachees

### Acceptance Criteria
- Coachees push Recordings into my Coach Vault (manual share or via Rules)
- My AI Agent can only see VaultEntries inside my Coach Vault
- When a coachee stops paying or leaves CallVault, they lose membership/AI access; I keep VaultEntries they shared while active

---

## Story 6: Individual Rep - Personal Career Vault

**As a:** individual rep

**I want:** all my calls in my own Personal Bank across jobs

**So that:** I can search, learn, and bring my "game tape" with me without giving any company automatic access to everything

### Acceptance Criteria
- I choose which Recordings go to which Team/Coach/Community Vault
- Leaving a Company stops future sharing; the Company keeps existing VaultEntries in its Vaults

---

## Story 7: Agency with Per-Client Vaults

**As a:** marketing or sales enablement agency

**I want:** a separate Client Vault per client

**So that:** we manage that client's calls, insights, and AI scoring with no leakage between clients

### Acceptance Criteria
- Clients can optionally be added as members with restricted roles in their Client Vault
- My agency team can see multiple Client Vaults; each client sees only their own

---

## Story 8: Marketing - Content & Social Proof

**As a:** marketing lead

**I want:** access only to VaultEntries tagged as "win, testimonial, happy customer, case study"

**So that:** I can create content without sifting through all raw calls

### Acceptance Criteria
- By default I do not see untagged raw sales/support calls
- I can create highlight reels and export snippets from allowed VaultEntries

---

## Story 9: Product/CX - Voice of Customer Vault

**As a:** product or CX leader

**I want:** a VOC Vault where support, onboarding, and success calls auto-sync and are tagged by theme

**So that:** we can prioritize roadmap and fixes

### Acceptance Criteria
- AI aggregates patterns by tag and time
- I can share specific Folders/Playlists from this Vault with engineering or leadership

---

## Story 10: Founder/Exec - External Sharing

**As a:** founder/executive

**I want:** to share specific VaultEntries or Folders with external parties (investors, advisors, partners)

**So that:** I can show proof or get help without exposing the full Bank

### Acceptance Criteria
- I can revoke access at any time to stop future viewing
- External viewers never see anything outside the shared items
- ShareLinks expire after 7 days by default

---

## Story 11: Personal to Business Auto-Routing

**As a:** rep who records all calls to Personal Bank first

**I want:** Rules to automatically copy "Work" tagged calls to my Company's Business Bank

**So that:** work and personal are kept completely separate at the Bank level

### Acceptance Criteria
- Personal Bank shows all my calls (or only non-work if I choose)
- Business Bank has only the work calls that matched rules
- I can optionally have the rule "move" (copy + delete from Personal) instead of just copy

---

## Story 12: Same Call, Different Contexts

**As a:** manager who uses one call for multiple purposes

**I want:** a single Recording to appear in Sales Team Vault, Marketing Vault, and VOC Vault simultaneously

**So that:** each team can tag, note, and analyze it for their specific needs without duplicating the file

### Acceptance Criteria
- One Recording, three VaultEntries
- Each VaultEntry has its own local_tags, folder_id, scores, notes
- Changes to one VaultEntry don't affect the others

---

# 9. Frequently Asked Questions

This section eliminates ambiguity by answering every question that might come up during implementation or usage.

## 9.1 Banks & Separation

### Q: Can a Recording exist in multiple Banks?
**A:** No. A Recording belongs to exactly ONE Bank. To have a call in two Banks, you COPY it (creating a new Recording row in the target Bank). Both rows point to the same physical media file, so there's no storage duplication.

### Q: When I "move" a call from Personal Bank to Business Bank, is it actually moved?
**A:** Under the hood, it's always COPY + DELETE. The system creates a new Recording in Business Bank, then (if you chose "move") deletes the one in Personal Bank. This ensures clean ownership boundaries.

### Q: Do I have to decide copy vs move every time?
**A:** No. Set a default at the Bank level (`cross_bank_default`). The setting applies to all cross-Bank operations unless you explicitly override on a specific action.

### Q: Can a Vault span multiple Banks?
**A:** No. A Vault belongs to exactly ONE Bank. VaultEntries can only reference Recordings in the same Bank.

---

## 9.2 VaultEntries & Recordings

### Q: Why do we need VaultEntry? Why not just move the Recording?
**A:** Because you want the same call in multiple Vaults with different metadata. Example: One testimonial call needs to be in Sales (tagged 'win'), Marketing (tagged 'UGC'), and VOC (tagged 'feature request'). Without VaultEntry, you'd need three copies of the Recording or lose the ability to have context-specific tags/notes.

### Q: What happens to VaultEntries if the original Recording is deleted?
**A:** Recordings with existing VaultEntries cannot be deleted. The owner can remove the Recording from their personal view (delete their VaultEntry) but cannot hard delete the Recording itself. This protects other Vaults that depend on it.

### Q: Can I have a VaultEntry without a Recording?
**A:** No. VaultEntry is a join record between Vault and Recording. It must reference an existing Recording in the same Bank.

### Q: If I delete a VaultEntry, is the Recording deleted?
**A:** No. Deleting a VaultEntry only removes it from that Vault. The Recording and any other VaultEntries remain unaffected.

---

## 9.3 Tags & Folders

### Q: What's the difference between Tags and Folders?
**A:** Tags = Metadata for automation. Rules and AI Agents key off tags. Folders = Human organization. They group VaultEntries for browsing and training sets. Keep these jobs separate.

### Q: Can a VaultEntry have both global_tags and local_tags?
**A:** Yes. Global tags come from the Recording (source-level). Local tags are specific to that VaultEntry (context-level). Both can be used in Rule conditions.

### Q: Can a VaultEntry be in multiple Folders?
**A:** No. A VaultEntry has one folder_id. If you need the same call in multiple "groupings," use tags for the secondary groupings and create smart views/filters.

---

## 9.4 Roles & Permissions

### Q: Can someone be a member of a Vault without being a member of the Bank?
**A:** No. VaultMembership requires BankMembership. You must first be invited to the Bank, then to specific Vaults within that Bank.

### Q: What can a "guest" actually see?
**A:** Only the specific Folders or VaultEntries they were explicitly granted access to via ShareLink or direct invite. Nothing else in the Vault.

### Q: Can a member see other members' VaultEntries?
**A:** By default, no. Members see: (1) VaultEntries they personally shared, and (2) VaultEntries in Folders with visibility=all_members. They cannot see managers-only or owner-only Folders.

---

## 9.5 Rules & Automation

### Q: Can a Rule in Bank A create a VaultEntry in Bank B?
**A:** Not directly. Rules must first COPY the Recording to Bank B, then create a VaultEntry there. Rules never cross Bank boundaries without an explicit copy action.

### Q: What prevents duplicate VaultEntries from being created?
**A:** Rules must be idempotent. Implementation checks for existing (recording_id, vault_id) combinations before creating, and tracks (recording_id, vault_id, rule_id) to prevent re-execution of the same rule.

### Q: Can I have a Rule that triggers another Rule?
**A:** Yes, through event chaining. If Rule A creates a VaultEntry, and Rule B triggers on vaultentry.created, Rule B will fire. However, two safeguards exist: (1) same-rule prevention stops a rule from running twice on the same target in one chain, and (2) max depth of 3 hops prevents infinite loops.

### Q: What happens if rules exceed the max depth?
**A:** The system logs the exceeded chain (for debugging) and stops further rule execution for that event chain. This is a safety valve, not a common occurrence.

---

## 9.6 AI Agents

### Q: Can an AI Agent see VaultEntries across multiple Vaults?
**A:** No. An AI Agent lives in ONE Vault and only sees VaultEntries in that Vault that match its filter (tags/folders).

### Q: Who can access an AI Agent?
**A:** Users who have (1) VaultMembership in that Vault, (2) appropriate role (member or above), and (3) Subscription permissions (feature enabled on their plan).

### Q: Can I share an AI Agent with someone outside my Bank?
**A:** No. AI Agents are Bank-scoped through their Vault. External users would need to be invited to the Bank and Vault.

---

## 9.7 Lifecycle & Offboarding

### Q: When an employee leaves, do their VaultEntries disappear?
**A:** No. VaultEntries persist in the Vault even after the person who shared them loses access. This is critical for compliance and audit purposes.

### Q: Can a churned coachee still access their own Recordings?
**A:** Yes, if those Recordings are in their own Bank. They lose access to the Coach's Vault and AI Agent, but their personal data remains theirs.

### Q: What happens to ShareLinks when someone is removed from a Vault?
**A:** All ShareLinks they created in that Vault are automatically invalidated. This prevents zombie access from lingering after offboarding.

### Q: How long do ShareLinks last?
**A:** ShareLinks default to 7-day expiry. This is configurable per Vault or per Bank. Vault owners can extend or recreate links, but nothing is "forever public" by default.

---

## 9.8 Technical Implementation

### Q: How do we handle the physical audio files to avoid duplication?
**A:** Store audio in object storage (S3, GCS, etc.) with content-based addressing. Multiple Recording rows can reference the same file_id. Only delete physical files when no Recording references them.

### Q: How do we ensure Bank isolation at the database level?
**A:** Every query should include bank_id in the WHERE clause. Consider row-level security (RLS) policies in PostgreSQL or equivalent. Never trust application code alone for isolation.

### Q: How do we handle pagination for large Vaults?
**A:** Use cursor-based pagination on VaultEntries, sorted by created_at DESC. Include vault_id and folder_id (if applicable) in the index.

---

# 10. Chat & Search Scoping

This section defines how chat and search respect the Bank/Vault architecture. **This is the integration layer that connects AI features to the permission model.**

## 10.1 Core Principle

> *All access (UI, search, chat, AI) is governed by VaultMembership; there is no hidden bypass.*

Chat is not a separate permission system. It reads through the same lens as everything else:
- **Bank** = outer tenant wall (must have BankMembership)
- **Vault** = knowledge container (must have VaultMembership to access content)
- **Chat** = searches across vaults user has membership in, within current bank

## 10.2 Scoping Rules

### When a Vault is Selected
Chat only sees VaultEntries in the currently selected vault.

**Mental model:** "I'm in Sales Training Vault, so chat is my AI over this knowledgebase."

This keeps the experience tight and prevents accidental leakage of client-specific or manager-only content just because someone is in the same Bank.

### When at Bank Level (No Vault Selected)
Chat searches the **union of all VaultEntries** in vaults where the user has VaultMembership within that bank.

**Not literally "all vaults in the bank"** but rather "all vaults I'm a member of in this bank."

This gives a powerful "ask anything about this company/account" experience without violating vault permissions.

**UX hint:** "You're searching across 5 vaults. Switch to a specific vault to narrow results."

### Folder Filters
Folder filters scope **within the current vault only**. Folder is always scoped to one Vault.

No cross-vault folder lookup. Folder names can repeat across vaults (every team has a "Hall of Fame"), and that's fine because they're local to the vault.

If cross-vault organization is needed, use tags (not folders).

## 10.3 Context Switching Behavior

### Bank Switch
Chat sessions are bank-scoped. Switching Banks:
1. Ends the visible conversation for the old Bank
2. Shows the chat history for the new Bank
3. **No chat context or search ever crosses Banks**

### Vault Switch (Same Bank)
Switching vaults clears chat. New vault = new conversation context.

### Session Storage Model
- Chat sessions stored **per Bank**
- Each session has an explicit **included vault set**
- By default, bank-level chat includes all vaults where user has VaultMembership
- Users can add/remove vaults from this set via filter controls
- System tracks **included** vaults; exclusion is a UI affordance for modifying that set

## 10.4 Multi-Vault Chat

Users can customize which vaults are included in their chat scope:

| Feature | Behavior |
|---------|----------|
| **Vault selection** | Filter chips in chat header (same pattern as other filters) |
| **Visibility** | Always visible in chat header |
| **Result attribution** | Gray subtle badge showing source vault on each result |
| **Single-vault mode** | Still shows vault badge for consistency |

### Include-Based Filter Model
The system always tracks **included vaults**. The UI may present this as "hiding" or "excluding" folders/vaults, but the underlying model is always include-based.

## 10.5 Access Enforcement

### VaultMembership is Required
BankMembership alone **never** exposes recordings. To see a Recording's content (via VaultEntry), user must:
1. Have VaultMembership in at least one vault containing that VaultEntry
2. Have access to the folder (all_members vs managers_only)

### Out-of-Scope Queries
If user asks about a recording not in their current scope: respond as "not found."

No hints like "this recording is in another vault" — treat non-accessible content as non-existent.

## 10.6 Why This Matters for Monetization

Because all access is gated by VaultMembership, each vault becomes a **sellable product**:

| Product Type | Implementation |
|--------------|----------------|
| **Coach Vault** | Buying the coaching program = VaultMembership in "Coach Vault" |
| **Community Vault** | Community membership = VaultMembership in "Community Vault" |
| **Client Vaults (agency)** | Each client gets VaultMembership in their own vault |

You can charge per:
- Seat
- Vault access
- AI agent attached to a vault

All built on the same primitive: **VaultMembership.**

Multi-vault chat doesn't break this model. It simply lets users combine the knowledge they already have membership to access in smarter ways.

## 10.7 Implementation Checklist

- [ ] Frontend sends bank_id and vault_ids in chat request body
- [ ] chat-stream filters searches to user's VaultMembership within active bank
- [ ] Vault filter chips appear in chat header
- [ ] Results show vault badge
- [ ] Bank switch clears chat and loads bank-specific history
- [ ] Vault switch clears chat (new context)
- [ ] User in Bank A cannot see Bank B content via chat
- [ ] User without VaultMembership cannot see vault content via chat
- [ ] Out-of-scope queries return "not found" (no hints)

---

# 11. Implementation Guidelines

This section provides concrete guidance for developers building CallVault.

## 10.1 Database Schema Priorities

1. Implement User, Bank, BankMembership first
2. Add Vault, VaultMembership
3. Add Recording, VaultEntry
4. Add Folder, Tag
5. Add Rule (start simple: just conditions and actions)
6. Add AIAgent
7. Add ShareLink/ExternalAccess
8. Add Subscription

## 10.2 MVP Feature Order

1. **Basic flows:** User creates Bank → creates Vault → connects recording source → Recordings appear → shares to Vault (creates VaultEntry)
2. **Roles & permissions** (VaultMembership) for owner/manager/member
3. **Folders** with visibility settings
4. **Tags** (global on Recording, local on VaultEntry)
5. **Basic Rules** (tag-based auto-routing)
6. **Cross-Bank copy** (Personal → Business)
7. **AI Agent** (single type: scoring or coaching)
8. **ShareLinks** for external access (with 7-day default TTL)

## 10.3 Testing Checklist

- [ ] User can only see Banks where they have BankMembership
- [ ] User can only see Vaults where they have VaultMembership
- [ ] VaultEntry cannot reference Recording in different Bank
- [ ] Removing BankMembership removes all VaultMemberships in that Bank
- [ ] Removing VaultMembership auto-revokes all ShareLinks created by that user in that Vault
- [ ] VaultEntries persist after Recording owner loses Vault access
- [ ] Cross-Bank operations always create new Recording row
- [ ] Rules are idempotent (no duplicate VaultEntries)
- [ ] Rule chaining stops at depth 3
- [ ] Same rule cannot run twice on same target in one event chain
- [ ] AI Agent only sees VaultEntries in its Vault matching its filter
- [ ] ShareLink only grants access to specific target, nothing else
- [ ] ShareLinks expire after configured TTL (default 7 days)
- [ ] Recordings with VaultEntries cannot be hard deleted

## 10.4 Common Pitfalls to Avoid

- **DO NOT** allow Recording.bank_id to change. Cross-Bank = COPY, always.
- **DO NOT** skip bank_id in queries. Use RLS or equivalent.
- **DO NOT** let Rules create VaultEntries across Banks without explicit copy action.
- **DO NOT** allow deletion of Recordings with existing VaultEntries.
- **DO NOT** forget idempotency in Rules.
- **DO NOT** give members access to manager-only Folders by accident—check visibility field.
- **DO NOT** leave ShareLinks active after user loses VaultMembership—auto-revoke.
- **DO NOT** allow rule chains deeper than 3 hops.

---

# 12. Glossary

Quick reference for all terms used in this document.

| Term | Definition |
|------|------------|
| **Bank** | Top-level container (tenant). Hard security boundary. Examples: Personal Bank, Company Bank. |
| **BankMembership** | Links a User to a Bank with a role (bank_owner, bank_admin, bank_member). |
| **Vault** | Collaboration container inside a Bank. Types: team, coach, community, client, personal. |
| **VaultMembership** | Links a User to a Vault with a role (vault_owner, vault_admin, manager, member, guest). |
| **Recording** | Base call object containing audio/transcript. Lives in exactly one Bank. |
| **VaultEntry** | Join record showing a Recording in a specific Vault with local metadata (tags, folder, scores, notes). |
| **Folder** | Groups VaultEntries inside a Vault for human organization. Has visibility settings. |
| **Tag** | Text label for metadata and automation. Global (Recording) or local (VaultEntry). |
| **Rule** | Automation that watches events and performs actions based on conditions. Max 3 hops per chain. |
| **AIAgent** | AI configuration scoped to a Vault that scores, coaches, or extracts from VaultEntries. |
| **Subscription** | Billing entity attached to a Bank controlling seats, Vaults, AI Agents, and features. |
| **ShareLink** | Tokenized link for sharing specific VaultEntries or Folders with external users. 7-day default TTL. Auto-revoked on membership removal. |

---

# 13. Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | January 2026 | Initial release. Complete architecture spec with all objects, relationships, permissions, user stories, and FAQ. All policy decisions finalized: Option A for deletion (block if VaultEntries exist), copy-only default for cross-Bank, auto-revoke ShareLinks on membership removal with 7-day default TTL, rule chaining max depth 3 with same-rule prevention. |
| 1.1 | January 2026 | Added Section 10: Chat & Search Scoping. Defines how chat respects Bank/Vault boundaries, vault-scoped vs bank-level search, context switching behavior, multi-vault chat, include-based filter model, and monetization implications. Key principle: "All access (UI, search, chat, AI) is governed by VaultMembership; there is no hidden bypass." |

---

*— End of Document —*
