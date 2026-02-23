# Options Comparison: Folders & Tags in CallVault v2

**Date:** 2026-02-22
**Decision:** Whether to keep folders and tags in the v2 refactor, and if so, how to scope and reshape them for the new bank/vault/MCP architecture.

---

## Strategic Summary

The via-negativa research already settled the "keep or remove" question: **keep both.** They're the organizational backbone between import and analysis — simple, non-AI, genuinely useful. The real decision is *how* to reshape them for v2, because the current implementation carries structural assumptions from the AI era that no longer make sense. The recommended path is **Option B: Purposeful Architectural Alignment** — copy the folder/tag system into the new repo with targeted removals and clarified purpose, not wholesale changes. The 2-tag limit goes (it was for AI behavior, not for users). System tags go (SKIP was for the AI pipeline). Everything else stays and gets cleaner semantics.

---

## What We're Deciding

CallVault v2 is a new repo + same Supabase project with:
- ~89K lines of AI/RAG/chat/embeddings **removed**
- Bank/vault multi-tenancy, 4-source import, transcript storage **kept**
- MCP server for external AI access **added**

Folders and tags are explicitly in the "keep" list. But the current implementation was shaped by AI-era requirements:
- The **2-tag limit** (max 2 per recording) existed because tags controlled *which AI prompts to run*
- The **SKIP system tag** existed to prevent AI processing on short transcripts
- Tag automation rules included **sentiment triggers** and **AI analysis actions**
- The **recordings.global_tags vs vault_entries.local_tags** split is new architecture that hasn't fully landed yet

The question: what do we do with all this in the new repo?

---

## Current Implementation (Key Facts)

**Folders:**
- `folders` table: bank-scoped, optional vault_id, unlimited nesting via parent_id, color/icon, visibility control (all_members | managers_only | owner_only)
- `folder_assignments` junction table: many-to-many, a recording can live in multiple folders
- `vault_entries.folder_id`: the newer schema puts folder assignment on the vault entry (clean)
- Frontend: FolderSidebar.tsx, useFolders.ts, 6 folder-related components

**Tags:**
- `call_tags` table: bank-scoped, system vs custom (is_system), max-2 enforced by DB trigger
- `call_tag_assignments`: primary/secondary distinction, auto_assigned flag
- `tag_rules` table: 5 rule types (title_exact, title_contains, title_regex, day_time, transcript_keyword) + AI trigger types (sentiment, run_ai_analysis)
- `recordings.global_tags TEXT[]`: source-level tags, apply bank-wide
- `vault_entries.local_tags TEXT[]`: vault-specific tags
- SKIP system tag: auto-assigned to calls with <500 char transcripts (to skip AI processing)

---

## Decision Criteria

1. **Product intent alignment** — Does it serve "the OS for your sales calls"? — Weight: **High**
2. **MCP queryability** — Can AI tools filter by this cleanly? (folders/tags are natural MCP filters) — Weight: **High**
3. **Implementation velocity** — How fast to build in new repo without regression? — Weight: **High**
4. **User comprehension** — Can users understand the system without a manual? — Weight: **Medium**
5. **Organizational power** — Does it scale to libraries of 100s+ of calls? — Weight: **Medium**
6. **AI-era baggage removal** — How much orphaned complexity gets cleared? — Weight: **Medium**
7. **Data migration simplicity** — Same DB, new frontend — existing data must still work — Weight: **Low**

---

## Options

### Option A: Copy As-Is (Remove Only Explicit AI Bits)

Copy the full folder/tag implementation into the new repo. Remove only what's clearly AI-bound: the SKIP system tag auto-assignment, the sentiment trigger rule type, the run_ai_analysis rule action. Keep everything else unchanged, including the 2-tag limit.

- **Product intent alignment:** Medium — The 2-tag limit is an AI-era artifact with no remaining justification. It will frustrate users who want to classify a call with 3 or more attributes. System tags concept persists but has nothing to do.
- **MCP queryability:** Good — Tags and folders are present and queryable. But the 2-tag limit means MCP filters by tag return sparser results than they should.
- **Implementation velocity:** Excellent — Copy-paste with minor removals. Fastest path.
- **User comprehension:** Medium — "Why can I only have 2 tags?" is now an unanswerable question.
- **Organizational power:** Good — Nested folders work well at scale.
- **AI-era baggage removal:** Poor — The 2-tag limit, primary/secondary distinction, and system tag machinery all remain without purpose.
- **Data migration:** Excellent — No schema changes needed.
- **Score: 5/10**

