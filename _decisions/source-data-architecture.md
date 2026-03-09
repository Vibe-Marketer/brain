# CallVault Data & Source Architecture – Engineering Directive

- NOTE: **this is a living document and will be updated as we go, the information that's below and the naming conventions are subject to change as we learn more about what our users need and as we build out the product. Overall the following is EXACTLY what and how, the structure will remain the same regardless of what the "names" are.**

--- 

## 1. Objectives

- Support **multiple heterogeneous sources** (Fathom, Zoom, Uploads, YouTube, etc.).  
- Have **one canonical “All Calls” table** per organization.  
- Keep **permissions and knowledgebases** clean via Organizations & Workspaces.  
- Make Workspaces about **who + purpose**, NOT about “this is the Fathom workspace.”

---

## 2. Core Concepts (Final Names)

- **Organization** = tenant / account (personal, company, agency).  
- **Workspace** = knowledgebase / team / client inside an Organization.  
- **Source** = Fathom, Zoom, Google Meet, YouTube, raw uploads, etc.  
- **Call** = canonical, normalized call row for that Organization.  
- **WorkspaceCall** = “this Call in this Workspace with this context.”

---

## 3. Database Schema (Authoritative)

### 3.1 Organizations & Workspaces

- `organizations`  
  - `id`, `name`, `type`, `created_at`, etc.

- `organization_memberships`  
  - `user_id`, `organization_id`, `role` (owner, admin, member)

- `workspaces`  
  - `id`, `organization_id`, `name`, `workspace_type` (`team | coach | community | client | personal`), `created_at`

- `workspace_memberships`  
  - `user_id`, `workspace_id`, `role` (owner, admin, manager, member, guest)

### 3.2 Canonical Calls

- `calls`  (**single SSoT per org for all sources**)  
  - `id`  
  - `organization_id`  
  - `owner_user_id` (who recorded/imported it in this org)  
  - `source_type` (`fathom | zoom | upload | youtube | ...`)  
  - `source_call_id` (PK in raw table, or external id)  
  - `title`  
  - `start_time`  
  - `duration`  
  - `primary_participants` (JSON)  
  - `status`  
  - `audio_url` (or media_url)  
  - `created_at`, `updated_at`  
  - `global_tags` (if you need them)

**Rule:**  
- Each call row belongs to **exactly one Organization**.  
- All “All Calls” views must query this table, never raw tables directly.

### 3.3 Workspace-level Context

- `workspace_calls` (previously VaultEntry)  
  - `id`  
  - `workspace_id`  
  - `call_id`  
  - `folder_id` (nullable)  
  - `local_tags` (JSON or join)  
  - `scores` (JSON)  
  - `notes` (text/JSON)  
  - `created_at`

**Rules:**

- A `call` can have **0..N** `workspace_calls` within the same `organization_id`.  
- Deleting one `workspace_calls` row **never** deletes the underlying `call`.  
- Workspace permissions, folders, AI, etc. operate on `workspace_calls`.

### 3.4 Source-specific Raw Tables

For each integration, keep a raw table with its full schema:

- `fathom_raw_calls`  
- `zoom_raw_calls`  
- `youtube_raw_calls`  
- `upload_raw_files`  
- etc.

These can have as many columns as needed for that integration (timestamps, raw transcripts, proprietary fields, etc.).

**Rule:**  
- These tables are **not** used for permissions or main list views.  
- They are only used for ingestion, sync, and deep-dive “source details” UI.

---

## 4. Ingestion Pipeline (All Sources)

For **every** source (Fathom, Zoom, Upload, YouTube):

1. **Write raw event** into the appropriate `*_raw_*` table.  
2. **Upsert canonical Call** into `calls`:
   - Normalize into the shared columns (`organization_id`, `source_type`, `source_call_id`, `title`, `start_time`, etc.).  
   - If `(organization_id, source_type, source_call_id)` exists, update; else insert.
3. **Attach to default Workspace** via `workspace_calls`:
   - On first ingest for a user in an org, ensure:
     - That org has a **Personal workspace** (workspace_type = `personal`).  
     - The user has `workspace_membership` there (owner).  
   - Create `workspace_calls` row for that `call_id` in the user’s default workspace (Personal or whatever your spec says).

Routing into other Workspaces (Sales, Marketing, Client X) is handled by **Rules**, which just create additional `workspace_calls` rows pointing to the same `call_id`.

---

## 5. UI Mapping (Single Source of Truth)

- **Organization “All Calls” view:**  
  - Query: `SELECT * FROM calls WHERE organization_id = ? AND id IN (SELECT call_id FROM workspace_calls WHERE workspace_id IN (workspaces user is member of))`.  
  - Columns = normalized `calls` columns only.

- **Workspace Calls view:**  
  - Query: `SELECT calls.* , workspace_calls.* FROM workspace_calls JOIN calls ON workspace_calls.call_id = calls.id WHERE workspace_id = ?`.

- **Call Detail view:**  
  1. Load the canonical `call` row.  
  2. Look at `source_type` + `source_call_id` (or `call_id`) and fetch from the relevant raw table (e.g., `fathom_raw_calls`) for rich, source-specific metadata.  
  3. Show both: normalized header + source-specific panel.

No UI list should ever union `fathom_calls + zoom_calls` directly. They always hit `calls` (+ `workspace_calls`).

---

## 6. Sharing / Moving Logic

- **Within same Organization (between Workspaces):**
  - “Share this call to Workspace Y” =  
    - Create a new `workspace_calls` row with that `workspace_id` and `call_id`.  
  - You CAN have a call appear in multiple Workspaces. That is **intended**.

- **Across Organizations:**
  - “Send this call to another Organization” =  
    - Create a new `calls` row in target org (copy key fields, same media URL).  
    - Optionally create a `workspace_calls` row in a default workspace there.  
    - Optional “move” = after successful copy, delete/hide original `calls` row in source org if policy allows.

---

## 7. Legacy Fathom Migration

Current: everything is in `fathom_calls` and used directly in UI.

Migration steps:

1. **Rename / treat** `fathom_calls` as `fathom_raw_calls`.  
2. **Create new `calls` table** as defined above.  
3. **Backfill:**
   - For each existing user:
     - Create an `organization` (Personal Org) if none exists.  
     - Create a default `workspace` (Personal Workspace) in that org.  
     - Create `organization_membership` (owner) and `workspace_membership` (owner).
   - For each row in `fathom_raw_calls`:
     - Create a `calls` row in that user’s org (map fields).  
     - Create a `workspace_calls` row linking to their Personal Workspace.
4. **Cut over UI**:
   - All “All Calls” and workspace views now read from `calls` + `workspace_calls`.  
   - `fathom_raw_calls` is used only for source-specific details.

---

## 8. Hard DO / DO NOT Rules

- **DO NOT** model Workspaces per Source (no “Fathom Workspace”, “Zoom Workspace” as an architectural requirement). Sources feed `calls`; Workspaces are about **who & purpose**.
- **DO** store every integration’s full metadata in its **own raw table**.
- **DO** normalize **every** call into `calls`.
- **DO** use `workspace_calls` as the only way calls show up in Workspaces.
- **DO NOT** query raw source tables for “All Calls” or Workspaces views.
- **DO** let a call have multiple `workspace_calls` in the same org by design.

If you implement this exactly, you get:

- Clean multi-source support  
- One true “All Calls” table  
- Clear Organization/Workspace semantics  
- No more “cobbled together” parallel query hacks.