Why it scores low despite being fast: you're carrying technical debt that will confuse users and developers alike. The 2-tag limit will generate support tickets. The primary/secondary distinction will confuse contributors. These are small but persistent paper cuts.

---

### Option B: Purposeful Architectural Alignment (Recommended)

Rebuild folders and tags in the new repo with clear-cut purpose per feature, removing AI-era artifacts and aligning to the vault_entries schema that was already built:

**Folders → "Where in this vault does this recording live"**
- Keep: bank-scoped, vault_entries.folder_id (the cleaner architecture), unlimited nesting (but UI encourages ≤3 levels), custom colors/icons, tag automation rules for folder assignment
- Simplify: Visibility from 3-tier (all_members/managers_only/owner_only) to 2-tier (**shared/private**). managers_only adds complexity without clear v2 value; reintroduce if demand materializes.
- Remove: The `folder_assignments` junction table complexity where `vault_entries.folder_id` already handles it cleanly

**Tags → "What type of call this is, everywhere (global) or in this vault (local)"**
- Keep: bank-scoped custom tags, global tags (recordings.global_tags) for bank-wide classification, local tags (vault_entries.local_tags) for vault-specific labels, tag automation rules (non-AI types only), auto_assigned flag (useful for provenance)
- Remove: The 2-tag limit (DB trigger) and the primary/secondary distinction — these served AI prompt routing, not user organization. Remove system tags (SKIP is meaningless without an AI pipeline). Remove AI rule types: sentiment trigger, run_ai_analysis action.
- Clarify: Global tags = "what kind of call" (persistent across all vault appearances). Local tags = "what this vault's team cares about for this recording" (vault-context-specific).

**MCP alignment:**
- `list_recordings` tool accepts `tag_filter`, `folder_id` parameters
- `search_recordings` works across global_tags + local_tags for the active workspace
- Resource URIs naturally encode vault context: `callvault://banks/{bank_id}/vaults/{vault_id}/recordings/{recording_id}`

| Criterion | Rating |
|---|---|
| Product intent alignment | Excellent — Tags are labels. Folders are places. No AI baggage. |
| MCP queryability | Excellent — Global/local tag split maps cleanly to bank/vault MCP scoping |
| Implementation velocity | Good — Copy core, remove targeted parts, clarify schema |
| User comprehension | Excellent — No artificial limits, clear two-concept model |
| Organizational power | Excellent — Nested folders + unlimited tags + automation rules |
| AI-era baggage removal | Good — Removes all orphaned constraints and system tag machinery |
| Data migration | Good — Same DB, existing tags/folders work, just drop the trigger constraint |

**Score: 9/10**

---

### Option C: Radical Simplification

Rebuild both as simple, flat systems. No nesting, no automation rules, no visibility controls, no global/local distinction. Tags are unlimited flat labels per recording. Folders are flat top-level buckets.

- **Product intent alignment:** Medium — Works for small libraries, breaks at scale.
- **MCP queryability:** Excellent — Flat structure is trivially queryable.
- **Implementation velocity:** Excellent — Minimal code.
- **User comprehension:** Excellent — Nothing to explain.
- **Organizational power:** Poor — 200+ calls in flat folders is chaos.
- **AI-era baggage removal:** Excellent — Strips everything.
- **Data migration:** Poor — Existing nested folder data would need flattening; users lose structure.
- **Score: 5/10**

Why it fails: the value of folders specifically is hierarchy. "Sales calls > By client > Acme Corp > Q1 2026" is a real pattern that flat buckets can't serve. Radical simplification removes legitimate organizational value that users have already built.

---

### Option D: Unified Label System (Drop Folders/Tags Distinction)

Merge folders and tags into a single hierarchical label system — one concept instead of two. Labels can nest (like folders) and apply to recordings (like tags). Think: Gmail labels.

- **Product intent alignment:** Medium — Forces a single model onto two distinct user mental models ("where it lives" vs "what it is").
- **MCP queryability:** Good — One system to query.
- **Implementation velocity:** Poor — New concept to design and build from scratch.
- **User comprehension:** Medium-Poor — "Label that is also a folder" confuses most users who expect the folder/tag distinction.
- **Organizational power:** Good — Hierarchy preserved.
- **AI-era baggage removal:** Good.
- **Data migration:** Poor — Significant schema restructure; all existing folder/tag data needs remap.
- **Score: 4/10**

Why it fails: folders and tags serve genuinely different spatial metaphors. A folder is *where* (location-based, one place). A tag is *what* (attribute-based, can have many). Conflating them into "labels" requires users to learn a new model and loses the intuitive clarity of the two-concept system.

---

## Comparison Matrix

| Criterion | Weight | A: Copy As-Is | B: Arch. Alignment (Rec.) | C: Radical Simplify | D: Unified Labels |
|---|---|---|---|---|---|
| Product intent alignment | HIGH | Medium | Excellent | Medium | Medium |
| MCP queryability | HIGH | Good | Excellent | Excellent | Good |
| Implementation velocity | HIGH | Excellent | Good | Excellent | Poor |
| User comprehension | MED | Medium | Excellent | Excellent | Medium-Poor |
| Organizational power | MED | Good | Excellent | Poor | Good |
| AI-era baggage removal | MED | Poor | Good | Excellent | Good |
| Data migration | LOW | Excellent | Good | Poor | Poor |
| **Score** | | **5/10** | **9/10** | **5/10** | **4/10** |

---

## Recommendation

**Option B: Purposeful Architectural Alignment**

The new repo is a rare opportunity to reset the conceptual clarity of folders and tags without migrating user data (same Supabase project). The core changes are surgical:

1. **Drop the 2-tag DB trigger.** Unlimited tags per recording. The primary/secondary distinction goes with it.
2. **Drop system tags (is_system).** Remove the SKIP auto-assign trigger. No more system tag concept.
3. **Simplify folder visibility to 2 tiers.** `private` (owner only) and `shared` (all vault members). Drop `managers_only`.
4. **Remove AI rule types from tag_rules.** Keep: title_exact, title_contains, title_regex, day_time, transcript_keyword. Drop: sentiment trigger, run_ai_analysis action.
5. **Lean into vault_entries.folder_id as the folder assignment.** A recording lives in one folder *per vault* (via vault_entries.folder_id). The old folder_assignments junction table (many-to-many) may coexist during transition but is not the new model.
6. **Articulate global vs local tags.** global_tags on recordings are bank-wide classification ("what kind of call"). local_tags on vault_entries are vault-specific ("what this vault's team cares about"). Make this visible and intentional in the UI and MCP tools.

### The purpose statement that guides every decision:

> **Folders answer: where?** (Spatial organization within a vault — hierarchical, location-based)
> **Tags answer: what?** (Classification of the recording — attribute-based, applies across vault appearances)
> **Global tags answer: what, always** (Bank-wide classification that follows a recording into any vault)
> **Local tags answer: what, here** (Vault-specific labels that only this vault's members apply and see)

---

## Runner-Up

**Option A: Copy As-Is** — choose this only if:
- Timeline is extremely tight and no iteration is planned before GA
- You're unsure how much the 2-tag limit actually bothers users

The switch cost from A to B later is low for tags (drop a trigger, remove a constraint) but creates a confusing interim state. Better to make the call once in the new repo.

---

## Implementation Context

```yaml
chosen:
  option: Purposeful Architectural Alignment (Option B)

folders:
  keep:
    - Bank-scoped via bank_id (workspace isolation)
    - Vault-associated via vault_entries.folder_id (recording lives in one folder per vault)
    - Unlimited nesting via parent_id (UI: guide users toward ≤3 levels, don't enforce)
    - Custom colors and Remix icons
    - Non-AI tag rules that assign folders (title matching, keyword)
    - useFolders.ts hook (copy, remove folder_assignments complexity)
    - FolderSidebar.tsx component (copy with visibility simplification)

  simplify:
    - Visibility from 3-tier to 2-tier: private (owner only) | shared (all vault members)
    - folder_assignments junction table: use vault_entries.folder_id as primary;
      folder_assignments may still exist for legacy fathom_calls data during migration

  remove:
    - managers_only visibility tier
    - Hidden folders (localStorage hack) — reconsider if there's a real need

tags:
  keep:
    - Bank-scoped custom tags (call_tags table)
    - Global tags: recordings.global_tags TEXT[] — bank-wide classification
    - Local tags: vault_entries.local_tags TEXT[] — vault-specific labels
    - Tag automation rules (tag_rules table), non-AI types only
    - auto_assigned boolean (provenance — was this user-applied or rule-applied?)
    - Tag filter in UI and MCP tools

  remove:
    - 2-tag limit DB trigger (was for AI prompt routing, not user organization)
    - primary/secondary tag distinction
    - system tags concept (is_system, null user_id)
    - SKIP system tag and its auto-assign trigger (meaningless without AI pipeline)
    - Tag rule types: sentiment trigger, run_ai_analysis action
    - AI-adjacent: auto_tags column in fathom_calls (legacy, not in new schema)

mcp_integration:
  - list_recordings: accepts folder_id, tag filters (global_tags, local_tags)
  - search_recordings: searches across transcript + global/local tags
  - browse_vault_hierarchy: exposes folder tree for navigation
  - Tag and folder IDs returned in recording metadata for follow-up filtering
  - Natural resource URI: callvault://banks/{bank_id}/vaults/{vault_id}/recordings/{id}

data_migration:
  - Same Supabase project — existing folders/tags are untouched
  - Drop the max-2-tags trigger in a migration (unblocks unlimited tags)
  - Existing 2-tag data remains valid under unlimited-tags rule
  - SKIP system tag: mark inactive or delete (no active assignments needed after removal)
  - vault_entries.local_tags and folder_id: already in the schema, just use them as primary

schema_changes_needed:
  - ALTER TABLE call_tags DROP COLUMN is_primary; (or just stop using it)
  - DROP TRIGGER enforce_max_tags ON call_tag_assignments; (the 2-tag limit)
  - DROP TRIGGER auto_skip_tag ON fathom_calls; (meaningless without AI)
  - UPDATE folders SET visibility = 'shared' WHERE visibility = 'managers_only'; (backfill)
  - ALTER TABLE folders DROP CONSTRAINT ... CHECK (visibility IN ('all_members','managers_only','owner_only'));
  - ADD CHECK (visibility IN ('private', 'shared'));
  - DELETE FROM call_tags WHERE is_system = true; (remove SKIP and other system tags)

gotchas:
  - The folder_assignments junction table (many-to-many) is used by existing fathom_calls data.
    vault_entries.folder_id is the right model for new schema (one folder per vault appearance).
    Both need to coexist until fathom_calls migration is complete.
  - global_tags on recordings vs local_tags on vault_entries must be clearly labeled in UI.
    "All tags" must search both. Don't let users confuse why a tag "disappeared" when
    they change vault contexts.
  - Tag automation rules (tag_rules table) assign to both call_tag_assignments AND
    folder_assignments. The "remove AI rule types" is just filtering the rule_type CHECK
    constraint — the rest of the rules machinery is clean.

runner_up:
  option: Option A (Copy As-Is)
  when: Timeline pressure makes even surgical changes risky before first public v2 ship
  switch_cost: Low for tags (drop trigger), medium for folders (visibility simplification)
```

---

## The Short Version (For Scoping v2 Work)

**Keep both. Reshape both.**

| Feature | v1 Purpose | v2 Purpose | What Changes |
|---|---|---|---|
| Folders | "Where to find it" + AI pipeline org | "Where in this vault" | Simplify visibility to 2 states; vault_entries.folder_id as primary |
| Global tags | "What kind of call" (for AI routing) | "What kind of call" (for filtering/search) | Remove 2-tag limit; remove system tags; make explicit |
| Local tags | Vault-specific labels | Vault-specific labels | No change to concept; remove 2-tag limit applies here too |
| Tag rules | Auto-tag + AI analysis triggers | Auto-tag + folder assignment | Remove AI rule types only |

The 2-tag limit is **the single most important thing to remove** — it's an invisible wall that users hit without understanding why, and it has no v2 justification.

---

*Saved: `artifacts/research/2026-02-22-folders-tags-in-v2-options.md`*
